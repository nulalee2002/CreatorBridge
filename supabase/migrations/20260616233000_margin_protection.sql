-- Protect platform margin and creator time with a configurable booking floor.

create table if not exists public.platform_margin_settings (
  id boolean primary key default true check (id),
  minimum_project_budget_cents integer not null default 25000,
  minimum_platform_fee_cents integer not null default 500,
  updated_at timestamptz not null default now(),
  check (minimum_project_budget_cents >= 0),
  check (minimum_platform_fee_cents >= 0)
);

insert into public.platform_margin_settings (id, minimum_project_budget_cents, minimum_platform_fee_cents)
values (true, 25000, 500)
on conflict (id) do nothing;

alter table public.platform_margin_settings enable row level security;

drop policy if exists "Platform admins can manage margin settings" on public.platform_margin_settings;
create policy "Platform admins can manage margin settings"
  on public.platform_margin_settings
  for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on table public.platform_margin_settings to authenticated;
grant select on table public.platform_margin_settings to service_role;

create or replace function public.get_platform_margin_settings()
returns table (
  minimum_project_budget_cents integer,
  minimum_platform_fee_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(minimum_project_budget_cents, 25000) as minimum_project_budget_cents,
    coalesce(minimum_platform_fee_cents, 500) as minimum_platform_fee_cents
  from public.platform_margin_settings
  where id is true
  union all
  select 25000, 500
  limit 1
$$;

revoke all on function public.get_platform_margin_settings() from public;
grant execute on function public.get_platform_margin_settings() to authenticated, service_role;

alter table public.transactions
  add column if not exists minimum_platform_fee_applied integer not null default 0;

alter table public.creator_listings
  alter column minimum_project_budget set default 250;

update public.creator_listings
set minimum_project_budget = 250
where coalesce(minimum_project_budget, 0) < 250;

update public.packages
set price = 250
where coalesce(price, 0) < 250;

create or replace function public.margin_floor_dollars()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select (minimum_project_budget_cents::numeric / 100)
  from public.get_platform_margin_settings()
  limit 1
$$;

revoke all on function public.margin_floor_dollars() from public;
grant execute on function public.margin_floor_dollars() to authenticated, service_role;

create or replace function public.enforce_package_margin_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_floor numeric := public.margin_floor_dollars();
begin
  if coalesce(new.price, 0) < v_floor then
    raise exception 'Packages and proposals start at $250 on CreatorBridge. Please set this at $250 or more.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_package_margin_floor_trigger on public.packages;
create trigger enforce_package_margin_floor_trigger
  before insert or update of price on public.packages
  for each row execute function public.enforce_package_margin_floor();

create or replace function public.enforce_listing_margin_floor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_floor numeric := public.margin_floor_dollars();
begin
  if coalesce(new.minimum_project_budget, 0) < v_floor then
    raise exception 'Packages and proposals start at $250 on CreatorBridge. Please set this at $250 or more.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_listing_margin_floor_trigger on public.creator_listings;
create trigger enforce_listing_margin_floor_trigger
  before insert or update of minimum_project_budget on public.creator_listings
  for each row execute function public.enforce_listing_margin_floor();

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
  v_client public.client_profiles%rowtype;
  v_budget_min numeric := greatest(coalesce(p_budget_min, 0), 0);
  v_budget_max numeric := greatest(coalesce(p_budget_max, 0), 0);
  v_floor numeric := public.margin_floor_dollars();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
    into v_client
    from public.client_profiles
   where user_id = v_user_id;

  if v_client.user_id is null
    or length(trim(coalesce(v_client.display_name, ''))) = 0
    or v_client.tos_accepted_at is null
    or coalesce(v_client.phone_verified, false) is not true
    or v_client.phone_verified_at is null then
    raise exception 'Client phone verification is required before posting a project brief';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Project title is required';
  end if;

  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Project description is required';
  end if;

  if length(trim(coalesce(p_service_id, ''))) = 0 then
    raise exception 'Project service is required';
  end if;

  if v_budget_min <= 0 or v_budget_max <= 0 then
    raise exception 'Project budget is required before posting';
  end if;

  if v_budget_min > v_budget_max then
    raise exception 'Minimum budget cannot exceed maximum budget';
  end if;

  if v_budget_min < v_floor or v_budget_max < v_floor then
    raise exception 'Projects start at $250 on CreatorBridge. Please set your budget to $250 or more so your project is worth a professional creator''s time and fully covered by our protected payment process.';
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
    v_budget_min,
    v_budget_max,
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

revoke all on function public.create_project_brief(text, text, text, numeric, numeric, text, text, text) from public;
grant execute on function public.create_project_brief(text, text, text, numeric, numeric, text, text, text) to authenticated;

create or replace function public.apply_to_project(
  p_project_id uuid,
  p_listing_id uuid,
  p_message text,
  p_proposed_rate numeric default null
)
returns public.project_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_application public.project_applications%rowtype;
  v_proposed_rate numeric := greatest(coalesce(p_proposed_rate, 0), 0);
  v_floor numeric := public.margin_floor_dollars();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_message, ''))) = 0 then
    raise exception 'Proposal message is required';
  end if;

  if v_proposed_rate < v_floor then
    raise exception 'Packages and proposals start at $250 on CreatorBridge. Please set this at $250 or more.';
  end if;

  select *
  into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if coalesce(v_project.status, 'open') <> 'open' then
    raise exception 'This project is no longer accepting applications';
  end if;

  if not exists (
    select 1
    from public.creator_listings
    where id = p_listing_id
      and user_id = v_user_id
  ) then
    raise exception 'Creator listing not found for this user';
  end if;

  select *
  into v_application
  from public.project_applications
  where project_id = p_project_id
    and listing_id = p_listing_id
  order by created_at desc nulls last, id desc
  limit 1
  for update;

  if found then
    update public.project_applications
    set message = left(trim(p_message), 3000),
        proposed_rate = v_proposed_rate,
        status = case
          when status = 'accepted' then status
          else 'pending'
        end
    where id = v_application.id
    returning * into v_application;
  else
    insert into public.project_applications (
      project_id,
      listing_id,
      message,
      proposed_rate,
      status
    )
    values (
      p_project_id,
      p_listing_id,
      left(trim(p_message), 3000),
      v_proposed_rate,
      'pending'
    )
    returning * into v_application;
  end if;

  update public.projects
  set applications = (
    select count(*)
    from public.project_applications
    where project_id = p_project_id
  )
  where id = p_project_id;

  return v_application;
end;
$$;

revoke all on function public.apply_to_project(uuid, uuid, text, numeric) from public;
grant execute on function public.apply_to_project(uuid, uuid, text, numeric) to authenticated;

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
  v_creator_user_id uuid;
  v_floor numeric := public.margin_floor_dollars();
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

  if p_listing_id is not null then
    select user_id
    into v_creator_user_id
    from public.creator_listings
    where id = p_listing_id;

    if v_creator_user_id is null then
      raise exception 'Creator listing not found';
    end if;
  end if;

  if v_budget_max > 0 and v_budget_min > v_budget_max then
    raise exception 'Minimum budget cannot exceed maximum budget';
  end if;

  if v_budget < v_floor
    or (p_budget_min is not null and v_budget_min < v_floor)
    or (p_budget_max is not null and v_budget_max < v_floor) then
    raise exception 'Projects start at $250 on CreatorBridge. Please set your budget to $250 or more so your project is worth a professional creator''s time and fully covered by our protected payment process.';
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

  if v_creator_user_id is not null then
    perform public.create_platform_notification(
      v_creator_user_id,
      'quote_request_received',
      'New quote request',
      'A client sent you a quote request. Respond inside CreatorBridge within 24 hours.',
      '/dashboard',
      jsonb_build_object('project_id', v_project.id, 'quote_id', v_quote.id, 'listing_id', p_listing_id),
      v_user_id,
      now() + interval '24 hours'
    );
  end if;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'quote', to_jsonb(v_quote)
  );
end;
$$;

revoke all on function public.submit_quote_request(uuid, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text) from public;
grant execute on function public.submit_quote_request(uuid, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text) to authenticated;
