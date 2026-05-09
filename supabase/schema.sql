-- ============================================================
-- CreatorBridge Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────
-- One profile per auth user (creator or client)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client', -- 'creator' | 'client'
  full_name text,
  referral_code text unique,
  referred_by_code text,
  first_booking_fee_waived boolean default false,
  next_booking_fee_waived boolean default false,
  avatar_url text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_booking_fee_waived boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_booking_fee_waived boolean DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'client');
  referral_code text := nullif(upper(new.raw_user_meta_data->>'referral_code'), '');
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
    referral_code,
    referral_code is not null
  );

  if referral_code is not null then
    select * into referrer from profiles where profiles.referral_code = referral_code limit 1;
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
        referral_code,
        referrer.role,
        requested_role,
        'signed_up',
        reward_kind
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── CREATOR LISTINGS ─────────────────────────────────────────
create table if not exists creator_listings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  business_name text,
  avatar text default '🎬',
  bio text,
  experience text default 'mid', -- 'entry' | 'mid' | 'senior'
  years_experience int,
  tags text[] default '{}',
  availability text default 'available', -- 'available' | 'busy' | 'unavailable'
  verified boolean default false,
  plan text default 'free', -- 'free' | 'pro' | 'studio'
  -- Location
  city text,
  state text,
  country text default 'US',
  zip text,
  region_key text default 'us-tier2',
  -- Contact
  email text,
  phone text,
  website text,
  instagram text,
  -- Stats
  rating numeric(3,1),
  review_count int default 0,
  view_count int default 0,
  -- Stripe
  stripe_account_id text,
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── CREATOR SERVICES ─────────────────────────────────────────
create table if not exists creator_services (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  service_id text not null, -- 'video' | 'photography' | etc.
  subtypes text[] default '{}',
  description text,
  rates jsonb default '{}',
  created_at timestamptz default now()
);

-- ── PORTFOLIO ITEMS ──────────────────────────────────────────
create table if not exists portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  service_id text,
  title text not null,
  description text,
  image_url text,
  link text,
  display_order int default 0,
  created_at timestamptz default now()
);

-- ── PACKAGES ─────────────────────────────────────────────────
create table if not exists packages (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  service_id text not null,
  name text not null, -- 'Basic' | 'Standard' | 'Premium'
  description text,
  price numeric(10,2) not null,
  deliverables text[] default '{}',
  turnaround_days int,
  revisions int default 1,
  display_order int default 0,
  created_at timestamptz default now()
);

-- ── AVAILABILITY ─────────────────────────────────────────────
create table if not exists availability (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  date date not null,
  status text default 'booked', -- 'booked' | 'available' | 'tentative'
  note text,
  unique(listing_id, date)
);

-- ── REVIEWS ──────────────────────────────────────────────────
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  reviewer_id uuid references profiles(id) on delete set null,
  reviewer_name text,
  rating int not null check (rating between 1 and 5),
  comment text,
  service_id text,
  verified_purchase boolean default false,
  created_at timestamptz default now()
);

-- ── FAVORITES ────────────────────────────────────────────────
create table if not exists favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade,
  listing_id uuid references creator_listings(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, listing_id)
);

-- ── QUOTE REQUESTS ───────────────────────────────────────────
create table if not exists quote_requests (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  client_id uuid references profiles(id) on delete set null,
  client_name text not null,
  client_email text not null,
  service_id text,
  budget numeric(10,2),
  description text not null,
  timeline text,
  status text default 'pending', -- 'pending' | 'viewed' | 'responded' | 'declined'
  created_at timestamptz default now()
);

ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS project_title text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS project_type text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS project_time text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS venue_address text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS venue_city text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS venue_state text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS venue_type text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS hours_needed text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS deliverables text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS budget_range text;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS location_preference text;

-- ── MESSAGES ─────────────────────────────────────────────────
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null,
  sender_id uuid references profiles(id) on delete cascade,
  recipient_id uuid references profiles(id) on delete cascade,
  listing_id uuid references creator_listings(id) on delete set null,
  body text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ── PROJECTS ─────────────────────────────────────────────────
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references profiles(id) on delete cascade,
  title text not null,
  service_id text,
  description text not null,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  location text,
  timeline text,
  status text default 'open', -- 'open' | 'in_progress' | 'completed' | 'cancelled'
  created_at timestamptz default now()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS accepted_creator_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accepted_application_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_link text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS revision_count integer DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS applications integer DEFAULT 0;

-- Project applications (creators apply to projects)
create table if not exists project_applications (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  listing_id uuid references creator_listings(id) on delete cascade,
  message text,
  proposed_rate numeric(10,2),
  status text default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at timestamptz default now(),
  unique(project_id, listing_id)
);

-- ── SUBSCRIPTIONS ────────────────────────────────────────────
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references creator_listings(id) on delete cascade,
  plan text not null, -- 'free' | 'pro' | 'studio'
  stripe_subscription_id text,
  stripe_customer_id text,
  status text default 'active',
  current_period_end timestamptz,
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
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
alter table subscriptions enable row level security;

-- Profiles: users can read all, update only their own
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Listings: public read, creators manage their own
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON creator_listings;
CREATE POLICY "Listings are viewable by everyone"
  ON creator_listings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Creators can insert own listings" ON creator_listings;
CREATE POLICY "Creators can insert own listings"
  ON creator_listings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Creators can update own listings" ON creator_listings;
CREATE POLICY "Creators can update own listings"
  ON creator_listings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Creators can delete own listings" ON creator_listings;
CREATE POLICY "Creators can delete own listings"
  ON creator_listings FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Services, portfolio, packages, availability: follow listing ownership
DROP POLICY IF EXISTS "Services viewable by everyone" ON creator_services;
CREATE POLICY "Services viewable by everyone"
  ON creator_services FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Creators manage own services" ON creator_services;
CREATE POLICY "Creators manage own services"
  ON creator_services FOR ALL
  TO authenticated
  USING (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  WITH CHECK (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Portfolio viewable by everyone" ON portfolio_items;
CREATE POLICY "Portfolio viewable by everyone"
  ON portfolio_items FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Creators manage own portfolio" ON portfolio_items;
CREATE POLICY "Creators manage own portfolio"
  ON portfolio_items FOR ALL
  TO authenticated
  USING (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  WITH CHECK (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Packages viewable by everyone" ON packages;
CREATE POLICY "Packages viewable by everyone"
  ON packages FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Creators manage own packages" ON packages;
CREATE POLICY "Creators manage own packages"
  ON packages FOR ALL
  TO authenticated
  USING (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  WITH CHECK (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Availability viewable by everyone" ON availability;
CREATE POLICY "Availability viewable by everyone"
  ON availability FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Creators manage own availability" ON availability;
CREATE POLICY "Creators manage own availability"
  ON availability FOR ALL
  TO authenticated
  USING (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  WITH CHECK (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

-- Reviews: public read, authenticated users can write
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON reviews;
CREATE POLICY "Reviews viewable by everyone"
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can write reviews" ON reviews;
CREATE POLICY "Authenticated users can write reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) is not null);

-- Favorites: users manage their own
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
CREATE POLICY "Users can manage own favorites"
  ON favorites FOR ALL
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Quote requests: clients create, creators view and respond to their own
DROP POLICY IF EXISTS "Creators can view their quote requests" ON quote_requests;
CREATE POLICY "Creators can view their quote requests"
  ON quote_requests FOR SELECT
  TO authenticated
  USING (
    ((select auth.uid()) = client_id)
    OR exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Anyone can send quote requests" ON quote_requests;
DROP POLICY IF EXISTS "Authenticated clients can send quote requests" ON quote_requests;
CREATE POLICY "Authenticated clients can send quote requests"
  ON quote_requests FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = client_id);

DROP POLICY IF EXISTS "Creators can update quote status" ON quote_requests;
CREATE POLICY "Creators can update quote status"
  ON quote_requests FOR UPDATE
  TO authenticated
  USING (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())))
  WITH CHECK (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

-- Messages: participants can read/write their own
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = sender_id OR (select auth.uid()) = recipient_id);

DROP POLICY IF EXISTS "Authenticated users can send messages" ON messages;
CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = sender_id);

-- Projects: public read, clients manage their own, accepted creators can update workflow delivery state
DROP POLICY IF EXISTS "Projects viewable by everyone" ON projects;
CREATE POLICY "Projects viewable by everyone"
  ON projects FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Clients can manage own projects" ON projects;
CREATE POLICY "Clients can manage own projects"
  ON projects FOR ALL
  TO authenticated
  USING ((select auth.uid()) = client_id)
  WITH CHECK ((select auth.uid()) = client_id);

DROP POLICY IF EXISTS "Accepted creators can update delivery fields" ON projects;
CREATE POLICY "Accepted creators can update delivery fields"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    accepted_creator_id IN (
      SELECT id::text FROM creator_listings WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    accepted_creator_id IN (
      SELECT id::text FROM creator_listings WHERE user_id = (select auth.uid())
    )
  );

-- Project applications: creators apply, clients see and accept applications for their projects
DROP POLICY IF EXISTS "Applications viewable by project owner and applicant" ON project_applications;
CREATE POLICY "Applications viewable by project owner and applicant"
  ON project_applications FOR SELECT
  TO authenticated
  USING (
    exists (select 1 from projects where id = project_id and client_id = (select auth.uid()))
    OR exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Creators can apply to projects" ON project_applications;
CREATE POLICY "Creators can apply to projects"
  ON project_applications FOR INSERT
  TO authenticated
  WITH CHECK (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Project owners can update applications" ON project_applications;
CREATE POLICY "Project owners can update applications"
  ON project_applications FOR UPDATE
  TO authenticated
  USING (exists (select 1 from projects where id = project_id and client_id = (select auth.uid())))
  WITH CHECK (exists (select 1 from projects where id = project_id and client_id = (select auth.uid())));

-- Subscriptions: creators can view subscription rows attached to their listing
DROP POLICY IF EXISTS "Creators can view own subscriptions" ON subscriptions;
CREATE POLICY "Creators can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (exists (select 1 from creator_listings where id = listing_id and user_id = (select auth.uid())));

-- ── STORAGE BUCKETS ──────────────────────────────────────────
-- Run these separately in Supabase Storage settings:
-- Create bucket: "portfolio-images" (public)
-- Create bucket: "avatars" (public)

-- ── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_listings_region on creator_listings(region_key);
create index if not exists idx_listings_country on creator_listings(country);
create index if not exists idx_services_listing on creator_services(listing_id);
create index if not exists idx_services_type on creator_services(service_id);
create index if not exists idx_portfolio_listing on portfolio_items(listing_id);
create index if not exists idx_reviews_listing on reviews(listing_id);
create index if not exists idx_favorites_user on favorites(user_id);
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_projects_status on projects(status);

-- ============================================================
-- STRIPE CONNECT + PAYMENTS (appended)
-- ============================================================

-- Add Stripe fields to creator_listings (idempotent)
ALTER TABLE creator_listings
  ADD COLUMN IF NOT EXISTS stripe_onboarded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_enabled  boolean DEFAULT false;
-- Note: stripe_account_id already exists in the original schema

-- ── TRANSACTIONS ─────────────────────────────────────────────
-- All monetary amounts stored in CENTS (integers)
CREATE TABLE IF NOT EXISTS transactions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             text NOT NULL,
  creator_id             text NOT NULL,
  client_id              uuid REFERENCES auth.users(id) NOT NULL,

  project_amount         integer NOT NULL,  -- total project value in cents
  retainer_amount        integer NOT NULL,  -- 50% in cents
  final_amount           integer NOT NULL,  -- 50% in cents
  creator_fee_pct        numeric(4,2) DEFAULT 10.00,
  client_fee_pct         numeric(4,2) DEFAULT 5.00,
  creator_fee_amount     integer NOT NULL,  -- platform take from creator in cents
  client_fee_amount      integer NOT NULL,  -- platform take from client in cents
  platform_revenue       integer NOT NULL,  -- total platform revenue in cents

  retainer_status        text DEFAULT 'pending',   -- pending | paid | released | refunded
  final_status           text DEFAULT 'pending',   -- pending | paid | released | refunded

  retainer_payment_intent text,
  final_payment_intent    text,
  retainer_transfer_id    text,
  final_transfer_id       text,

  retainer_paid_at       timestamptz,
  final_paid_at          timestamptz,
  retainer_released_at   timestamptz,
  final_released_at      timestamptz,

  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- ── PAYMENT EVENTS LOG ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) NOT NULL,
  event_type     text NOT NULL,  -- e.g. retainer_paid, final_released, disputed
  actor_id       uuid,
  metadata       jsonb DEFAULT '{}',
  created_at     timestamptz DEFAULT now()
);

-- ── DISPUTES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   uuid REFERENCES transactions(id) NOT NULL,
  raised_by        uuid REFERENCES auth.users(id) NOT NULL,
  reason           text NOT NULL,
  status           text DEFAULT 'open',  -- open | resolved | closed
  resolution_notes text,
  created_at       timestamptz DEFAULT now(),
  resolved_at      timestamptz
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    client_id = (select auth.uid())
    OR creator_id IN (
      SELECT id::text FROM creator_listings WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert transactions" ON transactions;
CREATE POLICY "Users can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Participants can view payment events" ON payment_events;
CREATE POLICY "Participants can view payment events"
  ON payment_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (
          t.client_id = (select auth.uid())
          OR t.creator_id IN (
            SELECT id::text FROM creator_listings WHERE user_id = (select auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can view own disputes" ON disputes;
CREATE POLICY "Users can view own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    raised_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (
          t.client_id = (select auth.uid())
          OR t.creator_id IN (
            SELECT id::text FROM creator_listings WHERE user_id = (select auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can open disputes" ON disputes;
CREATE POLICY "Users can open disputes"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    raised_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_id
        AND (
          t.client_id = (select auth.uid())
          OR t.creator_id IN (
            SELECT id::text FROM creator_listings WHERE user_id = (select auth.uid())
          )
        )
    )
  );

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_client   ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project  ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_txn    ON payment_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_txn          ON disputes(transaction_id);

-- ── VIOLATIONS (Strike system) ──────────────────────────────
CREATE TABLE IF NOT EXISTS violations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) NOT NULL,
  violation_type text NOT NULL,
  description    text,
  strike_number  integer NOT NULL,
  status         text DEFAULT 'active',
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own violations" ON violations;
CREATE POLICY "Users can view own violations"
  ON violations FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_violations_user ON violations(user_id);

-- ── MESSAGE FILTER EVENTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_filter_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) NOT NULL,
  pattern_type text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE message_filter_events ENABLE ROW LEVEL SECURITY;

-- Only admins (service role) can read filter events
DROP POLICY IF EXISTS "Users can insert own filter events" ON message_filter_events;
CREATE POLICY "Users can insert own filter events"
  ON message_filter_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_filter_events_user ON message_filter_events(user_id);

-- ── LOYALTY: completed_projects on creator_listings ──────────
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS completed_projects integer DEFAULT 0;
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS next_project_fee_pct numeric(4,2);

-- ── CLIENT PROFILES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_profiles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  display_name            text,
  phone                   text,
  company_name            text,
  tos_accepted_at         timestamptz,
  email_verified          boolean DEFAULT false,
  phone_verified          boolean DEFAULT false,
  payment_method_on_file  boolean DEFAULT false,
  first_booking_fee_waived boolean DEFAULT false,
  next_booking_fee_waived boolean DEFAULT false,
  spam_score              integer DEFAULT 0,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS first_booking_fee_waived boolean DEFAULT false;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS next_booking_fee_waived boolean DEFAULT false;

ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own client profile" ON client_profiles;
CREATE POLICY "Users can view own client profile"
  ON client_profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own client profile" ON client_profiles;
CREATE POLICY "Users can insert own client profile"
  ON client_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own client profile" ON client_profiles;
CREATE POLICY "Users can update own client profile"
  ON client_profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ── VERIFICATION: columns on creator_listings ────────────────
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS verification_steps  jsonb DEFAULT '{}';
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now();
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending_review';
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS youtube text;
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS vimeo text;
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS linkedin text;


-- ── CREATOR TIER SYSTEM ──────────────────────────────────────────
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS tier text DEFAULT 'launch';
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS completion_rate numeric(5,2) DEFAULT 100;
ALTER TABLE creator_listings ADD COLUMN IF NOT EXISTS video_intro_url text;

-- ── CLIENT REPUTATION ────────────────────────────────────────────
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS total_projects_completed integer DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS cancellation_rate numeric(5,2) DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS fast_match_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS client_reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid REFERENCES auth.users(id) NOT NULL,
  creator_id text NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id),
  project_id text NOT NULL,
  rating     integer CHECK (rating >= 1 AND rating <= 5),
  comment    text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_reviews ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE client_reviews ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES auth.users(id);

ALTER TABLE client_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators can insert client reviews" ON client_reviews;
CREATE POLICY "Creators can insert client reviews"
  ON client_reviews FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_id = (select auth.uid()));

DROP POLICY IF EXISTS "Anyone can view client reviews" ON client_reviews;
CREATE POLICY "Anyone can view client reviews"
  ON client_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_client_reviews_client ON client_reviews(client_id);

-- ── REFERRALS ─────────────────────────────────────────────────
-- Section 4: Referral Program
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) NOT NULL,
  referred_user_id uuid REFERENCES auth.users(id),
  referral_code text NOT NULL,
  referrer_type text NOT NULL,              -- 'creator' | 'client'
  referred_user_type text,                   -- 'creator' | 'client'
  status text DEFAULT 'pending',             -- 'pending' | 'signed_up' | 'completed'
  reward_type text,                          -- 'fee_reduction' | 'booking_fee_waived' | 'tier_boost'
  reward_issued boolean DEFAULT false,
  reward_issued_at timestamptz,
  completed_project_id text,
  completed_transaction_id uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_project_id text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_transaction_id uuid;

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_id = (select auth.uid()) OR referred_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own referrals" ON referrals;
CREATE POLICY "Users can create own referrals"
  ON referrals FOR INSERT
  TO authenticated
  WITH CHECK (referrer_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- ── NETWORKING ────────────────────────────────────────────────
-- Networking posts
CREATE TABLE IF NOT EXISTS network_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  state_code text NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 500),
  post_type text NOT NULL DEFAULT 'general',
  likes_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  is_flagged boolean DEFAULT false,
  strike_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 days'
);

-- Post likes
CREATE TABLE IF NOT EXISTS network_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES network_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Post replies
CREATE TABLE IF NOT EXISTS network_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES network_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 280),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 days'
);

-- State chat messages (real-time)
CREATE TABLE IF NOT EXISTS state_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  state_code text NOT NULL,
  message text NOT NULL CHECK (char_length(message) <= 300),
  user_display_name text,
  user_verification_status text,
  user_primary_service text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 days'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_network_posts_state
  ON network_posts(state_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_posts_expires
  ON network_posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_state_chat_state
  ON state_chat_messages(state_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_state_chat_expires
  ON state_chat_messages(expires_at);

-- RLS policies
ALTER TABLE network_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view network posts" ON network_posts;
CREATE POLICY "Anyone can view network posts"
  ON network_posts FOR SELECT
  TO anon, authenticated
  USING (
    expires_at > now() AND is_flagged = false
  );

DROP POLICY IF EXISTS "Verified members can post" ON network_posts;
CREATE POLICY "Verified members can post"
  ON network_posts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can view chat messages" ON state_chat_messages;
CREATE POLICY "Anyone can view chat messages"
  ON state_chat_messages FOR SELECT
  TO anon, authenticated
  USING (
    expires_at > now()
  );

DROP POLICY IF EXISTS "Verified members can send messages" ON state_chat_messages;
CREATE POLICY "Verified members can send messages"
  ON state_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can view replies" ON network_replies;
CREATE POLICY "Anyone can view replies"
  ON network_replies FOR SELECT
  TO anon, authenticated
  USING (
    expires_at > now()
  );

DROP POLICY IF EXISTS "Verified members can reply" ON network_replies;
CREATE POLICY "Verified members can reply"
  ON network_replies FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can like posts" ON network_post_likes;
CREATE POLICY "Anyone can like posts"
  ON network_post_likes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can view post likes" ON network_post_likes;
CREATE POLICY "Anyone can view post likes"
  ON network_post_likes FOR SELECT
  TO anon, authenticated
  USING (true);
