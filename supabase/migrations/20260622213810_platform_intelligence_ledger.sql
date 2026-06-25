-- Permanent, privacy-bounded Platform Intelligence event ledger.

create table if not exists public.platform_event_definitions (
  event_name text not null,
  version integer not null check (version > 0),
  authority text not null check (authority in ('server_authoritative', 'browser_directional')),
  description text not null,
  allowed_property_keys text[] not null default '{}',
  privacy_class text not null default 'operational_metadata' check (
    privacy_class in ('operational_metadata', 'pseudonymous_behavior', 'financial_metadata')
  ),
  retention_class text not null default 'behavioral_13_months' check (
    retention_class in ('behavioral_13_months', 'financial_legal', 'aggregate_indefinite')
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (event_name, version)
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_name text not null,
  event_version integer not null,
  authority text not null check (authority in ('server_authoritative', 'browser_directional')),
  actor_id uuid references auth.users(id) on delete set null,
  session_id uuid,
  entity_type text,
  entity_id uuid,
  surface text,
  properties jsonb not null default '{}'::jsonb,
  privacy_class text not null,
  retention_class text not null,
  occurred_at timestamptz not null default now(),
  ingested_at timestamptz not null default now(),
  foreign key (event_name, event_version)
    references public.platform_event_definitions(event_name, version)
);

create table if not exists public.platform_event_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  event_name text not null,
  event_version integer not null default 1,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text,
  entity_id uuid,
  surface text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (event_name, event_version)
    references public.platform_event_definitions(event_name, version)
);

create index if not exists idx_platform_events_name_time
  on public.platform_events (event_name, occurred_at desc);
create index if not exists idx_platform_events_actor_time
  on public.platform_events (actor_id, occurred_at desc)
  where actor_id is not null;
create index if not exists idx_platform_events_entity
  on public.platform_events (entity_type, entity_id, occurred_at desc)
  where entity_id is not null;
create index if not exists idx_platform_event_outbox_pending
  on public.platform_event_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.platform_event_definitions enable row level security;
alter table public.platform_events enable row level security;
alter table public.platform_event_outbox enable row level security;

revoke all on table public.platform_event_definitions from public, anon, authenticated;
revoke all on table public.platform_events from public, anon, authenticated;
revoke all on table public.platform_event_outbox from public, anon, authenticated;
grant all on table public.platform_event_definitions to service_role;
grant all on table public.platform_events to service_role;
grant all on table public.platform_event_outbox to service_role;

insert into public.platform_event_definitions (
  event_name, version, authority, description, allowed_property_keys, privacy_class, retention_class
)
values
  ('auth.signed_up', 1, 'server_authoritative', 'Account signup completed.', array['account_type'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('auth.signed_in', 1, 'server_authoritative', 'Account sign-in completed.', array['method'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('onboarding.intro_viewed', 1, 'browser_directional', 'Creator collaboration introduction viewed.', array['surface'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('onboarding.intro_dismissed', 1, 'browser_directional', 'Creator collaboration introduction dismissed.', array['surface'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('discovery.search_started', 1, 'browser_directional', 'Creator discovery search started.', array['pillar','specialty','turnaround','location_requirement','collaboration_only'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('discovery.profile_viewed', 1, 'browser_directional', 'Creator profile viewed from discovery.', array['source_surface','pillar'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('quote.requested', 1, 'server_authoritative', 'Quote request created.', array['service_category','budget_band'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('project.created', 1, 'server_authoritative', 'Project record created.', array['status','operation'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('project.status_changed', 1, 'server_authoritative', 'Project status changed.', array['status','operation'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('application.submitted', 1, 'server_authoritative', 'Creator application submitted.', array['service_category'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('booking.created', 1, 'server_authoritative', 'Booking created.', array['booking_type','amount_band'], 'financial_metadata', 'financial_legal'),
  ('booking.completed', 1, 'server_authoritative', 'Booking completed.', array['booking_type','amount_band'], 'financial_metadata', 'financial_legal'),
  ('collaboration.composer_started', 1, 'browser_directional', 'Collaboration composer opened.', array['source_surface','project_context','service_category'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('collaboration.validation_failed', 1, 'browser_directional', 'Collaboration validation failed.', array['field','reason_code','service_category'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('collaboration.sub_floor_attempted', 1, 'browser_directional', 'Collaboration amount below the platform floor.', array['amount_band','service_category','exit_point'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('collaboration.abandoned', 1, 'browser_directional', 'Collaboration composer abandoned.', array['exit_point','service_category','project_context'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('collaboration.invited', 1, 'server_authoritative', 'Creator collaboration invitation sent.', array['service_category','amount_band','project_context'], 'financial_metadata', 'financial_legal'),
  ('collaboration.completed', 1, 'server_authoritative', 'Creator collaboration completed.', array['service_category','amount_band','duration_band'], 'financial_metadata', 'financial_legal'),
  ('payment.status_changed', 1, 'server_authoritative', 'Payment status changed.', array['status','operation','payment_method'], 'financial_metadata', 'financial_legal'),
  ('messaging.safety_outcome', 1, 'server_authoritative', 'Message safety filter outcome without message content.', array['outcome','rule_category'], 'operational_metadata', 'behavioral_13_months'),
  ('network.post_created', 1, 'server_authoritative', 'Network post created.', array['post_type','state_code'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('workspace.link_added', 1, 'server_authoritative', 'Approved external workspace link recorded.', array['provider','workspace_type'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('workspace.access_failed', 1, 'browser_directional', 'Workspace access failure reported.', array['provider','workspace_type','reason_code'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('delivery.submitted', 1, 'server_authoritative', 'Delivery anchor submitted.', array['delivery_type','version_number'], 'pseudonymous_behavior', 'financial_legal'),
  ('review.submitted', 1, 'server_authoritative', 'Review submitted.', array['review_type','rating_band'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('dispute.status_changed', 1, 'server_authoritative', 'Dispute status changed.', array['status','operation','category'], 'financial_metadata', 'financial_legal'),
  ('support.status_changed', 1, 'server_authoritative', 'Support ticket status changed.', array['status','operation','category'], 'operational_metadata', 'behavioral_13_months'),
  ('referral.converted', 1, 'server_authoritative', 'Referral converted.', array['referral_type','reward_type'], 'financial_metadata', 'financial_legal'),
  ('retention.returned', 1, 'server_authoritative', 'Member returned within a defined retention window.', array['cohort','window'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('rehire.started', 1, 'browser_directional', 'Repeat collaboration flow started.', array['source_surface','prior_booking_type'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('admin.action_completed', 1, 'server_authoritative', 'Administrative action completed.', array['action_type','entity_type','outcome'], 'operational_metadata', 'financial_legal')
on conflict (event_name, version) do update set
  authority = excluded.authority,
  description = excluded.description,
  allowed_property_keys = excluded.allowed_property_keys,
  privacy_class = excluded.privacy_class,
  retention_class = excluded.retention_class,
  active = true;

create or replace function creatorbridge_private.platform_event_properties_are_safe(
  p_properties jsonb,
  p_allowed_property_keys text[]
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_forbidden_keys constant text[] := array[
    'message', 'body', 'content', 'file', 'files', 'workspace_contents',
    'email', 'phone', 'address', 'payment_token', 'token', 'password', 'name'
  ];
  v_key text;
  v_text text := coalesce(p_properties, '{}'::jsonb)::text;
begin
  if p_properties is null or jsonb_typeof(p_properties) <> 'object' then
    return false;
  end if;

  for v_key in select jsonb_object_keys(p_properties)
  loop
    if lower(v_key) = any (v_forbidden_keys)
      or not (lower(v_key) = any (coalesce(p_allowed_property_keys, '{}'::text[]))) then
      return false;
    end if;
  end loop;

  if v_text ~* '[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+' then
    raise exception 'Directional properties cannot contain email addresses';
  end if;

  if v_text ~ '(?:\+?1[-. ]?)?\(?[2-9][0-9]{2}\)?[-. ][0-9]{3}[-. ][0-9]{4}' then
    raise exception 'Directional properties cannot contain phone numbers';
  end if;

  if length(v_text) > 2000 then
    return false;
  end if;

  return true;
end;
$$;

create or replace function creatorbridge_private.insert_directional_platform_event(
  p_event_name text,
  p_event_version integer,
  p_entity_type text,
  p_entity_id uuid,
  p_surface text,
  p_properties jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_definition public.platform_event_definitions%rowtype;
  v_event_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_definition
  from public.platform_event_definitions definition
  where definition.event_name = p_event_name
    and definition.version = p_event_version
    and definition.authority = 'browser_directional'
    and definition.active;

  if v_definition.event_name is null then
    raise exception 'Unknown or unauthorized directional event';
  end if;

  if not creatorbridge_private.platform_event_properties_are_safe(
    coalesce(p_properties, '{}'::jsonb),
    v_definition.allowed_property_keys
  ) then
    raise exception 'Directional properties contain forbidden or unregistered fields';
  end if;

  insert into public.platform_events (
    idempotency_key,
    event_name,
    event_version,
    authority,
    actor_id,
    entity_type,
    entity_id,
    surface,
    properties,
    privacy_class,
    retention_class
  ) values (
    'browser:' || v_actor_id::text || ':' || gen_random_uuid()::text,
    v_definition.event_name,
    v_definition.version,
    'browser_directional',
    (select auth.uid()),
    nullif(left(p_entity_type, 80), ''),
    p_entity_id,
    nullif(left(p_surface, 80), ''),
    coalesce(p_properties, '{}'::jsonb),
    v_definition.privacy_class,
    v_definition.retention_class
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.record_directional_platform_event(
  p_event_name text,
  p_event_version integer,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_surface text default null,
  p_properties jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select creatorbridge_private.insert_directional_platform_event(
    p_event_name,
    p_event_version,
    p_entity_type,
    p_entity_id,
    p_surface,
    p_properties
  );
$$;

revoke all on function creatorbridge_private.platform_event_properties_are_safe(jsonb, text[]) from public, anon, authenticated;
revoke all on function creatorbridge_private.insert_directional_platform_event(text, integer, text, uuid, text, jsonb) from public, anon;
grant execute on function creatorbridge_private.insert_directional_platform_event(text, integer, text, uuid, text, jsonb) to authenticated;
revoke all on function public.record_directional_platform_event(text, integer, text, uuid, text, jsonb) from public, anon;
grant execute on function public.record_directional_platform_event(text, integer, text, uuid, text, jsonb) to authenticated;

create or replace function creatorbridge_private.enqueue_platform_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_actor_id uuid := (select auth.uid());
begin
  v_status := case
    when to_jsonb(new) ? 'status' then to_jsonb(new)->>'status'
    when to_jsonb(new) ? 'retainer_status' then
      'retainer:' || coalesce(to_jsonb(new)->>'retainer_status', 'unknown') ||
      ',final:' || coalesce(to_jsonb(new)->>'final_status', 'unknown')
    else null
  end;

  begin
    insert into public.platform_event_outbox (
      idempotency_key,
      event_name,
      event_version,
      actor_id,
      entity_type,
      entity_id,
      surface,
      properties
    ) values (
      tg_table_name || ':' || lower(tg_op) || ':' || new.id::text || ':' || extract(epoch from clock_timestamp())::text,
      tg_argv[0],
      1,
      v_actor_id,
      tg_table_name,
      new.id,
      'server',
      jsonb_strip_nulls(jsonb_build_object('status', v_status, 'operation', lower(tg_op)))
    )
    on conflict (idempotency_key) do nothing;
  exception when others then
    raise warning 'Platform Intelligence enqueue failed for %.%: %', tg_table_name, new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function creatorbridge_private.enqueue_platform_event() from public, anon, authenticated;

drop trigger if exists platform_event_project_created on public.projects;
create trigger platform_event_project_created
  after insert on public.projects
  for each row execute function creatorbridge_private.enqueue_platform_event('project.created');

drop trigger if exists platform_event_project_status on public.projects;
create trigger platform_event_project_status
  after update of status on public.projects
  for each row
  when (old.status is distinct from new.status)
  execute function creatorbridge_private.enqueue_platform_event('project.status_changed');

drop trigger if exists platform_event_payment_status on public.transactions;
create trigger platform_event_payment_status
  after insert or update of retainer_status, final_status on public.transactions
  for each row execute function creatorbridge_private.enqueue_platform_event('payment.status_changed');

drop trigger if exists platform_event_dispute_status on public.disputes;
create trigger platform_event_dispute_status
  after insert or update of status on public.disputes
  for each row execute function creatorbridge_private.enqueue_platform_event('dispute.status_changed');

drop trigger if exists platform_event_support_status on public.support_tickets;
create trigger platform_event_support_status
  after insert or update of status on public.support_tickets
  for each row execute function creatorbridge_private.enqueue_platform_event('support.status_changed');
