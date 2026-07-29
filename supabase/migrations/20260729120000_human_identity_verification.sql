-- CreatorBridge provider-backed human identity and phone trust foundation.
-- Provider media and raw provider payloads never belong in CreatorBridge tables.

create schema if not exists creatorbridge_private;
revoke all on schema creatorbridge_private from public;
grant usage on schema creatorbridge_private to authenticated, service_role;

create table if not exists public.account_phone_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'pending' check (status in ('pending', 'verified')),
  verified_at timestamptz,
  provider text not null default 'twilio' check (provider = 'twilio'),
  provider_service_reference text,
  last_sent_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'verified' and verified_at is not null)
    or (status = 'pending' and verified_at is null)
  )
);

create table if not exists public.identity_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version text not null check (length(trim(consent_version)) between 1 and 80),
  purpose text not null check (purpose in ('creator_application', 'first_contract', 'reverification')),
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, consent_version, purpose)
);

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.identity_consents(id) on delete restrict,
  provider text not null default 'stripe_identity' check (provider = 'stripe_identity'),
  provider_session_id text not null unique,
  purpose text not null check (purpose in ('creator_application', 'first_contract', 'reverification')),
  status text not null default 'pending' check (
    status in (
      'unverified',
      'consent_required',
      'pending',
      'verified',
      'retry_required',
      'manual_review',
      'duplicate_restricted',
      'rejected',
      'reverification_required'
    )
  ),
  adult_verified boolean,
  document_status text check (document_status is null or document_status in ('verified', 'unverified')),
  selfie_status text check (selfie_status is null or selfie_status in ('verified', 'unverified')),
  provider_error_code text,
  risk_label text check (
    risk_label is null
    or risk_label in ('clear', 'provider_review', 'possible_duplicate', 'account_inconsistency')
  ),
  attempt_count integer not null default 1 check (attempt_count between 1 and 10),
  review_reason text,
  duplicate_of_user_id uuid references auth.users(id) on delete restrict,
  reverification_reason text,
  verified_at timestamptz,
  restricted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (duplicate_of_user_id is null or duplicate_of_user_id <> user_id),
  check (
    status <> 'verified'
    or (
      adult_verified is true
      and document_status = 'verified'
      and selfie_status = 'verified'
      and duplicate_of_user_id is null
      and verified_at is not null
    )
  ),
  check (
    status <> 'duplicate_restricted'
    or (duplicate_of_user_id is not null and restricted_at is not null)
  )
);

create table if not exists public.identity_provider_events (
  event_id text primary key check (length(trim(event_id)) between 1 and 255),
  event_type text not null check (length(trim(event_type)) between 1 and 160),
  provider_session_id text,
  processing_status text not null default 'processing' check (
    processing_status in ('processing', 'processed', 'ignored', 'failed')
  ),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.identity_review_actions (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.identity_verifications(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in (
      'request_secure_retry',
      'clear_false_positive',
      'confirm_duplicate',
      'reject_verification',
      'require_reverification',
      'restore_original_account'
    )
  ),
  reason text not null check (length(trim(reason)) between 3 and 2000),
  linked_original_user_id uuid references auth.users(id) on delete restrict,
  previous_status text not null,
  resulting_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_identity_verifications_user_latest
  on public.identity_verifications (user_id, created_at desc);
create unique index if not exists idx_identity_verifications_one_pending_user
  on public.identity_verifications (user_id)
  where status = 'pending';
create index if not exists idx_identity_verifications_review_queue
  on public.identity_verifications (status, updated_at desc)
  where status in ('manual_review', 'duplicate_restricted', 'rejected', 'reverification_required');
create index if not exists idx_identity_verifications_duplicate_link
  on public.identity_verifications (duplicate_of_user_id)
  where duplicate_of_user_id is not null;
create index if not exists idx_identity_provider_events_session
  on public.identity_provider_events (provider_session_id, received_at desc);
create index if not exists idx_identity_review_actions_target
  on public.identity_review_actions (target_user_id, created_at desc);

alter table public.account_phone_verifications enable row level security;
alter table public.identity_consents enable row level security;
alter table public.identity_verifications enable row level security;
alter table public.identity_provider_events enable row level security;
alter table public.identity_review_actions enable row level security;

drop policy if exists "Members can read own phone trust" on public.account_phone_verifications;
create policy "Members can read own phone trust"
  on public.account_phone_verifications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_admin((select auth.uid()))
  );

drop policy if exists "Members can read own identity consents" on public.identity_consents;
create policy "Members can read own identity consents"
  on public.identity_consents
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_admin((select auth.uid()))
  );

drop policy if exists "Members can read own reduced identity state" on public.identity_verifications;
create policy "Members can read own reduced identity state"
  on public.identity_verifications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_admin((select auth.uid()))
  );

drop policy if exists "Platform admins can read identity review actions" on public.identity_review_actions;
create policy "Platform admins can read identity review actions"
  on public.identity_review_actions
  for select
  to authenticated
  using (public.is_platform_admin((select auth.uid())));

grant select on public.account_phone_verifications to authenticated;
grant select on public.identity_consents to authenticated;
grant select on public.identity_verifications to authenticated;
grant select on public.identity_review_actions to authenticated;
grant all on public.account_phone_verifications to service_role;
grant all on public.identity_consents to service_role;
grant all on public.identity_verifications to service_role;
grant all on public.identity_provider_events to service_role;
grant all on public.identity_review_actions to service_role;
revoke insert, update, delete on public.account_phone_verifications from public, anon, authenticated;
revoke insert, update, delete on public.identity_consents from public, anon, authenticated;
revoke insert, update, delete on public.identity_verifications from public, anon, authenticated;
revoke select, insert, update, delete on public.identity_provider_events from public, anon, authenticated;
revoke insert, update, delete on public.identity_review_actions from public, anon, authenticated;

create or replace function creatorbridge_private.user_phone_verified(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.account_phone_verifications phone
      where phone.user_id = p_user_id
        and phone.status = 'verified'
        and phone.verified_at is not null
    );
$$;

create or replace function creatorbridge_private.user_identity_verified(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      verification.status = 'verified'
      and verification.adult_verified is true
      and verification.document_status = 'verified'
      and verification.selfie_status = 'verified'
      and verification.duplicate_of_user_id is null
      and verification.verified_at is not null
    from public.identity_verifications verification
    where verification.user_id = p_user_id
    order by verification.created_at desc, verification.id desc
    limit 1
  ), false);
$$;

revoke all on function creatorbridge_private.user_phone_verified(uuid) from public, anon;
revoke all on function creatorbridge_private.user_identity_verified(uuid) from public, anon;
grant execute on function creatorbridge_private.user_phone_verified(uuid) to authenticated, service_role;
grant execute on function creatorbridge_private.user_identity_verified(uuid) to authenticated, service_role;

create or replace function public.get_my_trust_status()
returns table (
  phone_status text,
  phone_e164 text,
  phone_verified boolean,
  phone_verified_at timestamptz,
  identity_status text,
  identity_verified boolean,
  identity_updated_at timestamptz,
  retry_allowed boolean,
  review_message text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  with latest_identity as (
    select verification.status, verification.updated_at, verification.attempt_count
    from public.identity_verifications verification
    where verification.user_id = v_user_id
    order by verification.created_at desc, verification.id desc
    limit 1
  )
  select
    coalesce(phone.status, 'unverified')::text,
    phone.phone_e164,
    creatorbridge_private.user_phone_verified(v_user_id),
    phone.verified_at,
    coalesce(identity.status, 'consent_required')::text,
    creatorbridge_private.user_identity_verified(v_user_id),
    identity.updated_at,
    coalesce(identity.status = 'retry_required' and identity.attempt_count < 3, false),
    case coalesce(identity.status, 'consent_required')
      when 'manual_review' then 'Your identity check needs a secure review before protected actions can continue.'
      when 'duplicate_restricted' then 'This identity is already connected to another account. Recover that account or contact support.'
      when 'rejected' then 'This verification could not be approved. Contact support for the secure review process.'
      when 'reverification_required' then 'Please complete a new identity check before protected actions can continue.'
      else null
    end
  from (select 1) seed
  left join public.account_phone_verifications phone on phone.user_id = v_user_id
  left join latest_identity identity on true;
end;
$$;

revoke all on function public.get_my_trust_status() from public, anon;
grant execute on function public.get_my_trust_status() to authenticated;

create or replace function public.require_verified_project_parties(
  p_project_id uuid
)
returns table (
  client_user_id uuid,
  creator_user_id uuid,
  client_verified boolean,
  creator_verified boolean,
  both_verified boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_creator_user_id uuid;
  v_requester uuid := auth.uid();
begin
  select *
  into v_project
  from public.projects project
  where project.id = p_project_id;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  select listing.user_id
  into v_creator_user_id
  from public.creator_listings listing
  where listing.id::text = v_project.accepted_creator_id::text
  limit 1;

  if v_creator_user_id is null then
    raise exception 'Accepted creator could not be verified' using errcode = 'P0002';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and not public.is_platform_admin(v_requester)
    and v_requester not in (v_project.client_id, v_creator_user_id) then
    raise exception 'Project party access required' using errcode = '42501';
  end if;

  return query
  select
    v_project.client_id,
    v_creator_user_id,
    creatorbridge_private.user_identity_verified(v_project.client_id),
    creatorbridge_private.user_identity_verified(v_creator_user_id),
    creatorbridge_private.user_identity_verified(v_project.client_id)
      and creatorbridge_private.user_identity_verified(v_creator_user_id);
end;
$$;

revoke all on function public.require_verified_project_parties(uuid) from public, anon;
grant execute on function public.require_verified_project_parties(uuid) to authenticated, service_role;

create or replace function public.claim_identity_provider_event(
  p_event_id text,
  p_event_type text,
  p_provider_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed text;
begin
  insert into public.identity_provider_events (
    event_id,
    event_type,
    provider_session_id,
    processing_status,
    processing_error,
    received_at,
    processed_at
  )
  values (
    p_event_id,
    p_event_type,
    p_provider_session_id,
    'processing',
    null,
    now(),
    null
  )
  on conflict (event_id) do update
  set processing_status = 'processing',
      processing_error = null,
      received_at = now(),
      processed_at = null
  where public.identity_provider_events.processing_status = 'failed'
  returning event_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_identity_provider_event(text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_identity_provider_event(text, text, text)
  to service_role;

comment on table public.account_phone_verifications is
  'Private, provider-backed phone possession state. This table is the authorization source; public profile fields are not.';
comment on table public.identity_verifications is
  'Reduced Stripe Identity outcomes only. Provider media, face data, and full verification reports are prohibited.';
comment on function creatorbridge_private.user_identity_verified(uuid) is
  'Returns true only when the latest reduced identity record authorizes protected actions.';
