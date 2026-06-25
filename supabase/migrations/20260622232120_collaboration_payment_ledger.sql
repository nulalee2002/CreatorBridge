-- Internal collaboration payments do not advance public loyalty or reputation tiers.
create table if not exists public.collaboration_payments (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.creator_collaborations(id) on delete cascade,
  prime_user_id uuid not null references auth.users(id) on delete restrict,
  collaborator_user_id uuid not null references auth.users(id) on delete restrict,
  base_amount_cents integer not null check (base_amount_cents >= 25000),
  ach_processing_cost_cents integer not null check (ach_processing_cost_cents >= 0),
  buyer_platform_fee_cents integer not null default 0 check (buyer_platform_fee_cents = 0),
  creator_fee_pct numeric(4,2) not null check (creator_fee_pct in (6,8,10)),
  platform_fee_cents integer not null check (platform_fee_cents >= 500),
  collaborator_net_cents integer not null check (collaborator_net_cents > 0),
  prime_charge_cents integer not null,
  stripe_payment_intent_id text unique,
  stripe_event_id text unique,
  idempotency_key text not null unique,
  status text not null default 'processing' check (status in ('processing','succeeded','failed','returned','refunded','cancelled')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collaboration_payments enable row level security;
grant select on public.collaboration_payments to authenticated;
grant all on public.collaboration_payments to service_role;
revoke insert, update, delete on public.collaboration_payments from anon, authenticated;
create policy "Collaboration payment members can read" on public.collaboration_payments for select to authenticated
using ((select auth.uid()) in (prime_user_id, collaborator_user_id) or public.is_platform_admin((select auth.uid())));
