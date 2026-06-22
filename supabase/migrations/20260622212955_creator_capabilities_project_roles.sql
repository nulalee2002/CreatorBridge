-- Trusted account capabilities and project-role membership for creator collaboration.
-- profiles.role remains available as presentation metadata during the transition.

create schema if not exists creatorbridge_private;
revoke all on schema creatorbridge_private from public;

create table if not exists public.account_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability in ('client', 'creator', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, capability)
);

create table if not exists public.project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null check (
    participant_role in ('outside_client', 'prime_contractor', 'subcontractor')
  ),
  creator_listing_id uuid references public.creator_listings(id) on delete set null,
  status text not null default 'active' check (
    status in ('invited', 'active', 'declined', 'removed', 'completed')
  ),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists idx_account_capabilities_capability
  on public.account_capabilities (capability, user_id);
create index if not exists idx_project_participants_user
  on public.project_participants (user_id, status);
create index if not exists idx_project_participants_project_role
  on public.project_participants (project_id, participant_role, status);

alter table public.account_capabilities enable row level security;
alter table public.project_participants enable row level security;

create or replace function creatorbridge_private.has_account_capability(
  p_user_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_capability in ('client', 'creator', 'admin')
    and exists (
      select 1
      from public.account_capabilities capability
      where capability.user_id = p_user_id
        and capability.capability = p_capability
    );
$$;

create or replace function creatorbridge_private.is_project_participant(
  p_project_id uuid,
  p_user_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_project_id is not null
    and p_user_id is not null
    and exists (
      select 1
      from public.project_participants participant
      where participant.project_id = p_project_id
        and participant.user_id = p_user_id
        and participant.status in ('invited', 'active', 'completed')
        and (p_roles is null or participant.participant_role = any (p_roles))
    );
$$;

revoke all on function creatorbridge_private.has_account_capability(uuid, text) from public, anon;
revoke all on function creatorbridge_private.is_project_participant(uuid, uuid, text[]) from public, anon;
grant usage on schema creatorbridge_private to authenticated;
grant execute on function creatorbridge_private.has_account_capability(uuid, text) to authenticated;
grant execute on function creatorbridge_private.is_project_participant(uuid, uuid, text[]) to authenticated;

drop policy if exists "Members can read their account capabilities" on public.account_capabilities;
create policy "Members can read their account capabilities"
  on public.account_capabilities
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_admin((select auth.uid()))
  );

drop policy if exists "Project members can read permitted participants" on public.project_participants;
create policy "Project members can read permitted participants"
  on public.project_participants
  for select
  to authenticated
  using (
    public.is_platform_admin((select auth.uid()))
    or user_id = (select auth.uid())
    or creatorbridge_private.is_project_participant(
      project_id,
      (select auth.uid()),
      array['prime_contractor']::text[]
    )
    or (
      participant_role = 'prime_contractor'
      and creatorbridge_private.is_project_participant(
        project_id,
        (select auth.uid()),
        array['outside_client', 'subcontractor']::text[]
      )
    )
  );

grant select on table public.account_capabilities to authenticated;
grant select on table public.project_participants to authenticated;
grant all on table public.account_capabilities to service_role;
grant all on table public.project_participants to service_role;
revoke insert, update, delete on table public.account_capabilities from anon, authenticated;
revoke insert, update, delete on table public.project_participants from anon, authenticated;

insert into public.account_capabilities (user_id, capability)
select distinct listing.user_id, 'creator'
from public.creator_listings listing
where listing.user_id is not null
on conflict (user_id, capability) do nothing;

insert into public.account_capabilities (user_id, capability)
select distinct client.user_id, 'client'
from public.client_profiles client
where client.user_id is not null
on conflict (user_id, capability) do nothing;

insert into public.account_capabilities (user_id, capability)
select distinct project.client_id, 'client'
from public.projects project
where project.client_id is not null
on conflict (user_id, capability) do nothing;

insert into public.account_capabilities (user_id, capability, granted_by)
select distinct admin.user_id, 'admin', admin.created_by
from public.platform_admins admin
where admin.user_id is not null
on conflict (user_id, capability) do nothing;

insert into public.project_participants (
  project_id,
  user_id,
  participant_role,
  status,
  joined_at
)
select project.id, project.client_id, 'outside_client', 'active', project.created_at
from public.projects project
where project.client_id is not null
on conflict (project_id, user_id) do nothing;

insert into public.project_participants (
  project_id,
  user_id,
  participant_role,
  creator_listing_id,
  status,
  joined_at
)
select
  project.id,
  listing.user_id,
  'prime_contractor',
  listing.id,
  'active',
  coalesce(project.approved_at, project.created_at, now())
from public.projects project
join public.creator_listings listing
  on listing.id::text = project.accepted_creator_id
where project.accepted_creator_id is not null
  and listing.user_id is not null
on conflict (project_id, user_id) do nothing;

create or replace function creatorbridge_private.sync_account_capability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_capability text;
  v_granted_by uuid;
begin
  if tg_table_name = 'creator_listings' then
    v_user_id := new.user_id;
    v_capability := 'creator';
  elsif tg_table_name = 'client_profiles' then
    v_user_id := new.user_id;
    v_capability := 'client';
  elsif tg_table_name = 'platform_admins' then
    v_user_id := new.user_id;
    v_capability := 'admin';
    v_granted_by := new.created_by;
  elsif tg_table_name = 'projects' then
    v_user_id := new.client_id;
    v_capability := 'client';
  end if;

  if v_user_id is not null then
    insert into public.account_capabilities (user_id, capability, granted_by)
    values (v_user_id, v_capability, v_granted_by)
    on conflict (user_id, capability) do nothing;
  end if;

  return new;
end;
$$;

create or replace function creatorbridge_private.sync_project_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.creator_listings%rowtype;
begin
  if new.client_id is not null then
    insert into public.project_participants (
      project_id, user_id, participant_role, status, joined_at
    ) values (
      new.id, new.client_id, 'outside_client', 'active', coalesce(new.created_at, now())
    )
    on conflict (project_id, user_id) do nothing;
  end if;

  if new.accepted_creator_id is not null then
    select * into v_listing
    from public.creator_listings listing
    where listing.id::text = new.accepted_creator_id
    limit 1;

    if v_listing.id is not null and v_listing.user_id is not null then
      insert into public.project_participants (
        project_id, user_id, participant_role, creator_listing_id, status, joined_at
      ) values (
        new.id,
        v_listing.user_id,
        'prime_contractor',
        v_listing.id,
        'active',
        coalesce(new.approved_at, now())
      )
      on conflict (project_id, user_id) do update set
        participant_role = excluded.participant_role,
        creator_listing_id = excluded.creator_listing_id,
        status = excluded.status,
        joined_at = coalesce(public.project_participants.joined_at, excluded.joined_at),
        updated_at = now();
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function creatorbridge_private.sync_account_capability() from public, anon, authenticated;
revoke execute on function creatorbridge_private.sync_project_participants() from public, anon, authenticated;

drop trigger if exists sync_creator_capability on public.creator_listings;
create trigger sync_creator_capability
  after insert or update of user_id on public.creator_listings
  for each row execute function creatorbridge_private.sync_account_capability();

drop trigger if exists sync_client_capability on public.client_profiles;
create trigger sync_client_capability
  after insert or update of user_id on public.client_profiles
  for each row execute function creatorbridge_private.sync_account_capability();

drop trigger if exists sync_admin_capability on public.platform_admins;
create trigger sync_admin_capability
  after insert or update of user_id, created_by on public.platform_admins
  for each row execute function creatorbridge_private.sync_account_capability();

drop trigger if exists sync_project_roles on public.projects;
create trigger sync_project_roles
  after insert or update of client_id, accepted_creator_id on public.projects
  for each row execute function creatorbridge_private.sync_project_participants();

drop trigger if exists sync_project_client_capability on public.projects;
create trigger sync_project_client_capability
  after insert or update of client_id on public.projects
  for each row execute function creatorbridge_private.sync_account_capability();
