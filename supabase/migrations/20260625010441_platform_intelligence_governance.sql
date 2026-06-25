alter table public.platform_events
  add column if not exists actor_pseudonym uuid,
  add column if not exists pseudonymized_at timestamptz,
  add column if not exists subject_deleted_at timestamptz;

create table if not exists public.platform_intelligence_metric_definitions (
  metric_key text not null,
  version integer not null default 1,
  title text not null,
  description text not null,
  authority text not null check (authority in ('server_authoritative', 'browser_directional', 'mixed')),
  source_events text[] not null default '{}',
  suppression_threshold integer not null default 5 check (suppression_threshold >= 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (metric_key, version)
);

create table if not exists public.platform_subject_pseudonyms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudonym uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_intelligence_exports (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  export_kind text not null check (export_kind in ('json', 'csv')),
  period_start date not null,
  period_end date not null,
  status text not null default 'generated' check (status in ('generated', 'revoked', 'expired')),
  row_count integer not null default 0,
  suppression_count integer not null default 0,
  includes_direct_identifiers boolean not null default false check (includes_direct_identifiers = false),
  includes_message_content boolean not null default false check (includes_message_content = false),
  includes_file_content boolean not null default false check (includes_file_content = false),
  definition_versions jsonb not null default '{}'::jsonb,
  freshness_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.platform_subject_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references auth.users(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  exports_revoked integer not null default 0,
  events_scrubbed integer not null default 0,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.platform_intelligence_metric_definitions enable row level security;
alter table public.platform_subject_pseudonyms enable row level security;
alter table public.platform_intelligence_exports enable row level security;
alter table public.platform_subject_deletion_requests enable row level security;

revoke all on public.platform_intelligence_metric_definitions, public.platform_subject_pseudonyms, public.platform_intelligence_exports, public.platform_subject_deletion_requests from public, anon, authenticated;
grant all on public.platform_intelligence_metric_definitions, public.platform_subject_pseudonyms, public.platform_intelligence_exports, public.platform_subject_deletion_requests to service_role;
grant select on public.platform_intelligence_exports to authenticated;

create policy "Admins can read governed export archive"
  on public.platform_intelligence_exports
  for select
  to authenticated
  using (public.is_platform_admin((select auth.uid())));

insert into public.platform_intelligence_metric_definitions (
  metric_key, version, title, description, authority, source_events
) values
  ('external_gmv', 1, 'External client GMV', 'Gross booking volume from outside-client projects only.', 'server_authoritative', array['booking.', 'payment.']),
  ('internal_collaboration_gmv', 1, 'Internal collaboration GMV', 'Creator-to-creator collaboration volume separated from external demand.', 'server_authoritative', array['collaboration.', 'payment.']),
  ('collaboration_completion_rate', 1, 'Collaboration completion', 'Creator collaboration completion and approval outcomes.', 'server_authoritative', array['collaboration.']),
  ('collaboration_abandonment', 1, 'Collaboration abandonment', 'Directional starts, validation errors, and sub-floor attempts.', 'browser_directional', array['collaboration.']),
  ('workspace_failure_rate', 1, 'Workspace failures', 'Approved-link validation failures and workspace access friction.', 'mixed', array['workspace.']),
  ('delivery_time', 1, 'Delivery timing', 'Time from funding to delivery anchor submission.', 'server_authoritative', array['delivery.']),
  ('dispute_rate', 1, 'Dispute rate', 'Disputes opened against projects and collaborations.', 'server_authoritative', array['dispute.']),
  ('repeat_hire_rate', 1, 'Repeat hire', 'Rehire invitations and repeat collaboration patterns.', 'server_authoritative', array['rehire.']),
  ('creator_retention', 1, 'Creator retention', 'Creator activity and return behavior.', 'mixed', array['retention.', 'auth.']),
  ('processing_costs', 1, 'Processing costs', 'Payment processing costs separated from platform fees.', 'server_authoritative', array['payment.']),
  ('contribution_margin', 1, 'Contribution margin', 'Platform fee revenue net of disclosed processing costs.', 'server_authoritative', array['payment.'])
on conflict (metric_key, version) do nothing;

create or replace view public.platform_intelligence_daily_rollups
with (security_invoker = true)
as
select
  date_trunc('day', e.occurred_at)::date as period_date,
  e.event_name,
  e.event_version,
  d.authority,
  coalesce(e.entity_type, 'none') as entity_type,
  coalesce(e.surface, 'unknown') as surface,
  count(*)::integer as event_count,
  count(distinct coalesce(e.actor_pseudonym::text, e.actor_id::text))::integer as actor_count,
  (count(distinct coalesce(e.actor_pseudonym::text, e.actor_id::text)) < 5)::boolean as suppressed,
  case when count(distinct coalesce(e.actor_pseudonym::text, e.actor_id::text)) < 5 then null else count(distinct coalesce(e.actor_pseudonym::text, e.actor_id::text))::integer end as actor_count_public,
  max(e.ingested_at) as freshness_at
from public.platform_events e
join public.platform_event_definitions d
  on d.event_name = e.event_name
 and d.version = e.event_version
where e.subject_deleted_at is null
group by 1,2,3,4,5,6;

revoke all on public.platform_intelligence_daily_rollups from public, anon, authenticated;
grant select on public.platform_intelligence_daily_rollups to service_role;

create or replace function public.retain_platform_intelligence()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pseudonymized_count integer := 0;
  deleted_count integer := 0;
begin
  insert into public.platform_subject_pseudonyms(user_id)
  select distinct actor_id
  from public.platform_events
  where actor_id is not null
    and occurred_at < now() - interval '13 months'
  on conflict (user_id) do nothing;

  update public.platform_events e
  set actor_pseudonym = p.pseudonym,
      actor_id = null,
      pseudonymized_at = coalesce(e.pseudonymized_at, now())
  from public.platform_subject_pseudonyms p
  where e.actor_id = p.user_id
    and e.occurred_at < now() - interval '13 months';
  get diagnostics pseudonymized_count = row_count;

  delete from public.platform_events
  where occurred_at < now() - interval '24 months'
    and retention_class not in ('financial_legal', 'legal_hold');
  get diagnostics deleted_count = row_count;

  update public.platform_intelligence_exports
  set status = 'expired'
  where status = 'generated'
    and expires_at < now();

  return jsonb_build_object(
    'identifiable_retention_months', 13,
    'pseudonymized_detail_months', 24,
    'pseudonymized_events', pseudonymized_count,
    'deleted_events', deleted_count
  );
end
$$;

revoke all on function public.retain_platform_intelligence() from public, anon, authenticated;
grant execute on function public.retain_platform_intelligence() to service_role;

create or replace function public.delete_platform_intelligence_subject(p_subject_user_id uuid, p_requested_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  exports_count integer := 0;
  events_count integer := 0;
  pseudonym_value uuid;
  request_id uuid;
begin
  if p_subject_user_id is null then
    raise exception 'Subject user is required';
  end if;

  update public.platform_intelligence_exports
  set status = 'revoked', revoked_at = now()
  where status = 'generated';
  get diagnostics exports_count = row_count;

  select pseudonym into pseudonym_value
  from public.platform_subject_pseudonyms
  where user_id = p_subject_user_id;

  update public.platform_events
  set actor_id = null,
      actor_pseudonym = null,
      properties = '{}'::jsonb,
      subject_deleted_at = now()
  where (actor_id = p_subject_user_id or (pseudonym_value is not null and actor_pseudonym = pseudonym_value))
    and retention_class not in ('financial_legal', 'legal_hold');
  get diagnostics events_count = row_count;

  delete from public.platform_subject_pseudonyms
  where user_id = p_subject_user_id;

  insert into public.platform_subject_deletion_requests (
    subject_user_id, requested_by, status, exports_revoked, events_scrubbed, completed_at
  ) values (
    p_subject_user_id, p_requested_by, 'completed', exports_count, events_count, now()
  )
  returning id into request_id;

  return jsonb_build_object(
    'request_id', request_id,
    'exports_revoked', exports_count,
    'events_scrubbed', events_count
  );
end
$$;

revoke all on function public.delete_platform_intelligence_subject(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_platform_intelligence_subject(uuid, uuid) to service_role;
