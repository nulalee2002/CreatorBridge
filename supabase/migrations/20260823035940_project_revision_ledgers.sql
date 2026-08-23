create table public.project_revision_purchases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  creator_listing_id uuid not null references public.creator_listings(id) on delete restrict,
  gross_amount_cents integer not null default 5000 check (gross_amount_cents = 5000),
  client_fee_cents integer not null default 0 check (client_fee_cents = 0),
  creator_fee_pct numeric(4,2) not null check (creator_fee_pct in (6, 8, 10)),
  creator_fee_cents integer not null check (creator_fee_cents >= 0),
  creator_net_cents integer not null check (creator_net_cents > 0),
  stripe_payment_intent_id text unique,
  stripe_event_id text unique,
  idempotency_key text not null,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
  entitlement_status text not null default 'pending'
    check (entitlement_status in ('pending', 'available', 'consumed', 'refunded')),
  failure_code text,
  paid_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, client_id, idempotency_key),
  check (creator_fee_cents + creator_net_cents = gross_amount_cents)
);

create table public.project_revision_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  delivery_id uuid not null,
  client_id uuid not null references auth.users(id) on delete restrict,
  source_type text not null check (source_type in ('included', 'paid')),
  included_ordinal integer check (included_ordinal between 1 and 2),
  purchase_id uuid unique references public.project_revision_purchases(id) on delete restrict,
  instructions text not null check (length(trim(instructions)) between 2 and 5000),
  idempotency_key text not null,
  status text not null default 'requested'
    check (status in ('requested', 'in_progress', 'resubmitted', 'resolved', 'canceled')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, client_id, idempotency_key),
  unique (project_id, included_ordinal),
  check (
    (source_type = 'included' and included_ordinal is not null and purchase_id is null)
    or (source_type = 'paid' and included_ordinal is null and purchase_id is not null)
  )
);

alter table public.project_revision_purchases
  add column consumed_request_id uuid unique references public.project_revision_requests(id) on delete restrict;

create index project_revision_purchases_available_idx
  on public.project_revision_purchases(project_id, paid_at, id)
  where entitlement_status = 'available';
create index project_revision_requests_project_idx
  on public.project_revision_requests(project_id, requested_at desc);

alter table public.project_revision_purchases enable row level security;
alter table public.project_revision_requests enable row level security;

revoke all on table public.project_revision_purchases from anon, authenticated;
revoke all on table public.project_revision_requests from anon, authenticated;
grant select on table public.project_revision_purchases to authenticated;
grant select on table public.project_revision_requests to authenticated;

create policy revision_purchases_project_party_select
on public.project_revision_purchases for select to authenticated
using (
  client_id = auth.uid()
  or exists (
    select 1
    from public.creator_listings listing
    where listing.id = creator_listing_id and listing.user_id = auth.uid()
  )
  or public.is_platform_admin(auth.uid())
);

create policy revision_requests_project_party_select
on public.project_revision_requests for select to authenticated
using (
  client_id = auth.uid()
  or exists (
    select 1
    from public.projects project
    join public.creator_listings listing
      on listing.id::text = project.accepted_creator_id::text
    where project.id = project_id and listing.user_id = auth.uid()
  )
  or public.is_platform_admin(auth.uid())
);

create or replace function public.get_project_revision_state(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_creator_user_id uuid;
  v_included_used integer;
  v_paid_available integer;
  v_paid_used integer;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  select user_id into v_creator_user_id
  from public.creator_listings
  where id::text = v_project.accepted_creator_id::text;

  if auth.uid() not in (v_project.client_id, v_creator_user_id)
    and not public.is_platform_admin(auth.uid()) then
    raise exception 'Project party access required' using errcode = '42501';
  end if;

  select count(*)::integer into v_included_used
  from public.project_revision_requests
  where project_id = p_project_id and source_type = 'included' and status <> 'canceled';

  select
    count(*) filter (where entitlement_status = 'available')::integer,
    count(*) filter (where entitlement_status = 'consumed')::integer
  into v_paid_available, v_paid_used
  from public.project_revision_purchases
  where project_id = p_project_id and payment_status = 'succeeded';

  return jsonb_build_object(
    'includedTotal', 2,
    'includedUsed', v_included_used,
    'includedRemaining', greatest(0, 2 - v_included_used),
    'paidAvailable', v_paid_available,
    'paidUsed', v_paid_used,
    'canRequest', v_included_used < 2 or v_paid_available > 0,
    'lockReason', case when v_included_used >= 2 and v_paid_available = 0 then 'PAID_REVISION_REQUIRED' else null end
  );
end;
$$;

create or replace function public.request_project_revision(
  p_project_id uuid,
  p_delivery_id uuid,
  p_instructions text,
  p_idempotency_key text
)
returns public.project_revision_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_existing public.project_revision_requests%rowtype;
  v_request public.project_revision_requests%rowtype;
  v_purchase public.project_revision_purchases%rowtype;
  v_included_used integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(trim(coalesce(p_instructions, ''))) not between 2 and 5000 then
    raise exception 'Revision instructions must be between 2 and 5000 characters' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) not between 8 and 200 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;

  select * into v_existing
  from public.project_revision_requests
  where project_id = p_project_id and client_id = auth.uid() and idempotency_key = p_idempotency_key;
  if found then return v_existing; end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;
  if v_project.client_id is distinct from auth.uid() then
    raise exception 'Only the project client can request a revision' using errcode = '42501';
  end if;

  perform 1
  from public.project_deliveries delivery
  where delivery.id = p_delivery_id
    and delivery.project_id = p_project_id
    and delivery.status = 'under_review'
  for update;
  if not found then raise exception 'The active delivery is not under review' using errcode = '55000'; end if;

  if exists (
    select 1 from public.disputes dispute
    join public.transactions transaction on transaction.id = dispute.transaction_id
    where transaction.project_id = p_project_id and dispute.status = 'open'
  ) then
    raise exception 'A revision cannot be requested during an active dispute' using errcode = '55000';
  end if;

  select count(*)::integer into v_included_used
  from public.project_revision_requests
  where project_id = p_project_id and source_type = 'included' and status <> 'canceled';

  if v_included_used < 2 then
    insert into public.project_revision_requests (
      project_id, delivery_id, client_id, source_type, included_ordinal, instructions, idempotency_key
    ) values (
      p_project_id, p_delivery_id, auth.uid(), 'included', v_included_used + 1, trim(p_instructions), trim(p_idempotency_key)
    ) returning * into v_request;
  else
    select * into v_purchase
    from public.project_revision_purchases
    where project_id = p_project_id
      and client_id = auth.uid()
      and payment_status = 'succeeded'
      and entitlement_status = 'available'
    order by paid_at, id
    for update skip locked
    limit 1;

    if not found then raise exception 'PAID_REVISION_REQUIRED' using errcode = 'P0001'; end if;

    insert into public.project_revision_requests (
      project_id, delivery_id, client_id, source_type, purchase_id, instructions, idempotency_key
    ) values (
      p_project_id, p_delivery_id, auth.uid(), 'paid', v_purchase.id, trim(p_instructions), trim(p_idempotency_key)
    ) returning * into v_request;

    update public.project_revision_purchases
    set entitlement_status = 'consumed', consumed_request_id = v_request.id,
        consumed_at = now(), updated_at = now()
    where id = v_purchase.id and entitlement_status = 'available';
  end if;

  update public.project_deliveries
  set status = 'revision_requested', review_paused_at = now(), updated_at = now()
  where id = p_delivery_id and status = 'under_review';

  update public.projects
  set status = 'revision', revision_count = coalesce(revision_count, 0) + 1
  where id = p_project_id;

  return v_request;
end;
$$;

revoke all on function public.get_project_revision_state(uuid) from public, anon;
revoke all on function public.request_project_revision(uuid, uuid, text, text) from public, anon;
grant execute on function public.get_project_revision_state(uuid) to authenticated, service_role;
grant execute on function public.request_project_revision(uuid, uuid, text, text) to authenticated;
