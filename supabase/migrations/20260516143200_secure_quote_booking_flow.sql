-- Harden quote requests and booking/project brief creation.
-- Clients can ask the browser to create records, but the database now verifies
-- the authenticated user, listing existence, required fields, and budget shape.

alter table public.projects
  add column if not exists project_duration text;

drop policy if exists "Authenticated clients can send quote requests" on public.quote_requests;
drop policy if exists "Anyone can send quote requests" on public.quote_requests;
drop policy if exists "Anyone can insert quotes" on public.quote_requests;

drop policy if exists "Clients can manage own projects" on public.projects;
drop policy if exists "Clients can update own projects" on public.projects;
drop policy if exists "Clients can delete own open projects" on public.projects;

create policy "Clients can update own projects"
  on public.projects
  for update
  to authenticated
  using (client_id = (select auth.uid()))
  with check (client_id = (select auth.uid()));

create policy "Clients can delete own open projects"
  on public.projects
  for delete
  to authenticated
  using (
    client_id = (select auth.uid())
    and coalesce(status, 'open') in ('open', 'draft')
  );

create or replace function public.create_project_brief(
  p_title text,
  p_service_id text,
  p_description text,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_project_duration text default null,
  p_timeline text default null,
  p_location text default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_budget_min numeric := greatest(coalesce(p_budget_min, 0), 0);
  v_budget_max numeric := greatest(coalesce(p_budget_max, 0), 0);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Project title is required';
  end if;

  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Project description is required';
  end if;

  if v_budget_max > 0 and v_budget_min > v_budget_max then
    raise exception 'Minimum budget cannot exceed maximum budget';
  end if;

  insert into public.projects (
    client_id,
    title,
    service_id,
    description,
    budget_min,
    budget_max,
    project_duration,
    location,
    timeline,
    status,
    applications
  )
  values (
    v_user_id,
    left(trim(p_title), 120),
    left(trim(coalesce(p_service_id, '')), 80),
    left(trim(p_description), 4000),
    nullif(v_budget_min, 0),
    nullif(v_budget_max, 0),
    nullif(left(trim(coalesce(p_project_duration, '')), 80), ''),
    nullif(left(trim(coalesce(p_location, '')), 160), ''),
    nullif(left(trim(coalesce(p_timeline, '')), 80), ''),
    'open',
    0
  )
  returning * into v_project;

  return v_project;
end;
$$;

create or replace function public.submit_quote_request(
  p_listing_id uuid default null,
  p_project_title text default null,
  p_service_id text default null,
  p_description text default null,
  p_timeline text default null,
  p_budget numeric default null,
  p_project_type text default null,
  p_project_time text default null,
  p_venue_address text default null,
  p_venue_city text default null,
  p_venue_state text default null,
  p_venue_type text default null,
  p_hours_needed text default null,
  p_deliverables text default null,
  p_budget_range text default null,
  p_location_preference text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_client_name text;
  v_project public.projects%rowtype;
  v_quote public.quote_requests%rowtype;
  v_budget numeric := greatest(coalesce(p_budget, p_budget_max, p_budget_min, 0), 0);
  v_budget_min numeric := greatest(coalesce(p_budget_min, 0), 0);
  v_budget_max numeric := greatest(coalesce(p_budget_max, p_budget, 0), 0);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_project_title, ''))) = 0 then
    raise exception 'Project title is required';
  end if;

  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Project description is required';
  end if;

  if p_listing_id is not null and not exists (
    select 1 from public.creator_listings where id = p_listing_id
  ) then
    raise exception 'Creator listing not found';
  end if;

  if v_budget_max > 0 and v_budget_min > v_budget_max then
    raise exception 'Minimum budget cannot exceed maximum budget';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');

  select coalesce(full_name, split_part(v_email, '@', 1), 'Client')
  into v_client_name
  from public.profiles
  where id = v_user_id;

  v_client_name := coalesce(v_client_name, 'Client');

  insert into public.projects (
    client_id,
    title,
    service_id,
    description,
    budget_min,
    budget_max,
    project_duration,
    location,
    timeline,
    status,
    applications
  )
  values (
    v_user_id,
    left(trim(p_project_title), 120),
    left(trim(coalesce(p_service_id, '')), 80),
    left(trim(p_description), 4000),
    nullif(v_budget_min, 0),
    nullif(v_budget_max, 0),
    nullif(left(trim(coalesce(p_hours_needed, '')), 80), ''),
    nullif(left(trim(coalesce(p_location, p_venue_city, '')), 160), ''),
    nullif(left(trim(coalesce(p_timeline, '')), 80), ''),
    'open',
    0
  )
  returning * into v_project;

  insert into public.quote_requests (
    listing_id,
    client_id,
    client_name,
    client_email,
    service_id,
    description,
    timeline,
    budget,
    project_title,
    project_type,
    project_time,
    venue_address,
    venue_city,
    venue_state,
    venue_type,
    hours_needed,
    deliverables,
    budget_range,
    location_preference,
    status,
    read
  )
  values (
    p_listing_id,
    v_user_id,
    left(trim(v_client_name), 120),
    left(trim(v_email), 254),
    left(trim(coalesce(p_service_id, '')), 80),
    left(trim(p_description), 4000),
    nullif(left(trim(coalesce(p_timeline, '')), 80), ''),
    nullif(v_budget, 0),
    left(trim(p_project_title), 120),
    nullif(left(trim(coalesce(p_project_type, '')), 120), ''),
    nullif(left(trim(coalesce(p_project_time, '')), 80), ''),
    nullif(left(trim(coalesce(p_venue_address, '')), 180), ''),
    nullif(left(trim(coalesce(p_venue_city, '')), 100), ''),
    nullif(left(trim(coalesce(p_venue_state, '')), 80), ''),
    nullif(left(trim(coalesce(p_venue_type, '')), 80), ''),
    nullif(left(trim(coalesce(p_hours_needed, '')), 80), ''),
    nullif(left(trim(coalesce(p_deliverables, '')), 80), ''),
    nullif(left(trim(coalesce(p_budget_range, '')), 80), ''),
    nullif(left(trim(coalesce(p_location_preference, '')), 80), ''),
    'pending',
    false
  )
  returning * into v_quote;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'quote', to_jsonb(v_quote)
  );
end;
$$;

revoke all on function public.create_project_brief(text, text, text, numeric, numeric, text, text, text) from public;
grant execute on function public.create_project_brief(text, text, text, numeric, numeric, text, text, text) to authenticated;

revoke all on function public.submit_quote_request(uuid, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text) from public;
grant execute on function public.submit_quote_request(uuid, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text) to authenticated;
