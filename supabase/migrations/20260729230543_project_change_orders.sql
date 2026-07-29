-- Immutable, separately signed and funded changes to an original agreement.
-- Production migration history aligned with the managed Supabase rollout.

create table if not exists public.contract_change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.creator_listings(id) on delete restrict,
  sequence_number integer not null check (sequence_number > 0),
  document_number text not null unique check (length(trim(document_number)) between 6 and 100),
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  source_summary_id uuid references public.call_summaries(id) on delete set null,
  reason text not null check (length(trim(reason)) between 3 and 2000),
  terms jsonb not null,
  price_delta_cents integer not null default 0 check (price_delta_cents >= 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  pdf_ref text,
  status text not null default 'draft' check (status in (
    'draft', 'proposed', 'client_signed', 'creator_signed', 'countersigned',
    'awaiting_additional_retainer', 'active', 'declined', 'void', 'superseded'
  )),
  decline_reason text,
  void_reason text,
  superseded_by uuid references public.contract_change_orders(id) on delete restrict,
  proposed_at timestamptz,
  countersigned_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, sequence_number)
);

create table if not exists public.change_order_signatures (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null references public.contract_change_orders(id) on delete restrict,
  signer_user_id uuid not null references public.profiles(id) on delete restrict,
  signer_role text not null check (signer_role in ('client', 'creator')),
  signer_name text not null check (length(trim(signer_name)) between 2 and 160),
  method text not null check (method in ('drawn', 'typed', 'saved')),
  signature_image_ref text not null,
  consent_text text not null,
  signed_content_hash text not null check (signed_content_hash ~ '^[0-9a-f]{64}$'),
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (change_order_id, signer_role)
);

create table if not exists public.change_order_payments (
  id uuid primary key default gen_random_uuid(),
  change_order_id uuid not null unique references public.contract_change_orders(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.creator_listings(id) on delete restrict,
  added_amount_cents integer not null check (added_amount_cents > 0),
  retainer_amount_cents integer not null check (retainer_amount_cents > 0),
  final_amount_cents integer not null check (final_amount_cents >= 0),
  creator_fee_pct numeric not null check (creator_fee_pct between 0 and 100),
  client_fee_pct numeric not null check (client_fee_pct between 0 and 100),
  retainer_payment_intent text unique,
  final_payment_intent text unique,
  retainer_stripe_event_id text unique,
  final_stripe_event_id text unique,
  retainer_status text not null default 'pending' check (retainer_status in ('pending','processing','paid','failed','released')),
  final_status text not null default 'pending' check (final_status in ('pending','processing','paid','failed','released')),
  retainer_transfer_id text unique,
  final_transfer_id text unique,
  retainer_paid_at timestamptz,
  final_paid_at timestamptz,
  retainer_released_at timestamptz,
  final_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retainer_amount_cents + final_amount_cents = added_amount_cents)
);

create index if not exists change_orders_project_idx on public.contract_change_orders(project_id, sequence_number);
create index if not exists change_orders_pending_signature_idx on public.contract_change_orders(status) where status in ('proposed','client_signed','creator_signed');
create index if not exists change_orders_pending_retainer_idx on public.contract_change_orders(status) where status = 'awaiting_additional_retainer';
create index if not exists change_order_payments_final_idx on public.change_order_payments(final_status) where final_status not in ('paid','released');
create index if not exists change_order_payments_retainer_intent_idx on public.change_order_payments(retainer_payment_intent) where retainer_payment_intent is not null;
create index if not exists change_order_payments_final_intent_idx on public.change_order_payments(final_payment_intent) where final_payment_intent is not null;

alter table public.contract_change_orders enable row level security;
alter table public.change_order_signatures enable row level security;
alter table public.change_order_payments enable row level security;
revoke all on public.contract_change_orders, public.change_order_signatures, public.change_order_payments from public, anon, authenticated;
grant select on public.contract_change_orders, public.change_order_signatures, public.change_order_payments to authenticated;
grant all on public.contract_change_orders, public.change_order_signatures, public.change_order_payments to service_role;

create policy change_orders_party_read on public.contract_change_orders for select to authenticated
using ((select auth.uid()) in (client_id, creator_user_id) or public.is_platform_admin((select auth.uid())));
create policy change_order_signatures_party_read on public.change_order_signatures for select to authenticated
using (exists (
  select 1 from public.contract_change_orders change_order
  where change_order.id = change_order_signatures.change_order_id
    and ((select auth.uid()) in (change_order.client_id, change_order.creator_user_id)
      or public.is_platform_admin((select auth.uid())))
));
create policy change_order_payments_party_read on public.change_order_payments for select to authenticated
using ((select auth.uid()) in (client_id, creator_user_id) or public.is_platform_admin((select auth.uid())));

create or replace function creatorbridge_private.protect_change_order_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Proposed change orders cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.status <> 'draft' and (
    new.project_id is distinct from old.project_id
    or new.contract_id is distinct from old.contract_id
    or new.client_id is distinct from old.client_id
    or new.creator_user_id is distinct from old.creator_user_id
    or new.creator_id is distinct from old.creator_id
    or new.sequence_number is distinct from old.sequence_number
    or new.document_number is distinct from old.document_number
    or new.terms is distinct from old.terms
    or new.price_delta_cents is distinct from old.price_delta_cents
    or new.content_hash is distinct from old.content_hash
  ) then raise exception 'Proposed change order evidence is immutable' using errcode = '55000'; end if;
  return new;
end $$;

create or replace function creatorbridge_private.protect_change_order_signature()
returns trigger language plpgsql security definer set search_path = '' as $$
begin raise exception 'Change order signatures are append-only evidence' using errcode = '55000'; end $$;

create or replace function creatorbridge_private.protect_change_order_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.retainer_status in ('paid','released') or old.final_status in ('paid','released') then
      raise exception 'Successful change-order payment evidence cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.retainer_status in ('paid','released') and (
    new.added_amount_cents is distinct from old.added_amount_cents
    or new.retainer_amount_cents is distinct from old.retainer_amount_cents
    or new.retainer_payment_intent is distinct from old.retainer_payment_intent
  ) then raise exception 'Successful added-retainer evidence is immutable' using errcode = '55000'; end if;
  if old.final_status in ('paid','released') and (
    new.added_amount_cents is distinct from old.added_amount_cents
    or new.final_amount_cents is distinct from old.final_amount_cents
    or new.final_payment_intent is distinct from old.final_payment_intent
  ) then raise exception 'Successful added-final evidence is immutable' using errcode = '55000'; end if;
  return new;
end $$;

create trigger protect_change_order_evidence before update or delete on public.contract_change_orders
for each row execute function creatorbridge_private.protect_change_order_evidence();
create trigger protect_change_order_signature before update or delete on public.change_order_signatures
for each row execute function creatorbridge_private.protect_change_order_signature();
create trigger protect_change_order_payment before update or delete on public.change_order_payments
for each row execute function creatorbridge_private.protect_change_order_payment();

revoke all on function creatorbridge_private.protect_change_order_evidence() from public, anon, authenticated;
revoke all on function creatorbridge_private.protect_change_order_signature() from public, anon, authenticated;
revoke all on function creatorbridge_private.protect_change_order_payment() from public, anon, authenticated;

create or replace function public.get_project_change_orders(p_project_id uuid)
returns setof public.contract_change_orders
language plpgsql stable security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.contracts contract
    where contract.project_id = p_project_id
      and (
        v_user_id in (contract.client_id, contract.creator_user_id)
        or public.is_platform_admin(v_user_id)
      )
  ) then raise exception 'Project document access denied' using errcode = '42501'; end if;
  return query select * from public.contract_change_orders where project_id = p_project_id order by sequence_number;
end $$;
revoke all on function public.get_project_change_orders(uuid) from public, anon;
grant execute on function public.get_project_change_orders(uuid) to authenticated, service_role;

create or replace function public.get_project_documents(p_project_id uuid)
returns table (document_type text, document_id uuid, document_number text, document_status text, file_ref text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_trust record;
begin
  select * into v_trust from public.require_verified_project_parties(p_project_id);
  return query
    select 'original_agreement'::text, contract.id, contract.terms #>> '{document,number}', contract.status, contract.pdf_ref, contract.created_at
    from public.contracts contract where contract.project_id = p_project_id
    union all
    select 'change_order'::text, change_order.id, change_order.document_number, change_order.status, change_order.pdf_ref, change_order.created_at
    from public.contract_change_orders change_order where change_order.project_id = p_project_id
    union all
    select 'agreed_call_summary'::text, summary.id, 'Call summary', summary.status, null::text, summary.created_at
    from public.call_summaries summary where summary.project_id = p_project_id and summary.status = 'agreed'
    union all
    select 'original_retainer_receipt'::text, transaction.id, 'Original agreement retainer',
      transaction.retainer_status, null::text, coalesce(transaction.retainer_paid_at, transaction.created_at)
    from public.transactions transaction
    where transaction.project_id = p_project_id::text
    union all
    select 'original_final_receipt'::text, transaction.id, 'Original agreement final payment',
      transaction.final_status, null::text, coalesce(transaction.final_paid_at, transaction.created_at)
    from public.transactions transaction
    where transaction.project_id = p_project_id::text
    union all
    select 'change_order_retainer_receipt'::text, payment.id,
      change_order.document_number || ' added retainer', payment.retainer_status, null::text,
      coalesce(payment.retainer_paid_at, payment.created_at)
    from public.change_order_payments payment
    join public.contract_change_orders change_order on change_order.id = payment.change_order_id
    where payment.project_id = p_project_id
    union all
    select 'change_order_final_receipt'::text, payment.id,
      change_order.document_number || ' added final payment', payment.final_status, null::text,
      coalesce(payment.final_paid_at, payment.created_at)
    from public.change_order_payments payment
    join public.contract_change_orders change_order on change_order.id = payment.change_order_id
    where payment.project_id = p_project_id
    order by created_at;
end $$;
revoke all on function public.get_project_documents(uuid) from public, anon;
grant execute on function public.get_project_documents(uuid) to authenticated, service_role;
