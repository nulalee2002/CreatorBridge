alter table public.creator_listings
  add column if not exists open_to_creator_collaborations boolean not null default true;
alter table public.profiles
  add column if not exists collaboration_intro_seen_at timestamptz;

create table if not exists public.creator_collaborations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prime_user_id uuid not null references auth.users(id) on delete restrict,
  prime_listing_id uuid not null references public.creator_listings(id) on delete restrict,
  collaborator_user_id uuid not null references auth.users(id) on delete restrict,
  collaborator_listing_id uuid not null references public.creator_listings(id) on delete restrict,
  service_category text not null,
  scope text not null,
  amount_cents integer not null check (amount_cents >= 25000),
  deadline date not null,
  workspace_provider text,
  project_context text not null check (project_context in ('existing_project', 'standalone')),
  status text not null default 'invited' check (status in (
    'invited', 'accepted', 'funding_pending', 'funded', 'in_progress', 'delivered',
    'revision', 'approved', 'disputed', 'completed', 'declined', 'cancelled'
  )),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  funded_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (prime_user_id <> collaborator_user_id)
);

create index if not exists idx_creator_collaborations_prime on public.creator_collaborations(prime_user_id, status);
create index if not exists idx_creator_collaborations_collaborator on public.creator_collaborations(collaborator_user_id, status);
create index if not exists idx_creator_collaborations_project on public.creator_collaborations(project_id, status);

alter table public.creator_collaborations enable row level security;
grant select on public.creator_collaborations to authenticated;
grant all on public.creator_collaborations to service_role;
revoke insert, update, delete on public.creator_collaborations from anon, authenticated;

drop policy if exists "Creator collaboration members can read" on public.creator_collaborations;
create policy "Creator collaboration members can read"
  on public.creator_collaborations for select to authenticated
  using (
    (select auth.uid()) in (prime_user_id, collaborator_user_id)
    or public.is_platform_admin((select auth.uid()))
  );

create or replace function public.create_creator_collaboration(
  p_collaborator_listing_id uuid,
  p_project_id uuid,
  p_scope text,
  p_amount_cents integer,
  p_deadline date,
  p_service_category text,
  p_workspace_provider text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prime_user_id uuid := (select auth.uid());
  v_prime_listing public.creator_listings%rowtype;
  v_collaborator public.creator_listings%rowtype;
  v_project_id uuid := p_project_id;
  v_context text := 'existing_project';
  v_collaboration_id uuid;
begin
  if v_prime_user_id is null or not creatorbridge_private.has_account_capability(v_prime_user_id, 'creator') then
    raise exception 'A verified creator account is required';
  end if;

  select * into v_prime_listing from public.creator_listings
  where user_id = v_prime_user_id and review_status = 'approved'
  order by updated_at desc nulls last limit 1;
  if v_prime_listing.id is null then raise exception 'An approved creator profile is required'; end if;

  select * into v_collaborator from public.creator_listings
  where id = p_collaborator_listing_id
    and review_status = 'approved'
    and open_to_creator_collaborations = true;
  if v_collaborator.id is null then raise exception 'This creator is not available for collaboration'; end if;
  if v_collaborator.user_id = v_prime_user_id then raise exception 'You cannot hire yourself'; end if;
  if p_amount_cents < 25000 then
    -- The browser records collaboration.sub_floor_attempted before this authoritative rejection.
    raise exception 'Creator collaborations have a $250 minimum';
  end if;
  if length(trim(coalesce(p_scope, ''))) < 20 then raise exception 'Add a clear collaboration scope'; end if;
  if p_deadline is null or p_deadline <= current_date then raise exception 'Choose a future deadline'; end if;

  if v_project_id is null then
    v_context := 'standalone';
    insert into public.projects (client_id, title, description, budget_min, budget_max, status)
    values (null, 'Creator collaboration', p_scope, p_amount_cents / 100.0, p_amount_cents / 100.0, 'collaboration_draft')
    returning id into v_project_id;
  elsif not creatorbridge_private.is_project_participant(
    v_project_id, v_prime_user_id, array['prime_contractor']::text[]
  ) then
    raise exception 'Only the prime creator can add collaborators to this project';
  end if;

  insert into public.project_participants (
    project_id, user_id, participant_role, creator_listing_id, status, joined_at
  ) values (
    v_project_id, v_prime_user_id, 'prime_contractor', v_prime_listing.id, 'active', now()
  ) on conflict (project_id, user_id) do update set
    participant_role = 'prime_contractor', creator_listing_id = excluded.creator_listing_id,
    status = 'active', updated_at = now();

  insert into public.project_participants (
    project_id, user_id, participant_role, creator_listing_id, status, invited_by
  ) values (
    v_project_id, v_collaborator.user_id, 'subcontractor', v_collaborator.id, 'invited', v_prime_user_id
  ) on conflict (project_id, user_id) do update set
    participant_role = 'subcontractor', creator_listing_id = excluded.creator_listing_id,
    status = 'invited', invited_by = excluded.invited_by, updated_at = now();

  insert into public.creator_collaborations (
    project_id, prime_user_id, prime_listing_id, collaborator_user_id, collaborator_listing_id,
    service_category, scope, amount_cents, deadline, workspace_provider, project_context
  ) values (
    v_project_id, v_prime_user_id, v_prime_listing.id, v_collaborator.user_id, v_collaborator.id,
    trim(p_service_category), trim(p_scope), p_amount_cents, p_deadline, nullif(trim(p_workspace_provider), ''), v_context
  ) returning id into v_collaboration_id;

  return v_collaboration_id;
end;
$$;

create or replace function public.respond_creator_collaboration(p_collaboration_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  update public.creator_collaborations set
    status = case when p_accept then 'accepted' else 'declined' end,
    accepted_at = case when p_accept then now() else null end,
    updated_at = now()
  where id = p_collaboration_id and collaborator_user_id = v_user_id and status = 'invited';
  if not found then raise exception 'Invitation is unavailable'; end if;
  update public.project_participants set status = case when p_accept then 'active' else 'declined' end,
    joined_at = case when p_accept then now() else joined_at end, updated_at = now()
  where project_id = (select project_id from public.creator_collaborations where id = p_collaboration_id)
    and user_id = v_user_id;
end; $$;

create or replace function public.transition_creator_collaboration(p_collaboration_id uuid, p_next_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.creator_collaborations%rowtype; v_user_id uuid := (select auth.uid());
begin
  select * into v_row from public.creator_collaborations where id = p_collaboration_id;
  if v_row.id is null then raise exception 'Collaboration not found'; end if;
  if p_next_status = 'delivered' then
    if v_user_id <> v_row.collaborator_user_id or v_row.status <> 'in_progress' then raise exception 'Invalid delivery transition'; end if;
  elsif p_next_status in ('funding_pending','in_progress','revision','approved','cancelled') then
    if v_user_id <> v_row.prime_user_id then raise exception 'Only the prime creator can manage this collaboration'; end if;
    if not (
      (p_next_status = 'funding_pending' and v_row.status = 'accepted') or
      (p_next_status = 'in_progress' and v_row.status = 'funded') or
      (p_next_status = 'revision' and v_row.status = 'delivered') or
      (p_next_status = 'approved' and v_row.status in ('delivered','revision')) or
      (p_next_status = 'cancelled' and v_row.status in ('invited','accepted','funding_pending'))
    ) then raise exception 'Invalid collaboration transition'; end if;
  else raise exception 'Unsupported collaboration transition';
  end if;
  update public.creator_collaborations set status = p_next_status, updated_at = now() where id = p_collaboration_id;
end; $$;

create or replace function public.mark_collaboration_intro_seen()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set collaboration_intro_seen_at = coalesce(collaboration_intro_seen_at, now())
  where id = (select auth.uid());
$$;

revoke all on function public.create_creator_collaboration(uuid, uuid, text, integer, date, text, text) from public, anon;
revoke all on function public.respond_creator_collaboration(uuid, boolean) from public, anon;
revoke all on function public.transition_creator_collaboration(uuid, text) from public, anon;
revoke all on function public.mark_collaboration_intro_seen() from public, anon;
grant execute on function public.create_creator_collaboration(uuid, uuid, text, integer, date, text, text) to authenticated;
grant execute on function public.respond_creator_collaboration(uuid, boolean) to authenticated;
grant execute on function public.transition_creator_collaboration(uuid, text) to authenticated;
grant execute on function public.mark_collaboration_intro_seen() to authenticated;
