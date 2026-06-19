-- CreatorBridge client invite credit program.
-- One level only, non-cash credits only, granted only after a referred client's
-- first paid project is released.

create table if not exists referral_program_settings (
  id boolean primary key default true,
  client_fee_waiver_pct numeric(4,2) not null default 5.00,
  creator_credit_amount_cents integer not null default 1000,
  creator_monthly_credit_cap_cents integer not null default 3000,
  min_auto_grant_project_amount_cents integer not null default 10000,
  updated_at timestamptz not null default now(),
  constraint referral_program_settings_singleton check (id),
  constraint referral_program_settings_nonnegative check (
    client_fee_waiver_pct >= 0
    and creator_credit_amount_cents >= 0
    and creator_monthly_credit_cap_cents >= 0
    and min_auto_grant_project_amount_cents >= 0
  )
);

insert into referral_program_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_client_id uuid not null references profiles(id) on delete cascade,
  referral_code text not null,
  transaction_id uuid references transactions(id) on delete set null,
  project_id text,
  status text not null default 'pending_review',
  reward_type text not null default 'creator_platform_credit',
  amount_cents integer not null default 0,
  reason text,
  review_reason text,
  granted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referred_client_id),
  constraint referral_rewards_status check (status in ('pending_review', 'granted', 'rejected')),
  constraint referral_rewards_type check (reward_type = 'creator_platform_credit'),
  constraint referral_rewards_amount_nonnegative check (amount_cents >= 0)
);

create index if not exists idx_referral_rewards_referrer on referral_rewards(referrer_id);
create index if not exists idx_referral_rewards_transaction on referral_rewards(transaction_id);

create table if not exists creator_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references profiles(id) on delete cascade,
  amount_cents integer not null,
  source text not null,
  referral_reward_id uuid references referral_rewards(id) on delete set null,
  transaction_id uuid references transactions(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint creator_credit_ledger_source check (source in ('client_invite_grant', 'creator_fee_offset', 'admin_adjustment')),
  constraint creator_credit_ledger_nonzero check (amount_cents <> 0)
);

create index if not exists idx_creator_credit_ledger_creator on creator_credit_ledger(creator_user_id);
create unique index if not exists idx_creator_credit_ledger_referral_grant
  on creator_credit_ledger(referral_reward_id)
  where source = 'client_invite_grant' and referral_reward_id is not null;
create unique index if not exists idx_creator_credit_ledger_transaction_offset
  on creator_credit_ledger(transaction_id)
  where source = 'creator_fee_offset' and transaction_id is not null;

alter table transactions
  add column if not exists creator_fee_before_credit integer,
  add column if not exists creator_credit_applied integer not null default 0,
  add column if not exists client_payment_method_id text,
  add column if not exists client_payment_fingerprint text,
  add column if not exists booking_ip inet,
  add column if not exists booking_user_agent text;

alter table referrals add column if not exists review_reason text;
alter table profiles
  add column if not exists signup_ip inet,
  add column if not exists signup_user_agent text;

alter table referral_program_settings enable row level security;
alter table referral_rewards enable row level security;
alter table creator_credit_ledger enable row level security;

drop policy if exists "Admins can manage referral settings" on referral_program_settings;
create policy "Admins can manage referral settings"
  on referral_program_settings for all
  using (is_platform_admin(auth.uid()))
  with check (is_platform_admin(auth.uid()));

drop policy if exists "Users can view own referral rewards" on referral_rewards;
create policy "Users can view own referral rewards"
  on referral_rewards for select
  using (auth.uid() = referrer_id or auth.uid() = referred_client_id or is_platform_admin(auth.uid()));

drop policy if exists "Creators can view own credit ledger" on creator_credit_ledger;
create policy "Creators can view own credit ledger"
  on creator_credit_ledger for select
  using (auth.uid() = creator_user_id or is_platform_admin(auth.uid()));

create or replace function grant_referral_credit_for_released_transaction(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  txn transactions%rowtype;
  client_profile profiles%rowtype;
  referrer_profile profiles%rowtype;
  settings referral_program_settings%rowtype;
  client_email text;
  referrer_email text;
  monthly_granted integer := 0;
  reward referral_rewards%rowtype;
  rejection_reason text;
  pending_reason text;
begin
  select * into txn
  from transactions
  where id = p_transaction_id
  limit 1;

  if txn.id is null then
    return jsonb_build_object('ok', false, 'status', 'missing_transaction');
  end if;

  if txn.final_status <> 'released' then
    return jsonb_build_object('ok', false, 'status', 'not_released');
  end if;

  select * into client_profile
  from profiles
  where id = txn.client_id
  limit 1;

  if client_profile.id is null or client_profile.referred_by_code is null then
    return jsonb_build_object('ok', true, 'status', 'no_referral');
  end if;

  select * into referrer_profile
  from profiles
  where referral_code = upper(client_profile.referred_by_code)
  limit 1;

  select * into settings
  from referral_program_settings
  where id = true
  limit 1;

  if settings.id is null then
    insert into referral_program_settings (id) values (true)
    on conflict (id) do nothing;
    select * into settings from referral_program_settings where id = true limit 1;
  end if;

  if referrer_profile.id is null then
    rejection_reason := 'referrer_not_found';
  elsif referrer_profile.role <> 'creator' then
    rejection_reason := 'referrer_not_creator';
  elsif referrer_profile.id = client_profile.id then
    rejection_reason := 'self_referral_same_user';
  elsif exists (
    select 1
    from transactions prior
    where prior.client_id = txn.client_id
      and prior.id <> txn.id
      and prior.final_status = 'released'
  ) then
    rejection_reason := 'not_first_released_booking';
  end if;

  if rejection_reason is null then
    select email into client_email from auth.users where id = client_profile.id limit 1;
    select email into referrer_email from auth.users where id = referrer_profile.id limit 1;

    if client_email is not null
       and referrer_email is not null
       and lower(client_email) = lower(referrer_email) then
      rejection_reason := 'self_referral_same_email';
    end if;
  end if;

  if rejection_reason is null and txn.client_payment_fingerprint is not null then
    if exists (
      select 1
      from transactions creator_paid
      where creator_paid.client_id = referrer_profile.id
        and creator_paid.client_payment_fingerprint = txn.client_payment_fingerprint
        and creator_paid.id <> txn.id
    ) then
      rejection_reason := 'self_referral_same_payment_method';
    end if;
  end if;

  if rejection_reason is null
     and client_profile.signup_ip is not null
     and referrer_profile.signup_ip is not null
     and client_profile.signup_ip = referrer_profile.signup_ip then
    pending_reason := 'shared_signup_ip_manual_review';
  end if;

  if rejection_reason is null
     and pending_reason is null
     and client_profile.signup_user_agent is not null
     and referrer_profile.signup_user_agent is not null
     and client_profile.signup_user_agent = referrer_profile.signup_user_agent then
    pending_reason := 'shared_signup_user_agent_manual_review';
  end if;

  if rejection_reason is null then
    select coalesce(sum(amount_cents), 0) into monthly_granted
    from referral_rewards
    where referrer_id = referrer_profile.id
      and status = 'granted'
      and granted_at >= date_trunc('month', now());

    if monthly_granted + settings.creator_credit_amount_cents > settings.creator_monthly_credit_cap_cents then
      rejection_reason := 'monthly_cap_reached';
    end if;
  end if;

  if rejection_reason is null and txn.project_amount < settings.min_auto_grant_project_amount_cents then
    pending_reason := 'small_booking_manual_review';
  end if;

  insert into referral_rewards (
    referrer_id,
    referred_client_id,
    referral_code,
    transaction_id,
    project_id,
    status,
    amount_cents,
    reason,
    review_reason,
    granted_at,
    rejected_at
  )
  values (
    coalesce(referrer_profile.id, client_profile.id),
    client_profile.id,
    client_profile.referred_by_code,
    txn.id,
    txn.project_id,
    case
      when rejection_reason is not null then 'rejected'
      when pending_reason is not null then 'pending_review'
      else 'granted'
    end,
    case when rejection_reason is null and pending_reason is null then settings.creator_credit_amount_cents else 0 end,
    rejection_reason,
    pending_reason,
    case when rejection_reason is null and pending_reason is null then now() else null end,
    case when rejection_reason is not null then now() else null end
  )
  on conflict (referred_client_id) do update set
    updated_at = referral_rewards.updated_at
  returning * into reward;

  if reward.status = 'granted' and reward.amount_cents > 0 then
    insert into creator_credit_ledger (
      creator_user_id,
      amount_cents,
      source,
      referral_reward_id,
      transaction_id,
      reason
    )
    values (
      reward.referrer_id,
      reward.amount_cents,
      'client_invite_grant',
      reward.id,
      txn.id,
      'client_invite_completed_project'
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', reward.status,
    'rewardId', reward.id,
    'amountCents', reward.amount_cents,
    'reason', coalesce(reward.reason, reward.review_reason)
  );
end;
$$;

revoke all on function grant_referral_credit_for_released_transaction(uuid) from public;
grant execute on function grant_referral_credit_for_released_transaction(uuid) to service_role;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  incoming_referral_code text := nullif(upper(new.raw_user_meta_data->>'referral_code'), '');
  raw_signup_ip text := nullif(new.raw_user_meta_data->>'signup_ip', '');
  referrer profiles%rowtype;
begin
  if requested_role not in ('creator', 'client') then
    requested_role := 'client';
  end if;

  select * into referrer
  from profiles
  where referral_code = incoming_referral_code
  limit 1;

  if requested_role <> 'client'
     or referrer.id is null
     or referrer.role <> 'creator'
     or referrer.id = new.id then
    incoming_referral_code := null;
  end if;

  insert into profiles (
    id,
    role,
    full_name,
    referral_code,
    referred_by_code,
    first_booking_fee_waived,
    signup_ip,
    signup_user_agent
  )
  values (
    new.id,
    requested_role,
    new.raw_user_meta_data->>'full_name',
    upper(substr(replace(new.id::text, '-', ''), 1, 8)),
    incoming_referral_code,
    incoming_referral_code is not null,
    case when raw_signup_ip ~ '^[0-9a-fA-F:.]+$' then raw_signup_ip::inet else null end,
    nullif(new.raw_user_meta_data->>'signup_user_agent', '')
  )
  on conflict (id) do update set
    role = excluded.role,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    referral_code = coalesce(profiles.referral_code, excluded.referral_code),
    referred_by_code = coalesce(profiles.referred_by_code, excluded.referred_by_code),
    first_booking_fee_waived = profiles.first_booking_fee_waived or excluded.first_booking_fee_waived,
    signup_ip = coalesce(profiles.signup_ip, excluded.signup_ip),
    signup_user_agent = coalesce(profiles.signup_user_agent, excluded.signup_user_agent),
    updated_at = now();

  if incoming_referral_code is not null then
    insert into referrals (
      referrer_id,
      referred_user_id,
      referral_code,
      referrer_type,
      referred_user_type,
      status,
      reward_type,
      review_reason
    )
    values (
      referrer.id,
      new.id,
      incoming_referral_code,
      referrer.role,
      requested_role,
      'signed_up',
      'creator_platform_credit',
      'credit_grants_only_after_first_released_project'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;;
