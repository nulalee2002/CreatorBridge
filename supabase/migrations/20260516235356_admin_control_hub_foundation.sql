-- CreatorBridge admin control hub foundation.
-- This pass is intentionally read-only. Approval, deletion, and money movement
-- controls should be added only after the owner visibility layer is verified.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  note text
);

alter table public.platform_admins enable row level security;
grant select on table public.platform_admins to authenticated;

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_requester_is_admin boolean := false;
begin
  if p_user_id is null or v_requester is null then
    return false;
  end if;

  select exists (
    select 1
    from public.platform_admins
    where user_id = v_requester
  ) into v_requester_is_admin;

  if p_user_id <> v_requester and not v_requester_is_admin then
    return false;
  end if;

  return exists (
    select 1
    from public.platform_admins
    where user_id = p_user_id
  );
end;
$$;

revoke all on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;

insert into public.platform_admins (user_id, note)
select id, 'CreatorBridge owner admin'
from auth.users
where lower(email) = 'drl33@creatorbridge.studio'
on conflict (user_id) do nothing;

drop policy if exists "Platform admins can read admin roster" on public.platform_admins;
create policy "Platform admins can read admin roster"
  on public.platform_admins
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.profiles to authenticated;
drop policy if exists "Platform admins can read profiles" on public.profiles;
create policy "Platform admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.creator_listings to authenticated;
drop policy if exists "Platform admins can read creator_listings" on public.creator_listings;
create policy "Platform admins can read creator_listings"
  on public.creator_listings
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.creator_services to authenticated;
drop policy if exists "Platform admins can read creator_services" on public.creator_services;
create policy "Platform admins can read creator_services"
  on public.creator_services
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.portfolio_items to authenticated;
drop policy if exists "Platform admins can read portfolio_items" on public.portfolio_items;
create policy "Platform admins can read portfolio_items"
  on public.portfolio_items
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.packages to authenticated;
drop policy if exists "Platform admins can read packages" on public.packages;
create policy "Platform admins can read packages"
  on public.packages
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.availability to authenticated;
drop policy if exists "Platform admins can read availability" on public.availability;
create policy "Platform admins can read availability"
  on public.availability
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.client_profiles to authenticated;
drop policy if exists "Platform admins can read client_profiles" on public.client_profiles;
create policy "Platform admins can read client_profiles"
  on public.client_profiles
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.projects to authenticated;
drop policy if exists "Platform admins can read projects" on public.projects;
create policy "Platform admins can read projects"
  on public.projects
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.project_applications to authenticated;
drop policy if exists "Platform admins can read project_applications" on public.project_applications;
create policy "Platform admins can read project_applications"
  on public.project_applications
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.quote_requests to authenticated;
drop policy if exists "Platform admins can read quote_requests" on public.quote_requests;
create policy "Platform admins can read quote_requests"
  on public.quote_requests
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.messages to authenticated;
drop policy if exists "Platform admins can read messages" on public.messages;
create policy "Platform admins can read messages"
  on public.messages
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.transactions to authenticated;
drop policy if exists "Platform admins can read transactions" on public.transactions;
create policy "Platform admins can read transactions"
  on public.transactions
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.payment_events to authenticated;
drop policy if exists "Platform admins can read payment_events" on public.payment_events;
create policy "Platform admins can read payment_events"
  on public.payment_events
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.disputes to authenticated;
drop policy if exists "Platform admins can read disputes" on public.disputes;
create policy "Platform admins can read disputes"
  on public.disputes
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.violations to authenticated;
drop policy if exists "Platform admins can read violations" on public.violations;
create policy "Platform admins can read violations"
  on public.violations
  for select
  to authenticated
  using (public.is_platform_admin());

grant select on table public.message_filter_events to authenticated;
drop policy if exists "Platform admins can read message_filter_events" on public.message_filter_events;
create policy "Platform admins can read message_filter_events"
  on public.message_filter_events
  for select
  to authenticated
  using (public.is_platform_admin());

create or replace function public.get_admin_platform_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalCreators', (select count(*) from public.creator_listings),
    'pendingCreators', (select count(*) from public.creator_listings where coalesce(review_status, 'pending_review') <> 'approved'),
    'approvedCreators', (select count(*) from public.creator_listings where review_status = 'approved'),
    'clientProfiles', (select count(*) from public.client_profiles),
    'openProjects', (select count(*) from public.projects where status = 'open'),
    'activeProjects', (select count(*) from public.projects where status in ('active', 'in_progress')),
    'quoteRequests', (select count(*) from public.quote_requests),
    'projectApplications', (select count(*) from public.project_applications),
    'paymentRecords', (select count(*) from public.transactions),
    'paymentEvents', (select count(*) from public.payment_events),
    'disputes', (select count(*) from public.disputes),
    'violations', (select count(*) from public.violations),
    'filterEvents', (select count(*) from public.message_filter_events)
  ) into v_summary;

  return v_summary;
end;
$$;

revoke all on function public.get_admin_platform_summary() from public;
grant execute on function public.get_admin_platform_summary() to authenticated;

create or replace function public.get_admin_creator_review_queue()
returns table (
  listing_id uuid,
  creator_user_id uuid,
  creator_name text,
  business_name text,
  city text,
  state text,
  review_status text,
  verification_status text,
  submitted_at timestamptz,
  years_experience integer,
  video_intro_url text,
  portfolio_count bigint,
  package_count bigint,
  service_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    cl.id as listing_id,
    cl.user_id as creator_user_id,
    cl.name as creator_name,
    cl.business_name,
    cl.city,
    cl.state,
    coalesce(cl.review_status, 'pending_review') as review_status,
    coalesce(cl.verification_status, 'unverified') as verification_status,
    cl.submitted_at,
    cl.years_experience,
    cl.video_intro_url,
    count(distinct pi.id) as portfolio_count,
    count(distinct pkg.id) as package_count,
    count(distinct cs.id) as service_count
  from public.creator_listings cl
  left join public.portfolio_items pi on pi.listing_id = cl.id
  left join public.packages pkg on pkg.listing_id = cl.id
  left join public.creator_services cs on cs.listing_id = cl.id
  where coalesce(cl.review_status, 'pending_review') <> 'approved'
  group by cl.id
  order by cl.submitted_at desc nulls last, cl.created_at desc nulls last
  limit 100;
end;
$$;

revoke all on function public.get_admin_creator_review_queue() from public;
grant execute on function public.get_admin_creator_review_queue() to authenticated;
