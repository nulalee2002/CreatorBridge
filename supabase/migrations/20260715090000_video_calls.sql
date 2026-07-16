-- Post-booking video calls (Zoom Video SDK). Recordings are audio only.
-- Spec: docs/2026-06-30-codex-video-calls-spec.md
-- Tables, private buckets, party-scoped RLS, RPCs, reminder + retention scheduling.

create extension if not exists pgcrypto;

-- ── Notification types ────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'quote_request_received', 'direct_message_received', 'proposal_received',
    'proposal_accepted', 'retainer_paid', 'delivery_submitted', 'payment_released',
    'support_ticket_update', 'contract_ready', 'contract_signed',
    'contract_countersigned', 'rebook_requested', 'system',
    'call_scheduled', 'call_rescheduled', 'call_cancelled',
    'call_reminder', 'call_summary_ready', 'call_request'
  )
);

-- ── Tables ────────────────────────────────────────────────────────
create table if not exists public.project_calls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 60),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled')),
  zoom_session_name text not null unique,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  recording_ref text,
  transcript_ref text,
  recording_expires_at timestamptz,
  late_reschedule boolean not null default false,
  no_show_marked_by uuid references public.profiles(id) on delete set null,
  cancelled_reason text,
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  reminder_start_sent_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_consents (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.project_calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('creator', 'client')),
  participant_name text not null check (length(trim(participant_name)) between 2 and 160),
  consent_text text not null,
  ip_address text,
  user_agent text,
  consented_at timestamptz not null default now(),
  unique (call_id, user_id)
);

create table if not exists public.call_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.project_calls(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'edited', 'agreed')),
  last_edited_by uuid references public.profiles(id) on delete set null,
  agreed_at timestamptz,
  agreed_by_creator boolean not null default false,
  agreed_by_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id)
);

create table if not exists public.call_summary_revisions (
  id uuid primary key default gen_random_uuid(),
  summary_id uuid not null references public.call_summaries(id) on delete cascade,
  editor_user_id uuid references public.profiles(id) on delete set null,
  body_snapshot text not null,
  created_at timestamptz not null default now()
);

-- Over-cap request path: beyond the 3 included calls, one party requests and
-- the other party schedules, so extra calls always reflect both parties.
create table if not exists public.project_call_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  note text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Dispute evidence bundle link table (cross-feature tie-in, admin surface).
create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('contract', 'deliverable', 'call_summary', 'message')),
  artifact_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists project_calls_project_idx on public.project_calls(project_id, scheduled_at desc);
create index if not exists project_calls_creator_idx on public.project_calls(creator_id, scheduled_at desc);
create index if not exists project_calls_client_idx on public.project_calls(client_id, scheduled_at desc);
create index if not exists project_calls_retention_idx on public.project_calls(recording_expires_at)
  where recording_ref is not null or transcript_ref is not null;
create index if not exists call_consents_call_idx on public.call_consents(call_id);
create index if not exists call_summaries_project_idx on public.call_summaries(project_id);
create index if not exists call_summary_revisions_summary_idx on public.call_summary_revisions(summary_id, created_at desc);
create index if not exists project_call_requests_project_idx on public.project_call_requests(project_id, created_at desc);
create index if not exists dispute_evidence_dispute_idx on public.dispute_evidence(dispute_id);

drop trigger if exists project_calls_touch_updated_at on public.project_calls;
create trigger project_calls_touch_updated_at
before update on public.project_calls
for each row execute function public.touch_contract_updated_at();

drop trigger if exists call_summaries_touch_updated_at on public.call_summaries;
create trigger call_summaries_touch_updated_at
before update on public.call_summaries
for each row execute function public.touch_contract_updated_at();

-- ── RLS: parties and admin read, writes only via RPCs / service role ──
alter table public.project_calls enable row level security;
alter table public.call_consents enable row level security;
alter table public.call_summaries enable row level security;
alter table public.call_summary_revisions enable row level security;
alter table public.project_call_requests enable row level security;
alter table public.dispute_evidence enable row level security;

revoke all on table public.project_calls from anon, authenticated;
revoke all on table public.call_consents from anon, authenticated;
revoke all on table public.call_summaries from anon, authenticated;
revoke all on table public.call_summary_revisions from anon, authenticated;
revoke all on table public.project_call_requests from anon, authenticated;
revoke all on table public.dispute_evidence from anon, authenticated;
grant select on table public.project_calls to authenticated;
grant select on table public.call_consents to authenticated;
grant select on table public.call_summaries to authenticated;
grant select on table public.call_summary_revisions to authenticated;
grant select on table public.project_call_requests to authenticated;
grant select on table public.dispute_evidence to authenticated;

drop policy if exists project_calls_parties_read on public.project_calls;
create policy project_calls_parties_read on public.project_calls
for select to authenticated
using (
  (select auth.uid()) in (creator_id, client_id)
  or public.is_platform_admin((select auth.uid()))
);

drop policy if exists call_consents_parties_read on public.call_consents;
create policy call_consents_parties_read on public.call_consents
for select to authenticated
using (
  exists (
    select 1 from public.project_calls call
    where call.id = call_consents.call_id
      and (
        (select auth.uid()) in (call.creator_id, call.client_id)
        or public.is_platform_admin((select auth.uid()))
      )
  )
);

drop policy if exists call_summaries_parties_read on public.call_summaries;
create policy call_summaries_parties_read on public.call_summaries
for select to authenticated
using (
  exists (
    select 1 from public.project_calls call
    where call.id = call_summaries.call_id
      and (
        (select auth.uid()) in (call.creator_id, call.client_id)
        or public.is_platform_admin((select auth.uid()))
      )
  )
);

drop policy if exists call_summary_revisions_parties_read on public.call_summary_revisions;
create policy call_summary_revisions_parties_read on public.call_summary_revisions
for select to authenticated
using (
  exists (
    select 1
    from public.call_summaries summary
    join public.project_calls call on call.id = summary.call_id
    where summary.id = call_summary_revisions.summary_id
      and (
        (select auth.uid()) in (call.creator_id, call.client_id)
        or public.is_platform_admin((select auth.uid()))
      )
  )
);

drop policy if exists project_call_requests_parties_read on public.project_call_requests;
create policy project_call_requests_parties_read on public.project_call_requests
for select to authenticated
using (
  exists (
    select 1 from public.project_calls call
    where call.project_id = project_call_requests.project_id
      and (select auth.uid()) in (call.creator_id, call.client_id)
  )
  or exists (
    select 1 from public.projects project
    where project.id = project_call_requests.project_id
      and project.client_id = (select auth.uid())
  )
  or public.is_platform_admin((select auth.uid()))
);

drop policy if exists dispute_evidence_admin_read on public.dispute_evidence;
create policy dispute_evidence_admin_read on public.dispute_evidence
for select to authenticated
using (public.is_platform_admin((select auth.uid())));

-- ── Private storage buckets (signed URL access only) ─────────────
-- call-recordings accepts audio only: recordings are audio, never video.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('call-recordings', 'call-recordings', false, 524288000, array['audio/mp4']),
  ('call-transcripts', 'call-transcripts', false, 10485760, array['text/vtt'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ── RPC: schedule a call ─────────────────────────────────────────
create or replace function public.schedule_project_call(
  p_project_id uuid,
  p_scheduled_at timestamptz
)
returns public.project_calls
language plpgsql
security definer
set search_path = public
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
begin
  if v_user_id is null then raise exception 'Sign in to schedule a call'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Pick a future time for the call';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
  if coalesce(v_project.status, '') not in
    ('retainer_paid', 'in_progress', 'revision', 'delivered', 'approved', 'completed', 'final_paid') then
    raise exception 'Video calls unlock after the retainer is paid';
  end if;

  select * into v_contract from public.contracts
  where project_id = p_project_id and status = 'countersigned';
  if not found then
    raise exception 'Video calls require a countersigned agreement';
  end if;

  if v_user_id not in (v_contract.client_id, v_contract.creator_user_id) then
    raise exception 'Only the project parties can schedule a call';
  end if;
  v_other_party := case when v_user_id = v_contract.client_id
    then v_contract.creator_user_id else v_contract.client_id end;

  -- Clients book inside the creator's published availability. Creators may
  -- propose any future time on their own calendar. Availability days are
  -- stored as calendar date keys, so an evening slot in a US timezone can
  -- land on the next UTC date; accept the marked day or the day before.
  if v_user_id = v_contract.client_id then
    v_listing_id := v_contract.creator_id;
    if not exists (
      select 1 from public.availability
      where listing_id = v_listing_id
        and date in (
          (p_scheduled_at at time zone 'UTC')::date,
          (p_scheduled_at at time zone 'UTC')::date - 1
        )
        and status = 'available'
    ) then
      raise exception 'Pick a day the creator has marked available';
    end if;
  end if;

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
    limit 1;
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
revoke all on function public.schedule_project_call(uuid, timestamptz) from public, anon;
grant execute on function public.schedule_project_call(uuid, timestamptz) to authenticated, service_role;

-- ── RPC: reschedule ──────────────────────────────────────────────
create or replace function public.reschedule_project_call(
  p_call_id uuid,
  p_scheduled_at timestamptz
)
returns public.project_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.project_calls%rowtype;
  v_late boolean;
  v_other_party uuid;
begin
  if v_user_id is null then raise exception 'Sign in to reschedule'; end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Pick a future time for the call';
  end if;

  select * into v_call from public.project_calls where id = p_call_id;
  if not found then raise exception 'Call not found'; end if;
  if v_user_id not in (v_call.creator_id, v_call.client_id) then
    raise exception 'Only the call parties can reschedule';
  end if;
  if v_call.status <> 'scheduled' then
    raise exception 'Only a scheduled call can be rescheduled';
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

  v_other_party := case when v_user_id = v_call.client_id then v_call.creator_id else v_call.client_id end;
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
revoke all on function public.reschedule_project_call(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_project_call(uuid, timestamptz) to authenticated, service_role;

-- ── RPC: cancel ──────────────────────────────────────────────────
create or replace function public.cancel_project_call(
  p_call_id uuid,
  p_reason text default null
)
returns public.project_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.project_calls%rowtype;
  v_other_party uuid;
begin
  if v_user_id is null then raise exception 'Sign in to cancel'; end if;

  select * into v_call from public.project_calls where id = p_call_id;
  if not found then raise exception 'Call not found'; end if;
  if v_user_id not in (v_call.creator_id, v_call.client_id) then
    raise exception 'Only the call parties can cancel';
  end if;
  if v_call.status not in ('scheduled', 'in_progress') then
    raise exception 'This call can no longer be cancelled';
  end if;

  update public.project_calls
  set status = 'cancelled',
      cancelled_reason = left(coalesce(nullif(trim(p_reason), ''), 'Cancelled by a call party'), 300)
  where id = p_call_id
  returning * into v_call;

  v_other_party := case when v_user_id = v_call.client_id then v_call.creator_id else v_call.client_id end;
  perform public.create_platform_notification(
    v_other_party,
    'call_cancelled',
    'Call cancelled',
    'Your project video call was cancelled. The booking itself is not affected. You can schedule a new time or continue in messages.',
    '/projects',
    jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id),
    v_user_id,
    null
  );

  return v_call;
end;
$$;
revoke all on function public.cancel_project_call(uuid, text) from public, anon;
grant execute on function public.cancel_project_call(uuid, text) to authenticated, service_role;

-- ── RPC: mark no-show (10 minute grace) ──────────────────────────
create or replace function public.mark_call_no_show(p_call_id uuid)
returns public.project_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_call public.project_calls%rowtype;
  v_other_party uuid;
begin
  if v_user_id is null then raise exception 'Sign in first'; end if;

  select * into v_call from public.project_calls where id = p_call_id;
  if not found then raise exception 'Call not found'; end if;
  if v_user_id not in (v_call.creator_id, v_call.client_id) then
    raise exception 'Only the call parties can mark a no show';
  end if;
  if v_call.status not in ('scheduled', 'in_progress') then
    raise exception 'This call can no longer be marked';
  end if;
  if now() < v_call.scheduled_at + interval '10 minutes' then
    raise exception 'Wait for the 10 minute grace window before marking a no show';
  end if;

  update public.project_calls
  set status = 'no_show', no_show_marked_by = v_user_id
  where id = p_call_id
  returning * into v_call;

  v_other_party := case when v_user_id = v_call.client_id then v_call.creator_id else v_call.client_id end;
  perform public.create_platform_notification(
    v_other_party,
    'system',
    'Call marked as a no show',
    'The other party marked the scheduled video call as a no show after the grace window.',
    '/projects',
    jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id),
    v_user_id,
    null
  );

  return v_call;
end;
$$;
revoke all on function public.mark_call_no_show(uuid) from public, anon;
grant execute on function public.mark_call_no_show(uuid) to authenticated, service_role;

-- ── RPC: request an additional call past the included 3 ──────────
create or replace function public.request_additional_call(
  p_project_id uuid,
  p_note text default null
)
returns public.project_call_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_contract public.contracts%rowtype;
  v_request public.project_call_requests%rowtype;
  v_other_party uuid;
begin
  if v_user_id is null then raise exception 'Sign in first'; end if;

  select * into v_contract from public.contracts
  where project_id = p_project_id and status = 'countersigned';
  if not found then raise exception 'Video calls require a countersigned agreement'; end if;
  if v_user_id not in (v_contract.client_id, v_contract.creator_user_id) then
    raise exception 'Only the project parties can request a call';
  end if;

  insert into public.project_call_requests (project_id, requested_by, note)
  values (p_project_id, v_user_id, left(coalesce(nullif(trim(p_note), ''), ''), 500))
  returning * into v_request;

  v_other_party := case when v_user_id = v_contract.client_id
    then v_contract.creator_user_id else v_contract.client_id end;
  perform public.create_platform_notification(
    v_other_party,
    'call_request',
    'Additional call requested',
    'The other party asked for another video call on this project. Schedule it from the project workspace if you agree.',
    '/projects',
    jsonb_build_object('project_id', p_project_id, 'request_id', v_request.id),
    v_user_id,
    null
  );

  return v_request;
end;
$$;
revoke all on function public.request_additional_call(uuid, text) from public, anon;
grant execute on function public.request_additional_call(uuid, text) to authenticated, service_role;

-- ── RPC: edit the shared summary (versioned, attributed) ─────────
create or replace function public.update_call_summary(
  p_summary_id uuid,
  p_body text
)
returns public.call_summaries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_summary public.call_summaries%rowtype;
  v_call public.project_calls%rowtype;
begin
  if v_user_id is null then raise exception 'Sign in first'; end if;
  if p_body is null or length(trim(p_body)) < 10 then
    raise exception 'The summary text is too short';
  end if;
  if length(p_body) > 20000 then
    raise exception 'The summary text is too long';
  end if;

  select * into v_summary from public.call_summaries where id = p_summary_id;
  if not found then raise exception 'Summary not found'; end if;
  select * into v_call from public.project_calls where id = v_summary.call_id;
  if v_user_id not in (v_call.creator_id, v_call.client_id) then
    raise exception 'Only the call parties can edit the summary';
  end if;

  update public.call_summaries
  set body = p_body,
      status = 'edited',
      last_edited_by = v_user_id,
      agreed_at = null,
      agreed_by_creator = false,
      agreed_by_client = false
  where id = p_summary_id
  returning * into v_summary;

  insert into public.call_summary_revisions (summary_id, editor_user_id, body_snapshot)
  values (p_summary_id, v_user_id, p_body);

  return v_summary;
end;
$$;
revoke all on function public.update_call_summary(uuid, text) from public, anon;
grant execute on function public.update_call_summary(uuid, text) to authenticated, service_role;

-- ── RPC: both-parties agreement on the summary ───────────────────
create or replace function public.agree_call_summary(p_summary_id uuid)
returns public.call_summaries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_summary public.call_summaries%rowtype;
  v_call public.project_calls%rowtype;
  v_other_party uuid;
begin
  if v_user_id is null then raise exception 'Sign in first'; end if;

  select * into v_summary from public.call_summaries where id = p_summary_id;
  if not found then raise exception 'Summary not found'; end if;
  select * into v_call from public.project_calls where id = v_summary.call_id;
  if v_user_id not in (v_call.creator_id, v_call.client_id) then
    raise exception 'Only the call parties can agree to the summary';
  end if;

  update public.call_summaries
  set agreed_by_creator = agreed_by_creator or (v_user_id = v_call.creator_id),
      agreed_by_client = agreed_by_client or (v_user_id = v_call.client_id)
  where id = p_summary_id
  returning * into v_summary;

  if v_summary.agreed_by_creator and v_summary.agreed_by_client then
    update public.call_summaries
    set status = 'agreed', agreed_at = coalesce(agreed_at, now())
    where id = p_summary_id
    returning * into v_summary;
  else
    v_other_party := case when v_user_id = v_call.client_id then v_call.creator_id else v_call.client_id end;
    perform public.create_platform_notification(
      v_other_party,
      'system',
      'Call summary marked accurate',
      'The other party confirmed the call summary is accurate. Review it and add your agreement if it matches your record.',
      '/projects',
      jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'summary_id', v_summary.id),
      v_user_id,
      null
    );
  end if;

  return v_summary;
end;
$$;
revoke all on function public.agree_call_summary(uuid) from public, anon;
grant execute on function public.agree_call_summary(uuid) to authenticated, service_role;

-- ── Reminders: 24 hours, 1 hour, at start (pg_cron, SQL only) ────
create or replace function public.send_call_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call record;
  v_sent int := 0;
begin
  for v_call in
    select * from public.project_calls
    where status = 'scheduled'
      and (
        (reminder_24h_sent_at is null and scheduled_at <= now() + interval '24 hours' and scheduled_at > now() + interval '1 hour')
        or (reminder_1h_sent_at is null and scheduled_at <= now() + interval '1 hour' and scheduled_at > now())
        or (reminder_start_sent_at is null and scheduled_at <= now() and scheduled_at > now() - interval '15 minutes')
      )
  loop
    if v_call.reminder_start_sent_at is null and v_call.scheduled_at <= now() then
      update public.project_calls
      set reminder_start_sent_at = now(),
          reminder_1h_sent_at = coalesce(reminder_1h_sent_at, now()),
          reminder_24h_sent_at = coalesce(reminder_24h_sent_at, now())
      where id = v_call.id;
      perform public.create_platform_notification(v_call.creator_id, 'call_reminder', 'Your video call is starting',
        'Your project video call is ready to join now.', '/projects',
        jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'window', 'start'), null, null);
      perform public.create_platform_notification(v_call.client_id, 'call_reminder', 'Your video call is starting',
        'Your project video call is ready to join now.', '/projects',
        jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'window', 'start'), null, null);
    elsif v_call.reminder_1h_sent_at is null and v_call.scheduled_at <= now() + interval '1 hour' then
      update public.project_calls
      set reminder_1h_sent_at = now(),
          reminder_24h_sent_at = coalesce(reminder_24h_sent_at, now())
      where id = v_call.id;
      perform public.create_platform_notification(v_call.creator_id, 'call_reminder', 'Video call in 1 hour',
        'Your project video call starts in about an hour.', '/projects',
        jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'window', '1h'), null, null);
      perform public.create_platform_notification(v_call.client_id, 'call_reminder', 'Video call in 1 hour',
        'Your project video call starts in about an hour.', '/projects',
        jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'window', '1h'), null, null);
    elsif v_call.reminder_24h_sent_at is null then
      update public.project_calls set reminder_24h_sent_at = now() where id = v_call.id;
      perform public.create_platform_notification(v_call.creator_id, 'call_reminder', 'Video call tomorrow',
        'Your project video call is coming up within 24 hours.', '/projects',
        jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'window', '24h'), null, null);
      perform public.create_platform_notification(v_call.client_id, 'call_reminder', 'Video call tomorrow',
        'Your project video call is coming up within 24 hours.', '/projects',
        jsonb_build_object('project_id', v_call.project_id, 'call_id', v_call.id, 'window', '24h'), null, null);
    end if;
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.send_call_reminders() from public, anon, authenticated;
grant execute on function public.send_call_reminders() to service_role;

select cron.schedule(
  'video-call-reminders',
  '*/10 * * * *',
  $job$ select public.send_call_reminders(); $job$
);

-- ── Retention: daily cleanup of expired recordings and transcripts ──
-- Same pattern as cleanup-support-screenshots: pg_cron posts to the edge
-- function with the shared maintenance token.
select cron.schedule(
  'cleanup-call-recordings-daily',
  '20 4 * * *',
  $job$ select net.http_post(
      url := 'https://mxizhszqhbhxzkkhgnmg.supabase.co/functions/v1/cleanup-call-recordings',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cleanup-token', (select cleanup_token from public.support_report_config limit 1)
      )
    ); $job$
);
