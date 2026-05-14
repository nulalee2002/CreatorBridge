-- Harden CreatorBridge payment records for the protected platform-charge-then-transfer flow.
-- Initial client charges stay on the platform Stripe account. Creator payout is released
-- from server-side code only after both retainer and final payment are confirmed paid.

alter table public.transactions
  add column if not exists payment_flow text not null default 'platform_charge_then_transfer';

comment on column public.transactions.payment_flow is
  'Payment architecture marker. platform_charge_then_transfer means client charges are collected by CreatorBridge and creator payout is released by verified server-side transfer.';

create unique index if not exists idx_transactions_unique_booking
  on public.transactions (project_id, creator_id, client_id);

create unique index if not exists idx_transactions_retainer_payment_intent
  on public.transactions (retainer_payment_intent)
  where retainer_payment_intent is not null;

create unique index if not exists idx_transactions_final_payment_intent
  on public.transactions (final_payment_intent)
  where final_payment_intent is not null;

create unique index if not exists idx_transactions_final_transfer_id
  on public.transactions (final_transfer_id)
  where final_transfer_id is not null;

alter table public.payment_events
  add column if not exists stripe_event_id text;

comment on column public.payment_events.stripe_event_id is
  'Stripe webhook event id when this event originated from Stripe. Used for replay-safe processing.';

create unique index if not exists idx_payment_events_stripe_event_id
  on public.payment_events (stripe_event_id)
  where stripe_event_id is not null;
