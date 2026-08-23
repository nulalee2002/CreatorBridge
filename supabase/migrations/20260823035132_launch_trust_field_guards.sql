-- Prevent authenticated Data API callers from changing fields that payment,
-- verification, moderation, and payout code treats as server-authoritative.
-- Service-role Edge Functions and database owners continue to perform trusted
-- transitions through their existing verified flows.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.guard_profile_trust_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
    new.role is distinct from old.role
    or new.referral_code is distinct from old.referral_code
    or new.referred_by_code is distinct from old.referred_by_code
    or new.first_booking_fee_waived is distinct from old.first_booking_fee_waived
    or new.next_booking_fee_waived is distinct from old.next_booking_fee_waived
  ) then
    raise exception 'Profile trust fields are managed by CreatorBridge'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_client_profile_trust_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
    new.user_id is distinct from old.user_id
    or new.email_verified is distinct from old.email_verified
    or new.phone_verified is distinct from old.phone_verified
    or new.payment_method_on_file is distinct from old.payment_method_on_file
    or new.first_booking_fee_waived is distinct from old.first_booking_fee_waived
    or new.next_booking_fee_waived is distinct from old.next_booking_fee_waived
    or new.spam_score is distinct from old.spam_score
    or new.avg_rating is distinct from old.avg_rating
    or new.total_projects_completed is distinct from old.total_projects_completed
    or new.cancellation_rate is distinct from old.cancellation_rate
    or new.total_reviews is distinct from old.total_reviews
    or new.fast_match_count is distinct from old.fast_match_count
  ) then
    raise exception 'Client trust fields are managed by CreatorBridge'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.guard_creator_listing_trust_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
    new.user_id is distinct from old.user_id
    or new.verified is distinct from old.verified
    or new.verification_status is distinct from old.verification_status
    or new.review_status is distinct from old.review_status
    or new.stripe_account_id is distinct from old.stripe_account_id
    or new.stripe_onboarded is distinct from old.stripe_onboarded
    or new.payouts_enabled is distinct from old.payouts_enabled
    or new.completed_projects is distinct from old.completed_projects
    or new.next_project_fee_pct is distinct from old.next_project_fee_pct
    or new.tier is distinct from old.tier
    or new.rating is distinct from old.rating
    or new.review_count is distinct from old.review_count
    or new.view_count is distinct from old.view_count
    or new.completion_rate is distinct from old.completion_rate
    or new.strike_count is distinct from old.strike_count
    or new.is_suspended is distinct from old.is_suspended
    or new.review_notes is distinct from old.review_notes
  ) then
    raise exception 'Creator trust fields are managed by CreatorBridge'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_trust_columns() from public, anon, authenticated;
revoke all on function private.guard_client_profile_trust_columns() from public, anon, authenticated;
revoke all on function private.guard_creator_listing_trust_columns() from public, anon, authenticated;

drop trigger if exists guard_profile_trust_columns on public.profiles;
create trigger guard_profile_trust_columns
before update on public.profiles
for each row execute function private.guard_profile_trust_columns();

drop trigger if exists guard_client_profile_trust_columns on public.client_profiles;
create trigger guard_client_profile_trust_columns
before update on public.client_profiles
for each row execute function private.guard_client_profile_trust_columns();

drop trigger if exists guard_creator_listing_trust_columns on public.creator_listings;
create trigger guard_creator_listing_trust_columns
before update on public.creator_listings
for each row execute function private.guard_creator_listing_trust_columns();
