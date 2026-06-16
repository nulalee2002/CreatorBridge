-- Require verified client phone numbers before public project briefs can be posted.
-- The 50/50 payment and checkout structure is intentionally untouched.

alter table public.client_profiles
  add column if not exists phone_verified_at timestamptz;

comment on column public.client_profiles.phone_verified is
  'True only after a client completes the server-side phone OTP flow.';

comment on column public.client_profiles.phone_verified_at is
  'Timestamp when the client phone number was verified through the server-side OTP flow.';

create or replace function public.prevent_client_phone_verification_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.phone_verified := false;
    new.phone_verified_at := null;
    return new;
  end if;

  if new.phone_verified is distinct from old.phone_verified
    or new.phone_verified_at is distinct from old.phone_verified_at then
    new.phone_verified := old.phone_verified;
    new.phone_verified_at := old.phone_verified_at;
  end if;

  return new;
end;
$$;

drop trigger if exists client_profiles_prevent_phone_verification_tamper
  on public.client_profiles;

create trigger client_profiles_prevent_phone_verification_tamper
before insert or update on public.client_profiles
for each row
execute function public.prevent_client_phone_verification_tamper();

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
