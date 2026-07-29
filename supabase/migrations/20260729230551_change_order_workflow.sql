-- Authorized, hash-bound change-order lifecycle transitions.
-- Production migration history aligned with the managed Supabase rollout.

create or replace function public.create_change_order_draft(
  p_project_id uuid,
  p_source_summary_id uuid,
  p_reason text,
  p_changes jsonb,
  p_price_delta_cents integer
)
returns public.contract_change_orders
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_contract public.contracts%rowtype;
  v_trust record;
  v_sequence integer;
  v_document_number text;
  v_terms jsonb;
  v_change_order public.contract_change_orders%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_contract from public.contracts
  where project_id = p_project_id and status = 'countersigned'
  for update;
  if not found then raise exception 'A countersigned original agreement is required' using errcode = 'P0002'; end if;
  if v_user_id not in (v_contract.client_id, v_contract.creator_user_id) then
    raise exception 'Only project parties can create a change order' using errcode = '42501';
  end if;
  select * into v_trust from public.require_verified_project_parties(p_project_id);
  if not coalesce(v_trust.both_verified, false) then
    raise exception 'Both project parties must complete identity verification' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'A specific change reason is required' using errcode = '22023';
  end if;
  if p_price_delta_cents is null or p_price_delta_cents < 0 then
    raise exception 'Price reductions, refunds, and credits are handled by CreatorBridge support' using errcode = '22023';
  end if;
  if jsonb_typeof(p_changes) <> 'object'
    or jsonb_typeof(p_changes -> 'before') <> 'object'
    or jsonb_typeof(p_changes -> 'after') <> 'object'
    or p_changes -> 'before' = '{}'::jsonb
    or p_changes -> 'after' = '{}'::jsonb
    or exists (
      select 1 from jsonb_object_keys(p_changes) key
      where key not in ('before', 'after', 'responsibilities')
    )
    or length(p_changes::text) > 20000 then
    raise exception 'Change details must include valid before and after terms' using errcode = '22023';
  end if;
  if p_source_summary_id is not null and not exists (
    select 1 from public.call_summaries summary
    where summary.id = p_source_summary_id
      and summary.project_id = p_project_id
      and summary.status = 'agreed'
  ) then raise exception 'Only an agreed call summary can be referenced' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_contract.id::text, 0));
  select coalesce(max(sequence_number), 0) + 1 into v_sequence
  from public.contract_change_orders where contract_id = v_contract.id;
  v_document_number := coalesce(v_contract.terms #>> '{document,number}', 'CB-' || left(v_contract.id::text, 8))
    || '-CO-' || lpad(v_sequence::text, 2, '0');
  v_terms := jsonb_build_object(
    'document', jsonb_build_object(
      'number', v_document_number,
      'version', 'change-order-v1',
      'sequence', v_sequence,
      'generated_at', now()
    ),
    'original_agreement', jsonb_build_object(
      'contract_id', v_contract.id,
      'document_number', v_contract.terms #>> '{document,number}'
    ),
    'project_id', p_project_id,
    'reason', trim(p_reason),
    'source_summary_id', p_source_summary_id,
    'changes', p_changes,
    'pricing', jsonb_build_object(
      'currency', 'USD',
      'price_delta_cents', p_price_delta_cents,
      'added_retainer_cents', ((p_price_delta_cents + 1) / 2),
      'added_final_cents', (p_price_delta_cents / 2)
    ),
    'unchanged_terms', 'Every term in the original agreement remains in effect unless this signed change order explicitly replaces it.'
  );

  insert into public.contract_change_orders (
    project_id, contract_id, client_id, creator_user_id, creator_id,
    sequence_number, document_number, initiated_by, source_summary_id,
    reason, terms, price_delta_cents, content_hash
  ) values (
    p_project_id, v_contract.id, v_contract.client_id, v_contract.creator_user_id, v_contract.creator_id,
    v_sequence, v_document_number, v_user_id, p_source_summary_id,
    trim(p_reason), v_terms, p_price_delta_cents,
    encode(extensions.digest(v_terms::text, 'sha256'), 'hex')
  ) returning * into v_change_order;
  return v_change_order;
end;
$$;

create or replace function public.propose_change_order(p_change_order_id uuid)
returns public.contract_change_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_order public.contract_change_orders%rowtype;
begin
  select * into v_order from public.contract_change_orders where id = p_change_order_id for update;
  if not found then raise exception 'Change order not found' using errcode = 'P0002'; end if;
  if v_user_id <> v_order.initiated_by then raise exception 'Only the draft owner can propose it' using errcode = '42501'; end if;
  if v_order.status <> 'draft' then raise exception 'Only a draft can be proposed' using errcode = '23514'; end if;
  if v_order.pdf_ref is null then raise exception 'Generate the change-order document before proposing it' using errcode = '23514'; end if;
  update public.contract_change_orders set status = 'proposed', proposed_at = now(), updated_at = now()
  where id = p_change_order_id returning * into v_order;
  perform public.create_platform_notification(
    case when v_user_id = v_order.client_id then v_order.creator_user_id else v_order.client_id end,
    'contract_ready', 'Change order ready for review',
    'Review the proposed project change. It does not affect the project until both signatures and any added retainer are complete.',
    '/projects', jsonb_build_object('project_id',v_order.project_id,'change_order_id',v_order.id), v_user_id, null
  );
  return v_order;
end $$;

create or replace function public.decline_change_order(p_change_order_id uuid, p_reason text)
returns public.contract_change_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_order public.contract_change_orders%rowtype;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Decline reason is required' using errcode = '22023'; end if;
  select * into v_order from public.contract_change_orders where id = p_change_order_id for update;
  if not found then raise exception 'Change order not found' using errcode = 'P0002'; end if;
  if v_user_id not in (v_order.client_id,v_order.creator_user_id) or v_user_id = v_order.initiated_by then
    raise exception 'Only the receiving project party can decline' using errcode = '42501'; end if;
  if v_order.status not in ('proposed','client_signed','creator_signed') then
    raise exception 'This change order can no longer be declined' using errcode = '23514'; end if;
  update public.contract_change_orders set status='declined', decline_reason=left(trim(p_reason),2000), updated_at=now()
  where id=p_change_order_id returning * into v_order;
  return v_order;
end $$;

create or replace function public.void_change_order(p_change_order_id uuid, p_reason text)
returns public.contract_change_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_order public.contract_change_orders%rowtype;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Void reason is required' using errcode = '22023'; end if;
  select * into v_order from public.contract_change_orders where id=p_change_order_id for update;
  if not found then raise exception 'Change order not found' using errcode = 'P0002'; end if;
  if v_user_id <> v_order.initiated_by then raise exception 'Only the initiator can void this change order' using errcode = '42501'; end if;
  if v_order.status in ('active','declined','void','superseded') then raise exception 'This change order cannot be voided' using errcode = '23514'; end if;
  update public.contract_change_orders set status='void', void_reason=left(trim(p_reason),2000), updated_at=now()
  where id=p_change_order_id returning * into v_order;
  return v_order;
end $$;

create or replace function public.supersede_change_order(p_change_order_id uuid, p_reason text)
returns public.contract_change_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_old public.contract_change_orders%rowtype; v_new public.contract_change_orders%rowtype;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Supersession reason is required' using errcode = '22023'; end if;
  select * into v_old from public.contract_change_orders where id=p_change_order_id for update;
  if not found then raise exception 'Change order not found' using errcode = 'P0002'; end if;
  if v_user_id <> v_old.initiated_by then raise exception 'Only the initiator can supersede this change order' using errcode = '42501'; end if;
  if v_old.status not in ('proposed','client_signed','creator_signed','declined') then
    raise exception 'This change order cannot be superseded' using errcode = '23514'; end if;
  select * into v_new from public.create_change_order_draft(
    v_old.project_id, v_old.source_summary_id,
    p_reason, v_old.terms -> 'changes', v_old.price_delta_cents
  );
  update public.contract_change_orders set status='superseded', superseded_by=v_new.id, updated_at=now()
  where id=v_old.id;
  return v_new;
end $$;

create or replace function public.refresh_change_order_signature_status(p_change_order_id uuid)
returns public.contract_change_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.contract_change_orders%rowtype; v_client boolean; v_creator boolean; v_next text;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then raise exception 'Service access required' using errcode = '42501'; end if;
  select * into v_order from public.contract_change_orders where id=p_change_order_id for update;
  if not found then raise exception 'Change order not found' using errcode = 'P0002'; end if;
  if v_order.status in ('declined','void','superseded','active') then return v_order; end if;
  select bool_or(signer_role='client'), bool_or(signer_role='creator') into v_client,v_creator
  from public.change_order_signatures where change_order_id=p_change_order_id;
  v_next := case
    when coalesce(v_client,false) and coalesce(v_creator,false) and v_order.price_delta_cents=0 then 'active'
    when coalesce(v_client,false) and coalesce(v_creator,false) then 'awaiting_additional_retainer'
    when coalesce(v_client,false) then 'client_signed'
    when coalesce(v_creator,false) then 'creator_signed'
    else 'proposed' end;
  update public.contract_change_orders set status=v_next,
    countersigned_at=case when coalesce(v_client,false) and coalesce(v_creator,false) then coalesce(countersigned_at,now()) else null end,
    activated_at=case when v_next='active' then coalesce(activated_at,now()) else activated_at end,
    updated_at=now()
  where id=p_change_order_id returning * into v_order;
  return v_order;
end $$;

revoke all on function public.create_change_order_draft(uuid,uuid,text,jsonb,integer) from public,anon;
revoke all on function public.propose_change_order(uuid) from public,anon;
revoke all on function public.decline_change_order(uuid,text) from public,anon;
revoke all on function public.void_change_order(uuid,text) from public,anon;
revoke all on function public.supersede_change_order(uuid,text) from public,anon;
revoke all on function public.refresh_change_order_signature_status(uuid) from public,anon,authenticated;
grant execute on function public.create_change_order_draft(uuid,uuid,text,jsonb,integer) to authenticated,service_role;
grant execute on function public.propose_change_order(uuid) to authenticated,service_role;
grant execute on function public.decline_change_order(uuid,text) to authenticated,service_role;
grant execute on function public.void_change_order(uuid,text) to authenticated,service_role;
grant execute on function public.supersede_change_order(uuid,text) to authenticated,service_role;
grant execute on function public.refresh_change_order_signature_status(uuid) to service_role;
