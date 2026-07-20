-- Follow-up hardening for the post-booking Video SDK feature.
-- Bind calls to the exact availability day selected in the UI, apply the
-- availability rule to both parties, and serialize cap/request consumption.

revoke all on function public.schedule_project_call(uuid, timestamptz) from public, anon, authenticated;
drop function if exists public.schedule_project_call(uuid, timestamptz);

create or replace function public.schedule_project_call(
  p_project_id uuid,
  p_scheduled_at timestamptz,
  p_availability_date date
)
returns public.project_calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_contract public.contracts%rowtype;
  v_call public.project_calls%rowtype;
  v_call_id uuid := gen_random_uuid();
  v_active_calls int;
  v_request public.project_call_requests%rowtype;
  v_other_party uuid;
  v_listing_id uuid;
  v_utc_date date;
begin
  if v_user_id is null then raise exception 'Sign in to schedule a call'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Pick a future time for the call';
  end if;
  if p_availability_date is null then
    raise exception 'Pick one of the creator''s available days';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
  if coalesce(v_project.status, '') not in
    ('retainer_paid', 'in_progress', 'revision', 'delivered', 'approved', 'completed', 'final_paid') then
    raise exception 'Video calls unlock after the retainer is paid';
  end if;

  select * into v_contract from public.contracts
  where project_id = p_project_id and status = 'countersigned';
  if not found then raise exception 'Video calls require a countersigned agreement'; end if;
  if v_user_id not in (v_contract.client_id, v_contract.creator_user_id) then
    raise exception 'Only the project parties can schedule a call';
  end if;

  v_other_party := case when v_user_id = v_contract.client_id
    then v_contract.creator_user_id else v_contract.client_id end;
  v_listing_id := v_contract.creator_id;
  v_utc_date := (p_scheduled_at at time zone 'UTC')::date;

  -- CreatorBridge availability is day-based. For US local dates the UTC
  -- timestamp is either the selected day or the following day.
  if p_availability_date not in (v_utc_date, v_utc_date - 1) then
    raise exception 'The selected time does not match the available day';
  end if;
  if not exists (
    select 1 from public.availability
    where listing_id = v_listing_id
      and date = p_availability_date
      and status = 'available'
  ) then
    raise exception 'Pick a day the creator has marked available';
  end if;

  -- Serialize scheduling per project so simultaneous requests cannot exceed
  -- the three-call allowance or spend one extra-call request twice.
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));

  select count(*) into v_active_calls
  from public.project_calls
  where project_id = p_project_id
    and status in ('scheduled', 'in_progress', 'completed');

  if v_active_calls >= 3 then
    select * into v_request
    from public.project_call_requests
    where project_id = p_project_id
      and requested_by = v_other_party
      and used_at is null
      and created_at > now() - interval '30 days'
    order by created_at asc
    limit 1
    for update;
    if not found then
      raise exception 'This project has used its 3 included calls. Ask the other party to request another call.';
    end if;
    update public.project_call_requests set used_at = now() where id = v_request.id;
  end if;

  insert into public.project_calls (
    id, project_id, creator_id, client_id, scheduled_at,
    zoom_session_name, initiated_by
  )
  values (
    v_call_id, p_project_id, v_contract.creator_user_id, v_contract.client_id,
    p_scheduled_at, 'cb-call-' || v_call_id, v_user_id
  )
  returning * into v_call;

  perform public.create_platform_notification(
    v_other_party,
    'call_scheduled',
    'A video call was scheduled',
    'A recorded video call was scheduled for your project. Review the time and consent notice before joining.',
    '/projects',
    jsonb_build_object('project_id', p_project_id, 'call_id', v_call_id),
    v_user_id,
    null
  );

  return v_call;
end;
$$;
revoke all on function public.schedule_project_call(uuid, timestamptz, date) from public, anon;
grant execute on function public.schedule_project_call(uuid, timestamptz, date) to authenticated, service_role;

revoke all on function public.reschedule_project_call(uuid, timestamptz) from public, anon, authenticated;
drop function if exists public.reschedule_project_call(uuid, timestamptz);

create or replace function public.reschedule_project_call(
  p_call_id uuid,
  p_scheduled_at timestamptz,
  p_availability_date date
)
returns public.project_calls
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.project_calls%rowtype;
  v_contract public.contracts%rowtype;
  v_late boolean;
  v_other_party uuid;
  v_utc_date date;
begin
  if v_user_id is null then raise exception 'Sign in to reschedule'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Pick a future time for the call';
  end if;
  if p_availability_date is null then
    raise exception 'Pick one of the creator''s available days';
  end if;

  select * into v_call from public.project_calls where id = p_call_id;
  if not found then raise exception 'Call not found'; end if;
  if v_user_id <> v_call.creator_id then
    raise exception 'Only the creator can reschedule this call';
  end if;
  if v_call.status <> 'scheduled' then
    raise exception 'Only a scheduled call can be rescheduled';
  end if;

  select * into v_contract from public.contracts
  where project_id = v_call.project_id and status = 'countersigned';
  if not found then raise exception 'Video calls require a countersigned agreement'; end if;

  v_utc_date := (p_scheduled_at at time zone 'UTC')::date;
  if p_availability_date not in (v_utc_date, v_utc_date - 1) then
    raise exception 'The selected time does not match the available day';
  end if;
  if not exists (
    select 1 from public.availability
    where listing_id = v_contract.creator_id
      and date = p_availability_date
      and status = 'available'
  ) then
    raise exception 'Pick a day the creator has marked available';
  end if;

  v_late := now() > v_call.scheduled_at - interval '12 hours';

  update public.project_calls
  set scheduled_at = p_scheduled_at,
      late_reschedule = late_reschedule or v_late,
      reminder_24h_sent_at = null,
      reminder_1h_sent_at = null,
      reminder_start_sent_at = null
  where id = p_call_id
  returning * into v_call;

  v_other_party := v_call.client_id;
  perform public.create_platform_notification(
    v_other_party,
    'call_rescheduled',
    case when v_late then 'Call rescheduled (late change)' else 'Call rescheduled' end,
    'Your project video call was moved to a new time.',
    '/projects',
    jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'late', v_late),
    v_user_id,
    null
  );

  return v_call;
end;
$$;
revoke all on function public.reschedule_project_call(uuid, timestamptz, date) from public, anon;
grant execute on function public.reschedule_project_call(uuid, timestamptz, date) to authenticated, service_role;
