-- Reduced, audited identity review. Biometric evidence stays with Stripe.

create or replace function public.get_admin_identity_review_queue()
returns table (
  verification_id uuid,
  target_user_id uuid,
  member_name text,
  member_role text,
  status text,
  purpose text,
  provider_session_id text,
  phone_verified boolean,
  adult_verified boolean,
  document_status text,
  selfie_status text,
  risk_label text,
  review_reason text,
  attempt_count integer,
  linked_original_user_id uuid,
  has_creator_listing boolean,
  creator_approved boolean,
  project_count bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  with latest as (
    select distinct on (verification.user_id)
      verification.*
    from public.identity_verifications verification
    order by verification.user_id, verification.created_at desc, verification.id desc
  )
  select
    verification.id,
    verification.user_id,
    profile.full_name,
    profile.role,
    verification.status,
    verification.purpose,
    verification.provider_session_id,
    creatorbridge_private.user_phone_verified(verification.user_id),
    verification.adult_verified,
    verification.document_status,
    verification.selfie_status,
    verification.risk_label,
    verification.review_reason,
    verification.attempt_count,
    verification.duplicate_of_user_id,
    exists (
      select 1 from public.creator_listings listing
      where listing.user_id = verification.user_id
    ),
    exists (
      select 1 from public.creator_listings listing
      where listing.user_id = verification.user_id
        and listing.review_status = 'approved'
        and listing.verified is true
    ),
    (
      select count(distinct project.id)
      from public.projects project
      left join public.creator_listings listing
        on listing.id::text = project.accepted_creator_id::text
      where project.client_id = verification.user_id
        or listing.user_id = verification.user_id
    ),
    verification.updated_at
  from latest verification
  left join public.profiles profile on profile.id = verification.user_id
  where verification.status in (
    'retry_required',
    'manual_review',
    'duplicate_restricted',
    'rejected',
    'reverification_required'
  )
  order by verification.updated_at asc
  limit 200;
end;
$$;

revoke all on function public.get_admin_identity_review_queue()
  from public, anon, authenticated;
grant execute on function public.get_admin_identity_review_queue()
  to authenticated, service_role;

create or replace function public.admin_resolve_identity_review(
  p_verification_id uuid,
  p_action text,
  p_reason text,
  p_original_user_id uuid default null
)
returns public.identity_verifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_verification public.identity_verifications%rowtype;
  v_previous_status text;
  v_resulting_status text;
  v_target_created_at timestamptz;
  v_original_created_at timestamptz;
begin
  if not public.is_platform_admin(v_admin_id) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Identity review reason is required' using errcode = '22023';
  end if;
  if p_action not in (
    'request_secure_retry',
    'clear_false_positive',
    'confirm_duplicate',
    'reject_verification',
    'require_reverification',
    'restore_original_account'
  ) then
    raise exception 'Unsupported identity review action' using errcode = '22023';
  end if;

  select *
  into v_verification
  from public.identity_verifications verification
  where verification.id = p_verification_id
  for update;

  if not found then
    raise exception 'Identity verification not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.identity_verifications newer
    where newer.user_id = v_verification.user_id
      and (newer.created_at, newer.id) > (v_verification.created_at, v_verification.id)
  ) then
    raise exception 'Review the member''s latest identity attempt' using errcode = '40001';
  end if;

  v_previous_status := v_verification.status;

  if p_action = 'request_secure_retry' then
    if v_previous_status not in ('manual_review', 'rejected', 'retry_required') then
      raise exception 'A secure retry is not allowed from this state' using errcode = '22023';
    end if;
    v_resulting_status := 'retry_required';
    update public.identity_verifications
    set status = v_resulting_status,
        review_reason = left(trim(p_reason), 2000),
        duplicate_of_user_id = null,
        restricted_at = null,
        updated_at = now()
    where id = p_verification_id
    returning * into v_verification;

  elsif p_action = 'clear_false_positive' then
    if v_previous_status <> 'manual_review'
      or v_verification.adult_verified is not true
      or v_verification.document_status <> 'verified'
      or v_verification.selfie_status <> 'verified' then
      raise exception 'False-positive clearance requires completed provider checks in manual review'
        using errcode = '22023';
    end if;
    v_resulting_status := 'verified';
    update public.identity_verifications
    set status = v_resulting_status,
        risk_label = 'clear',
        review_reason = left(trim(p_reason), 2000),
        duplicate_of_user_id = null,
        restricted_at = null,
        verified_at = coalesce(verified_at, now()),
        updated_at = now()
    where id = p_verification_id
    returning * into v_verification;

  elsif p_action = 'confirm_duplicate' then
    if v_previous_status not in ('manual_review', 'rejected')
      or p_original_user_id is null
      or p_original_user_id = v_verification.user_id then
      raise exception 'Choose the verified original account before confirming a duplicate'
        using errcode = '22023';
    end if;
    if not creatorbridge_private.user_identity_verified(p_original_user_id) then
      raise exception 'The original account must have a verified identity'
        using errcode = '22023';
    end if;

    select created_at into v_target_created_at
    from auth.users where id = v_verification.user_id;
    select created_at into v_original_created_at
    from auth.users where id = p_original_user_id;
    if v_target_created_at is null
      or v_original_created_at is null
      or v_target_created_at < v_original_created_at then
      raise exception 'The newer account must be restricted; do not replace the original account'
        using errcode = '22023';
    end if;

    v_resulting_status := 'duplicate_restricted';
    update public.identity_verifications
    set status = v_resulting_status,
        risk_label = 'possible_duplicate',
        review_reason = left(trim(p_reason), 2000),
        duplicate_of_user_id = p_original_user_id,
        restricted_at = now(),
        verified_at = null,
        updated_at = now()
    where id = p_verification_id
    returning * into v_verification;

    update public.creator_listings
    set review_status = 'rejected',
        verified = false,
        verification_status = 'pending',
        review_notes = 'Duplicate account restricted. Contact support to recover the original account.',
        updated_at = now()
    where user_id = v_verification.user_id;

  elsif p_action = 'reject_verification' then
    if v_previous_status not in ('manual_review', 'retry_required') then
      raise exception 'Rejection is not allowed from this state' using errcode = '22023';
    end if;
    v_resulting_status := 'rejected';
    update public.identity_verifications
    set status = v_resulting_status,
        review_reason = left(trim(p_reason), 2000),
        verified_at = null,
        updated_at = now()
    where id = p_verification_id
    returning * into v_verification;

  elsif p_action = 'require_reverification' then
    if v_previous_status <> 'verified' then
      raise exception 'Reverification can only be required for a verified identity'
        using errcode = '22023';
    end if;
    v_resulting_status := 'reverification_required';
    update public.identity_verifications
    set status = v_resulting_status,
        reverification_reason = left(trim(p_reason), 2000),
        review_reason = left(trim(p_reason), 2000),
        verified_at = null,
        updated_at = now()
    where id = p_verification_id
    returning * into v_verification;

  else
    if v_previous_status not in ('reverification_required', 'rejected')
      or v_verification.adult_verified is not true
      or v_verification.document_status <> 'verified'
      or v_verification.selfie_status <> 'verified'
      or exists (
        select 1
        from public.identity_verifications duplicate
        where duplicate.duplicate_of_user_id = v_verification.user_id
          and duplicate.status <> 'duplicate_restricted'
      ) then
      raise exception 'The original account cannot be restored from this state'
        using errcode = '22023';
    end if;
    v_resulting_status := 'verified';
    update public.identity_verifications
    set status = v_resulting_status,
        risk_label = 'clear',
        review_reason = left(trim(p_reason), 2000),
        duplicate_of_user_id = null,
        restricted_at = null,
        verified_at = now(),
        updated_at = now()
    where id = p_verification_id
    returning * into v_verification;
  end if;

  insert into public.identity_review_actions (
    verification_id,
    target_user_id,
    reviewer_user_id,
    action,
    reason,
    linked_original_user_id,
    previous_status,
    resulting_status
  )
  values (
    p_verification_id,
    v_verification.user_id,
    v_admin_id,
    p_action,
    left(trim(p_reason), 2000),
    case when p_action = 'confirm_duplicate' then p_original_user_id else null end,
    v_previous_status,
    v_resulting_status
  );

  return v_verification;
end;
$$;

revoke all on function public.admin_resolve_identity_review(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_resolve_identity_review(uuid, text, text, uuid)
  to authenticated, service_role;
