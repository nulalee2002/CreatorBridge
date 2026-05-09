-- CreatorBridge prelaunch platform hardening
-- Idempotent migration for referral, approval, project workflow, quote, payment, and RLS source changes.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Profiles and referral signup metadata
alter table profiles add column if not exists referral_code text;
alter table profiles add column if not exists referred_by_code text;
alter table profiles add column if not exists first_booking_fee_waived boolean default false;
alter table profiles add column if not exists next_booking_fee_waived boolean default false;
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexdef ilike '%unique index%'
      and indexdef ilike '%(referral_code)%'
  ) then
    create unique index idx_profiles_referral_code on profiles(referral_code);
  end if;
end;
$$;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references auth.users(id) not null,
  referred_user_id uuid references auth.users(id),
  referral_code text not null,
  referrer_type text not null,
  referred_user_type text,
  status text default 'pending',
  reward_type text,
  reward_issued boolean default false,
  reward_issued_at timestamptz,
  completed_project_id text,
  completed_transaction_id uuid,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table referrals add column if not exists completed_project_id text;
alter table referrals add column if not exists completed_transaction_id uuid;
create index if not exists idx_referrals_referrer on referrals(referrer_id);
create index if not exists idx_referrals_code on referrals(referral_code);

-- Core marketplace tables that older live environments may not have yet
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id uuid references profiles(id) on delete cascade,
  recipient_id uuid references profiles(id) on delete cascade,
  listing_id uuid references creator_listings(id) on delete set null,
  body text not null,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references profiles(id) on delete cascade,
  title text not null,
  service_id text,
  description text not null,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  location text,
  timeline text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists project_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  listing_id uuid references creator_listings(id) on delete cascade,
  message text,
  proposed_rate numeric(10,2),
  status text default 'pending',
  created_at timestamptz default now(),
  unique(project_id, listing_id)
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references creator_listings(id) on delete cascade,
  date date not null,
  status text default 'booked',
  note text,
  unique(listing_id, date)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references creator_listings(id) on delete cascade,
  plan text not null,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text default 'active',
  current_period_end timestamptz,
  created_at timestamptz default now()
);

create table if not exists violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  violation_type text not null,
  description text,
  strike_number integer not null,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists message_filter_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  pattern_type text not null,
  created_at timestamptz default now()
);

alter table creator_services add column if not exists subtypes text[] default '{}';
alter table creator_services add column if not exists description text;
alter table portfolio_items add column if not exists display_order integer default 0;
alter table packages add column if not exists display_order integer default 0;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  incoming_referral_code text := nullif(upper(new.raw_user_meta_data->>'referral_code'), '');
  referrer profiles%rowtype;
  reward_kind text;
begin
  if requested_role not in ('creator', 'client') then
    requested_role := 'client';
  end if;

  insert into profiles (id, role, full_name, referral_code, referred_by_code, first_booking_fee_waived)
  values (
    new.id,
    requested_role,
    new.raw_user_meta_data->>'full_name',
    upper(substr(replace(new.id::text, '-', ''), 1, 8)),
    incoming_referral_code,
    incoming_referral_code is not null
  )
  on conflict (id) do update set
    role = excluded.role,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    referral_code = coalesce(profiles.referral_code, excluded.referral_code),
    referred_by_code = coalesce(profiles.referred_by_code, excluded.referred_by_code),
    first_booking_fee_waived = profiles.first_booking_fee_waived or excluded.first_booking_fee_waived,
    updated_at = now();

  if incoming_referral_code is not null then
    select * into referrer from profiles where profiles.referral_code = incoming_referral_code limit 1;

    if referrer.id is not null and referrer.id <> new.id then
      reward_kind := case
        when referrer.role = 'creator' and requested_role = 'creator' then 'fee_reduction'
        when referrer.role = 'creator' and requested_role = 'client' then 'tier_boost'
        when referrer.role = 'client' and requested_role = 'client' then 'booking_fee_waived'
        else 'booking_fee_waived'
      end;

      insert into referrals (
        referrer_id,
        referred_user_id,
        referral_code,
        referrer_type,
        referred_user_type,
        status,
        reward_type
      )
      values (
        referrer.id,
        new.id,
        incoming_referral_code,
        referrer.role,
        requested_role,
        'signed_up',
        reward_kind
      )
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Quote request fields written by app flows
alter table quote_requests add column if not exists client_id uuid references profiles(id) on delete set null;
alter table quote_requests add column if not exists timeline text;
alter table quote_requests add column if not exists status text default 'pending';
alter table quote_requests add column if not exists project_title text;
alter table quote_requests add column if not exists project_type text;
alter table quote_requests add column if not exists project_time text;
alter table quote_requests add column if not exists venue_address text;
alter table quote_requests add column if not exists venue_city text;
alter table quote_requests add column if not exists venue_state text;
alter table quote_requests add column if not exists venue_type text;
alter table quote_requests add column if not exists hours_needed text;
alter table quote_requests add column if not exists deliverables text;
alter table quote_requests add column if not exists budget_range text;
alter table quote_requests add column if not exists location_preference text;

-- Project workflow fields used by proposal, delivery, approval, and payment flows
alter table projects add column if not exists accepted_creator_id text;
alter table projects add column if not exists accepted_application_id text;
alter table projects add column if not exists delivered_at timestamptz;
alter table projects add column if not exists approved_at timestamptz;
alter table projects add column if not exists delivery_link text;
alter table projects add column if not exists delivery_notes text;
alter table projects add column if not exists revision_count integer default 0;
alter table projects add column if not exists applications integer default 0;

-- Creator approval, payout, loyalty, and referral reward fields
alter table creator_listings add column if not exists years_experience integer;
alter table creator_listings add column if not exists availability text default 'available';
alter table creator_listings add column if not exists completed_projects integer default 0;
alter table creator_listings add column if not exists next_project_fee_pct numeric(4,2);
alter table creator_listings add column if not exists verification_status text default 'unverified';
alter table creator_listings add column if not exists verification_steps jsonb default '{}';
alter table creator_listings add column if not exists submitted_at timestamptz default now();
alter table creator_listings add column if not exists review_status text default 'pending_review';
alter table creator_listings add column if not exists youtube text;
alter table creator_listings add column if not exists vimeo text;
alter table creator_listings add column if not exists linkedin text;
alter table creator_listings add column if not exists tier text default 'launch';
alter table creator_listings add column if not exists completion_rate numeric(5,2) default 100;
alter table creator_listings add column if not exists video_intro_url text;

-- Client profile and reputation fields
create table if not exists client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  display_name text,
  phone text,
  company_name text,
  tos_accepted_at timestamptz,
  email_verified boolean default false,
  phone_verified boolean default false,
  payment_method_on_file boolean default false,
  first_booking_fee_waived boolean default false,
  next_booking_fee_waived boolean default false,
  spam_score integer default 0,
  avg_rating numeric(3,2) default 0,
  total_projects_completed integer default 0,
  cancellation_rate numeric(5,2) default 0,
  total_reviews integer default 0,
  fast_match_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table client_profiles add column if not exists first_booking_fee_waived boolean default false;
alter table client_profiles add column if not exists next_booking_fee_waived boolean default false;
alter table client_profiles add column if not exists avg_rating numeric(3,2) default 0;
alter table client_profiles add column if not exists total_projects_completed integer default 0;
alter table client_profiles add column if not exists cancellation_rate numeric(5,2) default 0;
alter table client_profiles add column if not exists total_reviews integer default 0;
alter table client_profiles add column if not exists fast_match_count integer default 0;

create table if not exists client_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id) not null,
  creator_id text,
  reviewer_id uuid references auth.users(id),
  project_id text not null,
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now()
);

alter table client_reviews add column if not exists creator_id text;
alter table client_reviews alter column creator_id drop not null;
alter table client_reviews add column if not exists reviewer_id uuid references auth.users(id);
create index if not exists idx_client_reviews_client on client_reviews(client_id);

-- Payment tables, kept idempotent for environments that have not received the earlier payment schema yet
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  creator_id text not null,
  client_id uuid references auth.users(id) not null,
  project_amount integer not null,
  retainer_amount integer not null,
  final_amount integer not null,
  creator_fee_pct numeric(4,2) default 10.00,
  client_fee_pct numeric(4,2) default 5.00,
  creator_fee_amount integer not null,
  client_fee_amount integer not null,
  platform_revenue integer not null,
  retainer_status text default 'pending',
  final_status text default 'pending',
  retainer_payment_intent text,
  final_payment_intent text,
  retainer_transfer_id text,
  final_transfer_id text,
  retainer_paid_at timestamptz,
  final_paid_at timestamptz,
  retainer_released_at timestamptz,
  final_released_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) not null,
  event_type text not null,
  actor_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) not null,
  raised_by uuid references auth.users(id) not null,
  reason text not null,
  status text default 'open',
  resolution_notes text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- RLS enablement
alter table profiles enable row level security;
alter table creator_listings enable row level security;
alter table creator_services enable row level security;
alter table portfolio_items enable row level security;
alter table packages enable row level security;
alter table availability enable row level security;
alter table reviews enable row level security;
alter table favorites enable row level security;
alter table quote_requests enable row level security;
alter table messages enable row level security;
alter table projects enable row level security;
alter table project_applications enable row level security;
alter table client_profiles enable row level security;
alter table client_reviews enable row level security;
alter table referrals enable row level security;
alter table transactions enable row level security;
alter table payment_events enable row level security;
alter table disputes enable row level security;
alter table violations enable row level security;
alter table message_filter_events enable row level security;

-- Security-definer helpers are trigger/internal utilities, not public RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Core RLS refresh
drop policy if exists "Profiles are viewable by everyone" on profiles;
create policy "Profiles are viewable by everyone" on profiles for select to anon, authenticated using (true);

drop policy if exists "Anyone can view listings" on creator_listings;
drop policy if exists "Users can insert own listing" on creator_listings;
drop policy if exists "Users can update own listing" on creator_listings;

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Listings are viewable by everyone" on creator_listings;
create policy "Listings are viewable by everyone" on creator_listings for select to anon, authenticated using (true);

drop policy if exists "Creators can insert own listings" on creator_listings;
create policy "Creators can insert own listings" on creator_listings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Creators can update own listings" on creator_listings;
create policy "Creators can update own listings" on creator_listings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Quote requests viewable by participants" on quote_requests;
drop policy if exists "Listing owners can view quotes" on quote_requests;
drop policy if exists "Creators can view their quote requests" on quote_requests;
create policy "Creators can view their quote requests" on quote_requests for select to authenticated
  using (
    ((select auth.uid()) = client_id)
    or exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid()))
  );

drop policy if exists "Anyone can send quote requests" on quote_requests;
drop policy if exists "Anyone can insert quotes" on quote_requests;
drop policy if exists "Authenticated clients can send quote requests" on quote_requests;
create policy "Authenticated clients can send quote requests" on quote_requests for insert to authenticated
  with check ((select auth.uid()) = client_id);

drop policy if exists "Creators can update quote status" on quote_requests;
create policy "Creators can update quote status" on quote_requests for update to authenticated
  using (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  with check (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

drop policy if exists "Projects viewable by everyone" on projects;
create policy "Projects viewable by everyone" on projects for select to anon, authenticated using (true);

drop policy if exists "Clients can manage own projects" on projects;
create policy "Clients can manage own projects" on projects for all to authenticated
  using ((select auth.uid()) = client_id)
  with check ((select auth.uid()) = client_id);

drop policy if exists "Accepted creators can update delivery fields" on projects;
create policy "Accepted creators can update delivery fields" on projects for update to authenticated
  using (accepted_creator_id in (select id::text from creator_listings where user_id = (select auth.uid())))
  with check (accepted_creator_id in (select id::text from creator_listings where user_id = (select auth.uid())));

drop policy if exists "Applications viewable by project owner and applicant" on project_applications;
create policy "Applications viewable by project owner and applicant" on project_applications for select to authenticated
  using (
    exists (select 1 from projects where id = project_id and client_id = (select auth.uid()))
    or exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid()))
  );

drop policy if exists "Creators can apply to projects" on project_applications;
create policy "Creators can apply to projects" on project_applications for insert to authenticated
  with check (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

drop policy if exists "Project owners can update applications" on project_applications;
create policy "Project owners can update applications" on project_applications for update to authenticated
  using (exists (select 1 from projects where id = project_id and client_id = (select auth.uid())))
  with check (exists (select 1 from projects where id = project_id and client_id = (select auth.uid())));

drop policy if exists "Availability is viewable by everyone" on availability;
create policy "Availability is viewable by everyone" on availability for select to anon, authenticated using (true);

drop policy if exists "Creators can manage own availability" on availability;
drop policy if exists "Creators can insert own availability" on availability;
create policy "Creators can insert own availability" on availability for insert to authenticated
  with check (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

drop policy if exists "Creators can update own availability" on availability;
create policy "Creators can update own availability" on availability for update to authenticated
  using (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  with check (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

drop policy if exists "Creators can delete own availability" on availability;
create policy "Creators can delete own availability" on availability for delete to authenticated
  using (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

drop policy if exists "Creators can view own subscriptions" on subscriptions;
create policy "Creators can view own subscriptions" on subscriptions for select to authenticated
  using (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

drop policy if exists "Users can view own client profile" on client_profiles;
create policy "Users can view own client profile" on client_profiles for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own client profile" on client_profiles;
create policy "Users can insert own client profile" on client_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own client profile" on client_profiles;
create policy "Users can update own client profile" on client_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Creators can insert client reviews" on client_reviews;
create policy "Creators can insert client reviews" on client_reviews for insert to authenticated
  with check (reviewer_id = (select auth.uid()));

drop policy if exists "Anyone can view client reviews" on client_reviews;
create policy "Anyone can view client reviews" on client_reviews for select to authenticated using (true);

drop policy if exists "Users can view own referrals" on referrals;
create policy "Users can view own referrals" on referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_user_id = (select auth.uid()));

drop policy if exists "Users can create own referrals" on referrals;
create policy "Users can create own referrals" on referrals for insert to authenticated
  with check (referrer_id = (select auth.uid()));

drop policy if exists "Users can view own transactions" on transactions;
create policy "Users can view own transactions" on transactions for select to authenticated
  using (
    client_id = (select auth.uid())
    or creator_id in (select id::text from creator_listings where user_id = (select auth.uid()))
  );

drop policy if exists "Users can insert transactions" on transactions;
create policy "Users can insert transactions" on transactions for insert to authenticated
  with check (client_id = (select auth.uid()));

drop policy if exists "Participants can view payment events" on payment_events;
create policy "Participants can view payment events" on payment_events for select to authenticated
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (
        t.client_id = (select auth.uid())
        or t.creator_id in (select id::text from creator_listings where user_id = (select auth.uid()))
      )
    )
  );

drop policy if exists "Users can view own disputes" on disputes;
create policy "Users can view own disputes" on disputes for select to authenticated
  using (
    raised_by = (select auth.uid())
    or exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (
        t.client_id = (select auth.uid())
        or t.creator_id in (select id::text from creator_listings where user_id = (select auth.uid()))
      )
    )
  );

drop policy if exists "Users can insert disputes" on disputes;
drop policy if exists "Users can open disputes" on disputes;
create policy "Users can open disputes" on disputes for insert to authenticated
  with check (
    raised_by = (select auth.uid())
    and exists (
      select 1 from transactions t
      where t.id = transaction_id
      and (
        t.client_id = (select auth.uid())
        or t.creator_id in (select id::text from creator_listings where user_id = (select auth.uid()))
      )
    )
  );

drop policy if exists "Users can view own violations" on violations;
create policy "Users can view own violations" on violations for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own filter events" on message_filter_events;
create policy "Users can insert own filter events" on message_filter_events for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can view own payment events" on payment_events;

drop policy if exists "Users can view their messages" on messages;
create policy "Users can view their messages" on messages for select to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

drop policy if exists "Authenticated users can send messages" on messages;
create policy "Authenticated users can send messages" on messages for insert to authenticated
  with check ((select auth.uid()) = sender_id);

create index if not exists idx_transactions_client on transactions(client_id);
create index if not exists idx_transactions_project on transactions(project_id);
create index if not exists idx_payment_events_txn on payment_events(transaction_id);
create index if not exists idx_disputes_txn on disputes(transaction_id);
create index if not exists idx_violations_user on violations(user_id);
create index if not exists idx_filter_events_user on message_filter_events(user_id);
create index if not exists idx_creator_listings_user on creator_listings(user_id);
create index if not exists idx_creator_services_listing on creator_services(listing_id);
create index if not exists idx_portfolio_items_listing on portfolio_items(listing_id);
create index if not exists idx_packages_listing on packages(listing_id);
create index if not exists idx_favorites_listing on favorites(listing_id);
create index if not exists idx_quote_requests_listing on quote_requests(listing_id);
create index if not exists idx_quote_requests_client on quote_requests(client_id);
create index if not exists idx_messages_sender on messages(sender_id);
create index if not exists idx_messages_recipient on messages(recipient_id);
create index if not exists idx_messages_listing on messages(listing_id);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_project_applications_listing on project_applications(listing_id);
create index if not exists idx_subscriptions_listing on subscriptions(listing_id);
create index if not exists idx_client_reviews_reviewer on client_reviews(reviewer_id);
create index if not exists idx_disputes_raised_by on disputes(raised_by);
create index if not exists idx_referrals_referred_user on referrals(referred_user_id);
create index if not exists idx_reviews_listing on reviews(listing_id);
create index if not exists idx_reviews_reviewer on reviews(reviewer_id);
create index if not exists idx_network_posts_user on network_posts(user_id);
create index if not exists idx_network_post_likes_user on network_post_likes(user_id);
create index if not exists idx_network_replies_post on network_replies(post_id);
create index if not exists idx_network_replies_user on network_replies(user_id);
create index if not exists idx_state_chat_messages_user on state_chat_messages(user_id);

do $$
begin
  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexname = 'profiles_referral_code_key'
  ) then
    drop index if exists idx_profiles_referral_code;
  end if;
end;
$$;
