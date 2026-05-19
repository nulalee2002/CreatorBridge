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
  v_creator_stripe_account_id text;
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

  select stripe_account_id
  into v_creator_stripe_account_id
  from public.creator_listings
  where id = v_application.listing_id;

  if v_creator_stripe_account_id is null or length(trim(v_creator_stripe_account_id)) = 0 then
    raise exception 'This creator must connect a Stripe payout account before their proposal can be accepted';
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

revoke all on function public.accept_project_application(uuid, uuid) from public;
grant execute on function public.accept_project_application(uuid, uuid) to authenticated;
