-- Make project application and acceptance state changes atomic.
-- The browser can request these actions, but the database verifies ownership and updates related rows together.

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
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_message, ''))) = 0 then
    raise exception 'Proposal message is required';
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
        proposed_rate = greatest(coalesce(p_proposed_rate, 0), 0),
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
      greatest(coalesce(p_proposed_rate, 0), 0),
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

create or replace function public.accept_project_application(
  p_project_id uuid,
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_application public.project_applications%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.client_id <> v_user_id then
    raise exception 'Only the project owner can accept an application';
  end if;

  if coalesce(v_project.status, 'open') <> 'open' then
    raise exception 'This project is not open for acceptance';
  end if;

  select *
  into v_application
  from public.project_applications
  where id = p_application_id
    and project_id = p_project_id
  for update;

  if not found then
    raise exception 'Application not found for this project';
  end if;

  update public.project_applications
  set status = case
    when id = p_application_id then 'accepted'
    when status = 'pending' then 'declined'
    else status
  end
  where project_id = p_project_id;

  update public.projects
  set status = 'accepted',
      accepted_creator_id = v_application.listing_id::text,
      accepted_application_id = v_application.id::text,
      applications = (
        select count(*)
        from public.project_applications
        where project_id = p_project_id
      )
  where id = p_project_id
  returning * into v_project;

  select *
  into v_application
  from public.project_applications
  where id = p_application_id;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'application', to_jsonb(v_application)
  );
end;
$$;

revoke all on function public.apply_to_project(uuid, uuid, text, numeric) from public;
grant execute on function public.apply_to_project(uuid, uuid, text, numeric) to authenticated;

revoke all on function public.accept_project_application(uuid, uuid) from public;
grant execute on function public.accept_project_application(uuid, uuid) to authenticated;
