-- Require project briefs to carry a real budget before they can enter checkout.

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
