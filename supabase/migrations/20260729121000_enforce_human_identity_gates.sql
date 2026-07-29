-- Enforce CreatorBridge trust requirements at the database boundary.
-- Browser state and public profile fields are never authorization sources.

create or replace function public.user_identity_verified(
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requester uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and v_requester is distinct from p_user_id
    and not public.is_platform_admin(v_requester) then
    raise exception 'Identity status access denied' using errcode = '42501';
  end if;

  return creatorbridge_private.user_identity_verified(p_user_id);
end;
$$;

revoke all on function public.user_identity_verified(uuid) from public, anon;
grant execute on function public.user_identity_verified(uuid) to authenticated, service_role;

create or replace function public.creator_listing_meets_approval_requirements(
  p_listing_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_listings cl
    where cl.id = p_listing_id
      and cl.user_id is not null
      and creatorbridge_private.user_phone_verified(cl.user_id)
      and creatorbridge_private.user_identity_verified(cl.user_id)
      and length(trim(coalesce(cl.name, ''))) >= 2
      and length(trim(coalesce(cl.bio, ''))) >= 100
      and (
        cl.avatar like 'storage://%'
        or cl.avatar like '/%'
        or cl.avatar like 'https://%'
        or cl.avatar like 'http://%'
      )
      and cl.video_intro_url like 'bunny:%'
      and coalesce(cl.years_experience, 0) >= 2
      and upper(coalesce(cl.country, '')) = 'US'
      and cl.primary_pillar in ('video_production', 'photography', 'post_production')
      and coalesce(array_length(cl.sub_niches, 1), 0) between 1 and 3
      and not exists (
        select 1
        from unnest(coalesce(cl.sub_niches, '{}'::text[])) as sub_niche
        where not (
          (cl.primary_pillar = 'video_production' and left(sub_niche, 3) = 'vp_')
          or (cl.primary_pillar = 'photography' and left(sub_niche, 3) = 'ph_')
          or (cl.primary_pillar = 'post_production' and left(sub_niche, 3) = 'pp_')
        )
      )
      and length(trim(coalesce(cl.stripe_account_id, ''))) > 0
      and coalesce(cl.stripe_onboarded, false)
      and coalesce(cl.payouts_enabled, false)
      and (
        select count(*)
        from public.portfolio_items pi
        where pi.listing_id = cl.id
          and length(trim(coalesce(pi.title, ''))) > 0
          and length(trim(coalesce(pi.description, ''))) > 0
          and length(trim(coalesce(pi.service_id, ''))) > 0
          and pi.service_id = any(cl.sub_niches)
          and (
            (
              (
                cl.primary_pillar = 'photography'
                or left(coalesce(pi.service_id, ''), 3) = 'ph_'
                or pi.service_id = 'pp_photo_retouch'
              )
              and pi.media_type = 'image'
              and length(trim(coalesce(pi.image_url, ''))) > 0
            )
            or
            (
              not (
                cl.primary_pillar = 'photography'
                or left(coalesce(pi.service_id, ''), 3) = 'ph_'
                or pi.service_id = 'pp_photo_retouch'
              )
              and pi.media_type = 'video'
              and length(trim(coalesce(pi.bunny_video_id, ''))) > 0
            )
          )
      ) >= 3
      and exists (
        select 1
        from public.packages pkg
        where pkg.listing_id = cl.id
          and length(trim(coalesce(pkg.name, ''))) > 0
          and coalesce(pkg.price, 0) > 0
      )
  );
$$;

revoke all on function public.creator_listing_meets_approval_requirements(uuid)
  from public, anon, authenticated;
grant execute on function public.creator_listing_meets_approval_requirements(uuid)
  to anon, authenticated, service_role;

create or replace function creatorbridge_private.enforce_creator_application_trust()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or new.user_id is distinct from v_user_id then
    return new;
  end if;

  if not creatorbridge_private.user_phone_verified(v_user_id) then
    raise exception 'Phone verification is required before submitting a creator application'
      using errcode = '42501';
  end if;
  if not creatorbridge_private.user_identity_verified(v_user_id) then
    raise exception 'Identity verification is required before submitting a creator application'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_creator_application_trust on public.creator_listings;
create trigger enforce_creator_application_trust
before insert on public.creator_listings
for each row execute function creatorbridge_private.enforce_creator_application_trust();

create or replace function creatorbridge_private.enforce_project_contact_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is not null
    and new.client_id = v_user_id
    and coalesce(new.status, 'open') = 'open'
    and not creatorbridge_private.user_phone_verified(v_user_id) then
    raise exception 'Phone verification is required before posting or sending a project request'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_project_contact_phone on public.projects;
create trigger enforce_project_contact_phone
before insert on public.projects
for each row execute function creatorbridge_private.enforce_project_contact_phone();

create or replace function creatorbridge_private.enforce_message_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is not null
    and new.sender_id = v_user_id
    and not creatorbridge_private.user_phone_verified(v_user_id) then
    raise exception 'Phone verification is required before contacting creators'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_message_phone on public.messages;
create trigger enforce_message_phone
before insert on public.messages
for each row execute function creatorbridge_private.enforce_message_phone();

create or replace function creatorbridge_private.enforce_project_call_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trust record;
begin
  select *
  into v_trust
  from public.require_verified_project_parties(new.project_id);

  if not coalesce(v_trust.both_verified, false) then
    raise exception 'Both project parties must complete identity verification before scheduling a call'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_project_call_identity on public.project_calls;
create trigger enforce_project_call_identity
before insert on public.project_calls
for each row execute function creatorbridge_private.enforce_project_call_identity();

revoke all on function creatorbridge_private.enforce_creator_application_trust() from public, anon, authenticated;
revoke all on function creatorbridge_private.enforce_project_contact_phone() from public, anon, authenticated;
revoke all on function creatorbridge_private.enforce_message_phone() from public, anon, authenticated;
revoke all on function creatorbridge_private.enforce_project_call_identity() from public, anon, authenticated;

-- No production members exist yet. This makes any stale prelaunch approval
-- re-enter review if it cannot satisfy the final trust rule.
update public.creator_listings cl
set review_status = 'rejected',
    verified = false,
    verification_status = 'pending',
    review_notes = case
      when length(trim(coalesce(cl.review_notes, ''))) > 0
        then cl.review_notes || E'\n\nRe-review required after human identity enforcement.'
      else 'Re-review required after human identity enforcement.'
    end,
    updated_at = now()
where cl.review_status = 'approved'
  and not public.creator_listing_meets_approval_requirements(cl.id);
