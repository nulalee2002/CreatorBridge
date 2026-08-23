create table public.project_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete restrict,
  version integer check (version is null or version > 0),
  status text not null default 'draft' check (status in (
    'draft', 'under_review', 'revision_requested', 'superseded', 'approved',
    'disputed', 'payment_attention', 'archived'
  )),
  note text check (note is null or length(note) <= 5000),
  idempotency_key text,
  direct_size_bytes bigint not null default 0 check (direct_size_bytes between 0 and 5000000000),
  review_started_at timestamptz,
  review_deadline_at timestamptz,
  review_paused_at timestamptz,
  reminder_48h_sent_at timestamptz,
  reminder_24h_sent_at timestamptz,
  approved_at timestamptz,
  superseded_at timestamptz,
  retention_expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version),
  unique (project_id, creator_user_id, idempotency_key),
  check (
    (status = 'draft' and version is null and submitted_at is null and review_deadline_at is null)
    or (status <> 'draft' and version is not null and submitted_at is not null)
  )
);

create table public.project_delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.project_deliveries(id) on delete restrict,
  item_type text not null check (item_type in ('direct', 'external')),
  label text not null check (length(trim(label)) between 1 and 240),
  original_file_name text,
  content_type text,
  size_bytes bigint not null default 0 check (size_bytes between 0 and 5000000000),
  bucket text,
  object_path text unique,
  external_url text,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'failed', 'deleted')),
  uploaded_at timestamptz,
  deleted_at timestamptz,
  deletion_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_type = 'direct' and bucket = 'project-deliveries' and object_path is not null
      and external_url is null and size_bytes > 0 and content_type is not null and original_file_name is not null)
    or
    (item_type = 'external' and bucket is null and object_path is null
      and external_url ~ '^https://' and size_bytes = 0 and upload_status = 'uploaded')
  )
);

create table public.project_delivery_holds (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.project_deliveries(id) on delete restrict,
  hold_type text not null check (hold_type in ('revision', 'dispute', 'payment', 'support', 'legal')),
  reason text not null check (length(trim(reason)) between 2 and 1000),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  check ((active and released_at is null) or (not active and released_at is not null))
);

create index project_deliveries_project_history_idx
  on public.project_deliveries(project_id, version desc nulls last, created_at desc);
create index project_deliveries_review_due_idx
  on public.project_deliveries(review_deadline_at)
  where status = 'under_review';
create index project_deliveries_retention_idx
  on public.project_deliveries(retention_expires_at)
  where retention_expires_at is not null;
create index project_delivery_items_delivery_idx on public.project_delivery_items(delivery_id, created_at);
create index project_delivery_holds_active_idx on public.project_delivery_holds(delivery_id) where active;

alter table public.project_deliveries enable row level security;
alter table public.project_delivery_items enable row level security;
alter table public.project_delivery_holds enable row level security;

revoke all on table public.project_deliveries from anon, authenticated;
revoke all on table public.project_delivery_items from anon, authenticated;
revoke all on table public.project_delivery_holds from anon, authenticated;
grant select on table public.project_deliveries to authenticated;
grant select on table public.project_delivery_items to authenticated;
grant select on table public.project_delivery_holds to authenticated;

create policy project_deliveries_party_select
on public.project_deliveries for select to authenticated
using (
  exists (
    select 1 from public.projects project
    join public.creator_listings listing on listing.id::text = project.accepted_creator_id::text
    where project.id = project_deliveries.project_id
      and auth.uid() in (project.client_id, listing.user_id)
  )
  or public.is_platform_admin(auth.uid())
);

create policy project_delivery_items_party_select
on public.project_delivery_items for select to authenticated
using (
  exists (
    select 1 from public.project_deliveries delivery
    join public.projects project on project.id = delivery.project_id
    join public.creator_listings listing on listing.id::text = project.accepted_creator_id::text
    where delivery.id = project_delivery_items.delivery_id
      and auth.uid() in (project.client_id, listing.user_id)
  )
  or public.is_platform_admin(auth.uid())
);

create policy project_delivery_holds_party_select
on public.project_delivery_holds for select to authenticated
using (
  exists (
    select 1 from public.project_deliveries delivery
    join public.projects project on project.id = delivery.project_id
    join public.creator_listings listing on listing.id::text = project.accepted_creator_id::text
    where delivery.id = project_delivery_holds.delivery_id
      and auth.uid() in (project.client_id, listing.user_id)
  )
  or public.is_platform_admin(auth.uid())
);

create or replace function private.prevent_submitted_delivery_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.project_id is distinct from old.project_id
    or new.creator_user_id is distinct from old.creator_user_id
    or new.version is distinct from old.version
    or new.note is distinct from old.note
    or new.idempotency_key is distinct from old.idempotency_key
    or new.direct_size_bytes is distinct from old.direct_size_bytes
    or new.review_started_at is distinct from old.review_started_at
    or new.submitted_at is distinct from old.submitted_at
  ) then
    raise exception 'Submitted delivery content is immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger prevent_submitted_delivery_mutation
before update on public.project_deliveries
for each row execute function private.prevent_submitted_delivery_mutation();

create or replace function private.prevent_submitted_delivery_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.project_deliveries where id = old.delivery_id;
  if v_status <> 'draft' then
    if tg_op = 'DELETE' then
      raise exception 'Submitted delivery items cannot be deleted' using errcode = '42501';
    end if;
    if new.delivery_id is distinct from old.delivery_id
      or new.item_type is distinct from old.item_type
      or new.label is distinct from old.label
      or new.original_file_name is distinct from old.original_file_name
      or new.content_type is distinct from old.content_type
      or new.size_bytes is distinct from old.size_bytes
      or new.bucket is distinct from old.bucket
      or new.object_path is distinct from old.object_path
      or new.external_url is distinct from old.external_url then
      raise exception 'Submitted delivery items are immutable' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger prevent_submitted_delivery_item_mutation
before update or delete on public.project_delivery_items
for each row execute function private.prevent_submitted_delivery_item_mutation();

create or replace function private.enforce_delivery_direct_size()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_delivery_status text;
  v_total bigint;
begin
  select status into v_delivery_status
  from public.project_deliveries
  where id = new.delivery_id
  for update;
  if v_delivery_status is distinct from 'draft' then
    raise exception 'Delivery items can only be added to a draft' using errcode = '55000';
  end if;
  if new.item_type = 'direct' then
    select coalesce(sum(size_bytes), 0)::bigint into v_total
    from public.project_delivery_items
    where delivery_id = new.delivery_id and item_type = 'direct'
      and (tg_op = 'INSERT' or id <> new.id);
    if v_total + new.size_bytes > 5000000000 then
      raise exception 'Direct delivery limit exceeded' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_delivery_direct_size
before insert or update of size_bytes, delivery_id on public.project_delivery_items
for each row execute function private.enforce_delivery_direct_size();

alter table public.messages
  add column message_type text not null default 'user'
    check (message_type in ('user', 'system', 'delivery', 'revision')),
  add column pinned boolean not null default false,
  add column delivery_id uuid references public.project_deliveries(id) on delete restrict;

alter table public.project_revision_requests
  add constraint project_revision_requests_delivery_fk
  foreign key (delivery_id) references public.project_deliveries(id) on delete restrict;

drop policy if exists revision_requests_project_party_select on public.project_revision_requests;
create policy revision_requests_project_party_select
on public.project_revision_requests for select to authenticated
using (
  client_id = auth.uid()
  or exists (
    select 1
    from public.projects project
    join public.creator_listings listing on listing.id::text = project.accepted_creator_id::text
    where project.id = project_revision_requests.project_id and listing.user_id = auth.uid()
  )
  or public.is_platform_admin(auth.uid())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-deliveries',
  'project-deliveries',
  false,
  5000000000,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
    'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/flac',
    'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5000000000,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own CreatorBridge storage objects" on storage.objects;
create policy "Users can read own CreatorBridge storage objects"
on storage.objects for select to authenticated
using (
  bucket_id in ('creator-portfolio', 'creator-intros', 'client-assets', 'project-attachments')
  and (owner_id = auth.uid()::text or (storage.foldername(name))[1] = auth.uid()::text)
);

drop policy if exists "Users can upload to own CreatorBridge storage folder" on storage.objects;
create policy "Users can upload to own CreatorBridge storage folder"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('creator-portfolio', 'creator-intros', 'client-assets', 'project-attachments')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own CreatorBridge storage objects" on storage.objects;
create policy "Users can update own CreatorBridge storage objects"
on storage.objects for update to authenticated
using (
  bucket_id in ('creator-portfolio', 'creator-intros', 'client-assets', 'project-attachments')
  and (owner_id = auth.uid()::text or (storage.foldername(name))[1] = auth.uid()::text)
)
with check (
  bucket_id in ('creator-portfolio', 'creator-intros', 'client-assets', 'project-attachments')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own CreatorBridge storage objects" on storage.objects;
create policy "Users can delete own CreatorBridge storage objects"
on storage.objects for delete to authenticated
using (
  bucket_id in ('creator-portfolio', 'creator-intros', 'client-assets', 'project-attachments')
  and (owner_id = auth.uid()::text or (storage.foldername(name))[1] = auth.uid()::text)
);

create policy "Project creators can upload issued delivery objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-deliveries'
  and exists (
    select 1
    from public.project_delivery_items item
    join public.project_deliveries delivery on delivery.id = item.delivery_id
    where item.bucket = bucket_id
      and item.object_path = name
      and item.item_type = 'direct'
      and item.upload_status = 'pending'
      and delivery.status = 'draft'
      and delivery.creator_user_id = auth.uid()
  )
);

create or replace function public.finalize_project_delivery(
  p_project_id uuid,
  p_delivery_id uuid,
  p_creator_user_id uuid,
  p_note text,
  p_idempotency_key text
)
returns public.project_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_delivery public.project_deliveries%rowtype;
  v_existing public.project_deliveries%rowtype;
  v_creator_user_id uuid;
  v_item_count integer;
  v_direct_bytes bigint;
  v_version integer;
  v_conversation public.project_conversations%rowtype;
  v_now timestamptz := now();
begin
  if length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_note, ''))) > 5000 then
    raise exception 'Delivery note is too long' using errcode = '22023';
  end if;

  select * into v_existing from public.project_deliveries
  where project_id = p_project_id and creator_user_id = p_creator_user_id
    and idempotency_key = trim(p_idempotency_key);
  if found then return v_existing; end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  select user_id into v_creator_user_id from public.creator_listings
  where id::text = v_project.accepted_creator_id::text;
  if v_creator_user_id is distinct from p_creator_user_id then
    raise exception 'Only the accepted creator can submit delivery' using errcode = '42501';
  end if;
  if v_project.status not in ('retainer_paid', 'in_progress', 'revision', 'delivered') then
    raise exception 'Project is not ready for delivery' using errcode = '55000';
  end if;

  select * into v_delivery from public.project_deliveries
  where id = p_delivery_id and project_id = p_project_id and creator_user_id = p_creator_user_id
  for update;
  if not found or v_delivery.status <> 'draft' then
    raise exception 'Delivery draft is not available' using errcode = '55000';
  end if;

  select count(*)::integer,
    coalesce(sum(size_bytes) filter (where item_type = 'direct'), 0)::bigint
  into v_item_count, v_direct_bytes
  from public.project_delivery_items
  where delivery_id = p_delivery_id and upload_status = 'uploaded';
  if v_item_count = 0 then raise exception 'A delivery must contain at least one completed item' using errcode = '22023'; end if;
  if exists (select 1 from public.project_delivery_items where delivery_id = p_delivery_id and upload_status <> 'uploaded') then
    raise exception 'All direct uploads must finish before submission' using errcode = '55000';
  end if;
  if v_direct_bytes > 5000000000 then raise exception 'Direct delivery limit exceeded' using errcode = '22023'; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.project_deliveries where project_id = p_project_id and version is not null;

  update public.project_deliveries
  set status = 'superseded', superseded_at = v_now, updated_at = v_now
  where project_id = p_project_id and status in ('under_review', 'revision_requested');

  update public.project_deliveries
  set version = v_version,
      status = 'under_review',
      note = nullif(trim(coalesce(p_note, '')), ''),
      idempotency_key = trim(p_idempotency_key),
      direct_size_bytes = v_direct_bytes,
      review_started_at = v_now,
      review_deadline_at = v_now + interval '120 hours',
      submitted_at = v_now,
      updated_at = v_now
  where id = p_delivery_id
  returning * into v_delivery;

  insert into public.project_conversations (project_id, client_id, creator_user_id)
  values (v_project.id, v_project.client_id, p_creator_user_id)
  on conflict (project_id) do update set project_id = excluded.project_id
  returning * into v_conversation;

  insert into public.messages (
    conversation_id, sender_id, recipient_id, project_id, delivery_id,
    message_type, pinned, body, read
  ) values (
    v_conversation.conversation_id, p_creator_user_id, v_project.client_id, p_project_id, v_delivery.id,
    'delivery', true,
    'Delivery version ' || v_version::text || ' was formally submitted. The five-day review window has started.',
    false
  );

  update public.projects
  set status = 'delivered', delivered_at = v_now,
      delivery_link = null, delivery_notes = v_delivery.note
  where id = p_project_id;

  perform public.create_platform_notification(
    v_project.client_id,
    'delivery_submitted',
    'Final delivery submitted',
    'Review delivery version ' || v_version::text || ' within five calendar days.',
    '/projects?project=' || p_project_id::text,
    jsonb_build_object('project_id', p_project_id, 'delivery_id', v_delivery.id, 'version', v_version),
    p_creator_user_id,
    v_delivery.review_deadline_at
  );

  return v_delivery;
end;
$$;

revoke all on function public.finalize_project_delivery(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_project_delivery(uuid, uuid, uuid, text, text) to service_role;
