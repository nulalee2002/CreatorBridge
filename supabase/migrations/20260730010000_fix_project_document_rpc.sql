-- Keep the Project Board readable for an authorized project party before a
-- contract exists, and align the legacy transactions join with its UUID schema.

create or replace function public.get_project_change_orders(p_project_id uuid)
returns setof public.contract_change_orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.projects project
    left join public.creator_listings listing
      on listing.id::text = project.accepted_creator_id::text
    where project.id = p_project_id
      and (
        project.client_id = v_user_id
        or listing.user_id = v_user_id
        or public.is_platform_admin(v_user_id)
      )
  ) then
    raise exception 'Project document access denied' using errcode = '42501';
  end if;

  return query
    select *
    from public.contract_change_orders change_order
    where change_order.project_id = p_project_id
    order by change_order.sequence_number;
end;
$$;

revoke all on function public.get_project_change_orders(uuid) from public, anon;
grant execute on function public.get_project_change_orders(uuid) to authenticated, service_role;

create or replace function public.get_project_documents(p_project_id uuid)
returns table (
  document_type text,
  document_id uuid,
  document_number text,
  document_status text,
  file_ref text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.projects project
    left join public.creator_listings listing
      on listing.id::text = project.accepted_creator_id::text
    where project.id = p_project_id
      and (
        project.client_id = v_user_id
        or listing.user_id = v_user_id
        or public.is_platform_admin(v_user_id)
      )
  ) then
    raise exception 'Project document access denied' using errcode = '42501';
  end if;

  return query
    select
      'original_agreement'::text,
      contract.id,
      contract.terms #>> '{document,number}',
      contract.status,
      contract.pdf_ref,
      contract.created_at
    from public.contracts contract
    where contract.project_id = p_project_id

    union all

    select
      'change_order'::text,
      change_order.id,
      change_order.document_number,
      change_order.status,
      change_order.pdf_ref,
      change_order.created_at
    from public.contract_change_orders change_order
    where change_order.project_id = p_project_id

    union all

    select
      'agreed_call_summary'::text,
      summary.id,
      'Call summary',
      summary.status,
      null::text,
      summary.created_at
    from public.call_summaries summary
    where summary.project_id = p_project_id
      and summary.status = 'agreed'

    union all

    select
      'original_retainer_receipt'::text,
      transaction.id,
      'Original agreement retainer',
      transaction.retainer_status,
      null::text,
      coalesce(transaction.retainer_paid_at, transaction.created_at)
    from public.transactions transaction
    where transaction.project_id = p_project_id

    union all

    select
      'original_final_receipt'::text,
      transaction.id,
      'Original agreement final payment',
      transaction.final_status,
      null::text,
      coalesce(transaction.final_paid_at, transaction.created_at)
    from public.transactions transaction
    where transaction.project_id = p_project_id

    union all

    select
      'change_order_retainer_receipt'::text,
      payment.id,
      change_order.document_number || ' added retainer',
      payment.retainer_status,
      null::text,
      coalesce(payment.retainer_paid_at, payment.created_at)
    from public.change_order_payments payment
    join public.contract_change_orders change_order
      on change_order.id = payment.change_order_id
    where payment.project_id = p_project_id

    union all

    select
      'change_order_final_receipt'::text,
      payment.id,
      change_order.document_number || ' added final payment',
      payment.final_status,
      null::text,
      coalesce(payment.final_paid_at, payment.created_at)
    from public.change_order_payments payment
    join public.contract_change_orders change_order
      on change_order.id = payment.change_order_id
    where payment.project_id = p_project_id

    order by created_at;
end;
$$;

revoke all on function public.get_project_documents(uuid) from public, anon;
grant execute on function public.get_project_documents(uuid) to authenticated, service_role;
