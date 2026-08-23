create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.project_deliveries
  add column approval_source text check (approval_source in ('client', 'automatic')),
  add column cleanup_claimed_at timestamptz,
  add column cleanup_attempts integer not null default 0,
  add column cleanup_last_error text;

create table public.project_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.project_deliveries(id) on delete restrict,
  event_type text not null check (event_type in (
    'reminder_48h', 'reminder_24h', 'auto_approve', 'client_approve', 'cleanup'
  )),
  status text not null default 'claimed' check (status in ('claimed', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (delivery_id, event_type)
);

alter table public.project_delivery_events enable row level security;
revoke all on table public.project_delivery_events from anon, authenticated;
grant select on table public.project_delivery_events to authenticated;

create policy project_delivery_events_party_select
on public.project_delivery_events for select to authenticated
using (
  exists (
    select 1 from public.project_deliveries delivery
    join public.projects project on project.id = delivery.project_id
    join public.creator_listings listing on listing.id::text = project.accepted_creator_id::text
    where delivery.id = project_delivery_events.delivery_id
      and auth.uid() in (project.client_id, listing.user_id)
  )
  or public.is_platform_admin(auth.uid())
);

create unique index project_delivery_holds_one_active_type_idx
  on public.project_delivery_holds(delivery_id, hold_type)
  where active;

create or replace function public.claim_project_review_events(p_limit integer default 50)
returns table (
  event_id uuid,
  delivery_id uuid,
  project_id uuid,
  client_id uuid,
  creator_user_id uuid,
  event_type text,
  review_deadline_at timestamptz,
  project_title text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_event_id uuid;
  v_event_type text;
begin
  for v_candidate in
    select delivery.id as delivery_id,
      delivery.project_id,
      project.client_id,
      delivery.creator_user_id,
      delivery.review_deadline_at,
      project.title
    from public.project_deliveries delivery
    join public.projects project on project.id = delivery.project_id
    where delivery.status = 'under_review'
      and delivery.review_deadline_at <= now() + interval '48 hours'
      and not exists (
        select 1 from public.project_delivery_holds hold
        where hold.delivery_id = delivery.id and hold.active
      )
      and not exists (
        select 1 from public.disputes dispute
        join public.transactions txn on txn.id = dispute.transaction_id
        where txn.project_id = delivery.project_id and dispute.status = 'open'
      )
    order by delivery.review_deadline_at
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  loop
    v_event_type := case
      when v_candidate.review_deadline_at <= now() then 'auto_approve'
      when v_candidate.review_deadline_at <= now() + interval '24 hours' then 'reminder_24h'
      else 'reminder_48h'
    end;

    insert into public.project_delivery_events (delivery_id, event_type)
    values (v_candidate.delivery_id, v_event_type)
    on conflict (delivery_id, event_type) do update
      set status = 'claimed', attempts = project_delivery_events.attempts + 1,
          claimed_at = now(), processed_at = null, error = null, updated_at = now()
      where project_delivery_events.status = 'failed'
         or project_delivery_events.claimed_at < now() - interval '30 minutes'
    returning id into v_event_id;

    if v_event_id is not null then
      event_id := v_event_id;
      delivery_id := v_candidate.delivery_id;
      project_id := v_candidate.project_id;
      client_id := v_candidate.client_id;
      creator_user_id := v_candidate.creator_user_id;
      event_type := v_event_type;
      review_deadline_at := v_candidate.review_deadline_at;
      project_title := v_candidate.title;
      return next;
    end if;
    v_event_id := null;
  end loop;
end;
$$;

create or replace function public.complete_project_delivery_event(
  p_event_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_delivery_events
  set status = case when p_succeeded then 'processed' else 'failed' end,
      processed_at = case when p_succeeded then now() else null end,
      error = case when p_succeeded then null else left(coalesce(p_error, 'Unknown processing error'), 2000) end,
      updated_at = now()
  where id = p_event_id and status = 'claimed';
end;
$$;

create or replace function public.approve_project_delivery(
  p_project_id uuid,
  p_delivery_id uuid
)
returns public.project_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.project_deliveries%rowtype;
  v_project public.projects%rowtype;
  v_creator_user_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if v_project.client_id is distinct from auth.uid() then
    raise exception 'Only the project client can approve delivery' using errcode = '42501';
  end if;
  select * into v_delivery from public.project_deliveries
  where id = p_delivery_id and project_id = p_project_id for update;
  if not found or v_delivery.status <> 'under_review' then
    raise exception 'Delivery is not awaiting approval' using errcode = '55000';
  end if;
  if exists (select 1 from public.project_delivery_holds where delivery_id = p_delivery_id and active) then
    raise exception 'Delivery approval is paused by an active hold' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.disputes dispute
    join public.transactions txn on txn.id = dispute.transaction_id
    where txn.project_id = p_project_id and dispute.status = 'open'
  ) then raise exception 'Delivery approval is paused by a dispute' using errcode = '55000'; end if;

  update public.project_deliveries
  set status = 'approved', approved_at = v_now, approval_source = 'client',
      retention_expires_at = v_now + interval '7 days', updated_at = v_now
  where id = p_delivery_id returning * into v_delivery;
  update public.projects set status = 'approved', approved_at = v_now where id = p_project_id;
  insert into public.project_delivery_events (delivery_id, event_type, status, processed_at)
  values (p_delivery_id, 'client_approve', 'processed', v_now)
  on conflict (delivery_id, event_type) do nothing;

  select user_id into v_creator_user_id from public.creator_listings
  where id::text = v_project.accepted_creator_id::text;
  perform public.create_platform_notification(
    v_creator_user_id, 'system', 'Delivery approved',
    'The client approved the delivery. CreatorBridge is attempting the final payment.',
    '/projects?project=' || p_project_id::text,
    jsonb_build_object('project_id', p_project_id, 'delivery_id', p_delivery_id),
    auth.uid(), null
  );
  return v_delivery;
end;
$$;

create or replace function public.complete_project_delivery_auto_approval(
  p_event_id uuid,
  p_delivery_id uuid
)
returns public.project_deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.project_deliveries%rowtype;
  v_now timestamptz := now();
begin
  perform 1 from public.project_delivery_events
  where id = p_event_id and delivery_id = p_delivery_id
    and event_type = 'auto_approve' and status = 'claimed'
  for update;
  if not found then raise exception 'Auto-approval event is not claimable' using errcode = '55000'; end if;
  select * into v_delivery from public.project_deliveries where id = p_delivery_id for update;
  if not found or v_delivery.status <> 'under_review' or v_delivery.review_deadline_at > v_now then
    raise exception 'Delivery is not due for auto-approval' using errcode = '55000';
  end if;
  if exists (select 1 from public.project_delivery_holds where delivery_id = p_delivery_id and active) then
    raise exception 'Delivery has an active hold' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.disputes dispute
    join public.transactions txn on txn.id = dispute.transaction_id
    where txn.project_id = v_delivery.project_id and dispute.status = 'open'
  ) then raise exception 'Delivery has an active dispute' using errcode = '55000'; end if;

  update public.project_deliveries
  set status = 'approved', approved_at = v_now, approval_source = 'automatic',
      retention_expires_at = v_now + interval '7 days', updated_at = v_now
  where id = p_delivery_id returning * into v_delivery;
  update public.projects set status = 'approved', approved_at = v_now where id = v_delivery.project_id;
  update public.project_delivery_events
  set status = 'processed', processed_at = v_now, error = null, updated_at = v_now
  where id = p_event_id;
  return v_delivery;
end;
$$;

create or replace function private.hold_delivery_for_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.project_deliveries%rowtype;
  v_project public.projects%rowtype;
  v_creator_user_id uuid;
  v_conversation public.project_conversations%rowtype;
begin
  select * into v_delivery from public.project_deliveries where id = new.delivery_id;
  select * into v_project from public.projects where id = new.project_id;
  select user_id into v_creator_user_id from public.creator_listings
  where id::text = v_project.accepted_creator_id::text;
  update public.project_deliveries
  set status = 'revision_requested', review_paused_at = now(), updated_at = now()
  where id = new.delivery_id and status = 'under_review';
  insert into public.project_delivery_holds (delivery_id, hold_type, reason, created_by)
  values (new.delivery_id, 'revision', 'Revision request ' || new.id::text, new.client_id)
  on conflict (delivery_id, hold_type) where active do nothing;
  insert into public.project_conversations (project_id, client_id, creator_user_id)
  values (v_project.id, v_project.client_id, v_creator_user_id)
  on conflict (project_id) do update set project_id = excluded.project_id
  returning * into v_conversation;
  insert into public.messages (
    conversation_id, sender_id, recipient_id, project_id, delivery_id,
    message_type, pinned, body, read
  ) values (
    v_conversation.conversation_id, new.client_id, v_creator_user_id, new.project_id, new.delivery_id,
    'revision', true,
    case when new.source_type = 'included'
      then 'Included revision ' || new.included_ordinal::text || ' of 2 was requested. The review clock is paused.'
      else 'A paid additional revision was requested. The review clock is paused.' end,
    false
  );
  perform public.create_platform_notification(
    v_creator_user_id, 'system', 'Revision requested',
    'Open the project to review the client instructions.',
    '/projects?project=' || new.project_id::text,
    jsonb_build_object('project_id', new.project_id, 'delivery_id', new.delivery_id, 'revision_request_id', new.id),
    new.client_id, null
  );
  return new;
end;
$$;

create trigger hold_delivery_for_revision
after insert on public.project_revision_requests
for each row execute function private.hold_delivery_for_revision();

create or replace function private.hold_delivery_for_dispute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_delivery_id uuid;
begin
  if new.status <> 'open' then return new; end if;
  select project_id into v_project_id from public.transactions where id = new.transaction_id;
  select id into v_delivery_id from public.project_deliveries
  where project_id = v_project_id and status = 'under_review'
  order by version desc limit 1 for update;
  if v_delivery_id is null then return new; end if;
  update public.project_deliveries
  set status = 'disputed', review_paused_at = now(), updated_at = now()
  where id = v_delivery_id;
  insert into public.project_delivery_holds (delivery_id, hold_type, reason, created_by)
  values (v_delivery_id, 'dispute', 'Dispute ' || new.id::text, new.raised_by)
  on conflict (delivery_id, hold_type) where active do nothing;
  update public.projects set status = 'disputed' where id = v_project_id;
  return new;
end;
$$;

create trigger hold_delivery_for_dispute
after insert on public.disputes
for each row execute function private.hold_delivery_for_dispute();

create or replace function private.release_revision_hold_on_resubmission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'under_review' then
    update public.project_delivery_holds hold
    set active = false, released_at = now(), released_by = new.creator_user_id
    from public.project_deliveries held_delivery
    where held_delivery.id = hold.delivery_id
      and held_delivery.project_id = new.project_id
      and hold.hold_type = 'revision' and hold.active;
  end if;
  return new;
end;
$$;

create trigger release_revision_hold_on_resubmission
after update of status on public.project_deliveries
for each row execute function private.release_revision_hold_on_resubmission();

create or replace function public.claim_project_delivery_cleanup(p_limit integer default 50)
returns table (event_id uuid, delivery_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery record;
  v_event_id uuid;
begin
  for v_delivery in
    select delivery.id
    from public.project_deliveries delivery
    where delivery.status = 'approved'
      and delivery.retention_expires_at <= now()
      and (delivery.cleanup_claimed_at is null or delivery.cleanup_claimed_at < now() - interval '30 minutes')
      and exists (
        select 1 from public.project_delivery_items item
        where item.delivery_id = delivery.id and item.item_type = 'direct' and item.upload_status = 'uploaded'
      )
      and not exists (
        select 1 from public.project_delivery_holds hold
        where hold.delivery_id = delivery.id and hold.active
      )
      and not exists (
        select 1 from public.disputes dispute
        join public.transactions txn on txn.id = dispute.transaction_id
        where txn.project_id = delivery.project_id and dispute.status = 'open'
      )
    order by delivery.retention_expires_at
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  loop
    insert into public.project_delivery_events (delivery_id, event_type)
    values (v_delivery.id, 'cleanup')
    on conflict (delivery_id, event_type) do update
      set status = 'claimed', attempts = project_delivery_events.attempts + 1,
          claimed_at = now(), processed_at = null, error = null, updated_at = now()
      where project_delivery_events.status = 'failed'
         or project_delivery_events.claimed_at < now() - interval '30 minutes'
    returning id into v_event_id;
    if v_event_id is not null then
      update public.project_deliveries
      set cleanup_claimed_at = now(), cleanup_attempts = cleanup_attempts + 1, cleanup_last_error = null
      where id = v_delivery.id;
      event_id := v_event_id;
      delivery_id := v_delivery.id;
      return next;
    end if;
    v_event_id := null;
  end loop;
end;
$$;

revoke all on function public.claim_project_review_events(integer) from public, anon, authenticated;
revoke all on function public.complete_project_delivery_event(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.complete_project_delivery_auto_approval(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_project_delivery_cleanup(integer) from public, anon, authenticated;
revoke all on function public.approve_project_delivery(uuid, uuid) from public, anon;
grant execute on function public.claim_project_review_events(integer) to service_role;
grant execute on function public.complete_project_delivery_event(uuid, boolean, text) to service_role;
grant execute on function public.complete_project_delivery_auto_approval(uuid, uuid) to service_role;
grant execute on function public.claim_project_delivery_cleanup(integer) to service_role;
grant execute on function public.approve_project_delivery(uuid, uuid) to authenticated, service_role;

select cron.unschedule(jobid) from cron.job where jobname in (
  'creatorbridge-process-project-reviews', 'creatorbridge-cleanup-project-deliveries'
);

select cron.schedule(
  'creatorbridge-process-project-reviews',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'creatorbridge_project_reviews_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-platform-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'creatorbridge_job_secret')
      ),
      body := '{"source":"supabase-cron"}'::jsonb
    );
  $cron$
);

select cron.schedule(
  'creatorbridge-cleanup-project-deliveries',
  '17 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'creatorbridge_project_cleanup_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-platform-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'creatorbridge_job_secret')
      ),
      body := '{"source":"supabase-cron"}'::jsonb
    );
  $cron$
);
