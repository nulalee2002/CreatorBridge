create table if not exists public.collaboration_workspace_links (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.creator_collaborations(id) on delete cascade,
  workspace_type text not null check (workspace_type in ('client_delivery', 'production_team')),
  provider text not null check (provider in ('google_drive', 'dropbox', 'frame_io', 'blackmagic_cloud', 'masv')),
  normalized_url text not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (collaboration_id, workspace_type, version)
);

create unique index if not exists collaboration_workspace_one_active_per_type
  on public.collaboration_workspace_links (collaboration_id, workspace_type)
  where active;

create table if not exists public.collaboration_workspace_link_history (
  id uuid primary key default gen_random_uuid(),
  workspace_link_id uuid not null references public.collaboration_workspace_links(id) on delete cascade,
  collaboration_id uuid not null references public.creator_collaborations(id) on delete cascade,
  workspace_type text not null check (workspace_type in ('client_delivery', 'production_team')),
  version integer not null check (version > 0),
  normalized_url text not null,
  action text not null check (action in ('created', 'replaced', 'revoked')),
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (workspace_link_id, action, version)
);

create table if not exists public.collaboration_delivery_anchors (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.creator_collaborations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 0),
  note text,
  filenames text[] not null default '{}',
  sizes_bytes bigint[] not null default '{}',
  checksums jsonb not null default '{}',
  preview_reference text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'revision_requested', 'accepted', 'timed_release')),
  unique (collaboration_id, version)
);

alter table public.collaboration_workspace_links enable row level security;
alter table public.collaboration_workspace_link_history enable row level security;
alter table public.collaboration_delivery_anchors enable row level security;

grant select on public.collaboration_workspace_links, public.collaboration_workspace_link_history, public.collaboration_delivery_anchors to authenticated;
grant all on public.collaboration_workspace_links, public.collaboration_workspace_link_history, public.collaboration_delivery_anchors to service_role;
revoke insert, update, delete on public.collaboration_workspace_links, public.collaboration_workspace_link_history, public.collaboration_delivery_anchors from anon, authenticated;

create policy "Workspace members can read authorized links"
  on public.collaboration_workspace_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_collaborations c
      where c.id = collaboration_id
        and (
          (workspace_type = 'production_team' and (select auth.uid()) in (c.prime_user_id, c.collaborator_user_id))
          or (workspace_type = 'client_delivery' and (select auth.uid()) = c.prime_user_id)
          or public.is_platform_admin((select auth.uid()))
        )
    )
  );

create policy "Workspace members can read link history"
  on public.collaboration_workspace_link_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_collaborations c
      where c.id = collaboration_id
        and (
          (workspace_type = 'production_team' and (select auth.uid()) in (c.prime_user_id, c.collaborator_user_id))
          or (workspace_type = 'client_delivery' and (select auth.uid()) = c.prime_user_id)
          or public.is_platform_admin((select auth.uid()))
        )
    )
  );

create policy "Collaboration members can read deliveries"
  on public.collaboration_delivery_anchors
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_collaborations c
      where c.id = collaboration_id
        and ((select auth.uid()) in (c.prime_user_id, c.collaborator_user_id) or public.is_platform_admin((select auth.uid())))
    )
  );

create or replace function creatorbridge_private.normalize_workspace_url(p_url text)
returns table(provider text, normalized_url text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  u text := trim(coalesce(p_url, ''));
  h text;
begin
  if u !~* '^https://' then
    raise exception 'Workspace links must use HTTPS';
  end if;

  h := lower(substring(u from '^https://([^/:?#]+)'));

  if h in ('bit.ly', 'tinyurl.com', 't.co', 'shorturl.at', 'goo.gl', 'ow.ly', 'buff.ly', 'rebrand.ly') then
    raise exception 'Shortened links are not allowed';
  end if;

  provider := case
    when h = 'drive.google.com' then 'google_drive'
    when h = 'dropbox.com' or h like '%.dropbox.com' then 'dropbox'
    when h = 'frame.io' or h like '%.frame.io' then 'frame_io'
    when h = 'blackmagiccloud.com' or h like '%.blackmagiccloud.com' then 'blackmagic_cloud'
    when h = 'masv.io' or h like '%.masv.io' then 'masv'
    else null
  end;

  if provider is null then
    raise exception 'Unsupported workspace provider';
  end if;

  normalized_url := u;
  return next;
end
$$;

create or replace function public.save_collaboration_workspace_link(
  p_collaboration_id uuid,
  p_workspace_type text,
  p_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.creator_collaborations%rowtype;
  n record;
  old_link public.collaboration_workspace_links%rowtype;
  new_link public.collaboration_workspace_links%rowtype;
  uid uuid := (select auth.uid());
  next_version integer := 1;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into c
  from public.creator_collaborations
  where id = p_collaboration_id;

  if c.id is null then
    raise exception 'Collaboration not found';
  end if;

  if c.status not in ('funded', 'in_progress', 'delivered', 'revision', 'approved', 'completed') then
    raise exception 'Collaboration must be funded before workspace access';
  end if;

  if uid not in (c.prime_user_id, c.collaborator_user_id) then
    raise exception 'Not a collaboration member';
  end if;

  if p_workspace_type not in ('client_delivery', 'production_team') then
    raise exception 'Unsupported workspace type';
  end if;

  if p_workspace_type = 'client_delivery' and uid <> c.prime_user_id then
    raise exception 'Only the prime manages client delivery';
  end if;

  select * into n from creatorbridge_private.normalize_workspace_url(p_url);

  select * into old_link
  from public.collaboration_workspace_links
  where collaboration_id = p_collaboration_id
    and workspace_type = p_workspace_type
    and active
  limit 1;

  if old_link.id is not null then
    next_version := old_link.version + 1;

    update public.collaboration_workspace_links
    set active = false, revoked_at = now()
    where id = old_link.id;

    insert into public.collaboration_workspace_link_history (
      workspace_link_id, collaboration_id, workspace_type, version, normalized_url, action, actor_id
    ) values (
      old_link.id, p_collaboration_id, p_workspace_type, old_link.version, old_link.normalized_url, 'replaced', uid
    )
    on conflict do nothing;
  end if;

  insert into public.collaboration_workspace_links (
    collaboration_id, workspace_type, provider, normalized_url, version, created_by
  ) values (
    p_collaboration_id, p_workspace_type, n.provider, n.normalized_url, next_version, uid
  )
  returning * into new_link;

  insert into public.collaboration_workspace_link_history (
    workspace_link_id, collaboration_id, workspace_type, version, normalized_url, action, actor_id
  ) values (
    new_link.id, p_collaboration_id, p_workspace_type, new_link.version, new_link.normalized_url, 'created', uid
  );

  return new_link.id;
end
$$;

revoke all on function public.save_collaboration_workspace_link(uuid, text, text) from public, anon;
grant execute on function public.save_collaboration_workspace_link(uuid, text, text) to authenticated;

create or replace function public.revoke_collaboration_workspace_link(p_workspace_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.collaboration_workspace_links%rowtype;
  c public.creator_collaborations%rowtype;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into link_row
  from public.collaboration_workspace_links
  where id = p_workspace_link_id;

  if link_row.id is null then
    raise exception 'Workspace link not found';
  end if;

  select * into c
  from public.creator_collaborations
  where id = link_row.collaboration_id;

  if uid not in (c.prime_user_id, c.collaborator_user_id) and not public.is_platform_admin(uid) then
    raise exception 'Not a collaboration member';
  end if;

  if link_row.workspace_type = 'client_delivery' and uid <> c.prime_user_id and not public.is_platform_admin(uid) then
    raise exception 'Only the prime manages client delivery';
  end if;

  update public.collaboration_workspace_links
  set active = false, revoked_at = now()
  where id = p_workspace_link_id and active;

  insert into public.collaboration_workspace_link_history (
    workspace_link_id, collaboration_id, workspace_type, version, normalized_url, action, actor_id
  ) values (
    link_row.id, link_row.collaboration_id, link_row.workspace_type, link_row.version, link_row.normalized_url, 'revoked', uid
  )
  on conflict do nothing;
end
$$;

revoke all on function public.revoke_collaboration_workspace_link(uuid) from public, anon;
grant execute on function public.revoke_collaboration_workspace_link(uuid) to authenticated;

create or replace function public.submit_collaboration_delivery(
  p_collaboration_id uuid,
  p_note text,
  p_filenames text[],
  p_sizes_bytes bigint[] default '{}',
  p_checksums jsonb default '{}',
  p_preview_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.creator_collaborations%rowtype;
  v_id uuid;
  v_version integer;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into c
  from public.creator_collaborations
  where id = p_collaboration_id;

  if c.id is null then
    raise exception 'Collaboration not found';
  end if;

  if c.collaborator_user_id <> uid or c.status not in ('in_progress', 'revision') then
    raise exception 'Only the active collaborator can submit delivery';
  end if;

  if coalesce(array_length(p_filenames, 1), 0) = 0 and nullif(trim(coalesce(p_preview_reference, '')), '') is null then
    raise exception 'Delivery requires filenames or a preview reference';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.collaboration_delivery_anchors
  where collaboration_id = p_collaboration_id;

  insert into public.collaboration_delivery_anchors (
    collaboration_id, submitted_by, version, note, filenames, sizes_bytes, checksums, preview_reference
  ) values (
    p_collaboration_id,
    uid,
    v_version,
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_filenames, '{}'),
    coalesce(p_sizes_bytes, '{}'),
    coalesce(p_checksums, '{}'),
    nullif(trim(coalesce(p_preview_reference, '')), '')
  )
  returning id into v_id;

  update public.creator_collaborations
  set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = p_collaboration_id;

  return v_id;
end
$$;

revoke all on function public.submit_collaboration_delivery(uuid, text, text[], bigint[], jsonb, text) from public, anon;
grant execute on function public.submit_collaboration_delivery(uuid, text, text[], bigint[], jsonb, text) to authenticated;
