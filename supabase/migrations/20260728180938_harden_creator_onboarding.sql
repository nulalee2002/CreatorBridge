-- Creator onboarding and public-readiness hardening (production-aligned).
-- 1. Remove inherited PUBLIC execution from privileged lookup helpers.
-- 2. Centralize creator readiness in database functions used by approval/search.
-- 3. Save the listing, portfolio, and legal acceptance in one transaction.

create or replace function public.get_project_client_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.client_id
  from public.projects p
  where p.id = p_project_id
    and p.client_id = auth.uid();
$$;

create or replace function public.user_has_project_application(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user_id is distinct from auth.uid() then false
    else exists (
      select 1
      from public.project_applications pa
      join public.creator_listings cl on cl.id::text = pa.listing_id::text
      where pa.project_id = p_project_id
        and cl.user_id = auth.uid()
    )
  end;
$$;

-- These policies require a signed-in participant. Their previous PUBLIC role
-- forced anonymous execution rights onto the helpers above.
alter policy "Project participants can view projects"
  on public.projects to authenticated;
alter policy "Applications viewable by project owner and applicant"
  on public.project_applications to authenticated;

-- PUBLIC is a PostgreSQL pseudo-role inherited by anon/authenticated. The
-- helpers also bind their arguments to auth.uid() so signed-in callers cannot
-- probe unrelated projects or another creator's application state.
revoke execute on function public.get_project_client_id(uuid) from public, anon;
revoke execute on function public.user_has_project_application(uuid, uuid) from public, anon;
grant execute on function public.get_project_client_id(uuid) to authenticated, service_role;
grant execute on function public.user_has_project_application(uuid, uuid) to authenticated, service_role;

-- These functions either expose non-sensitive platform configuration or reject
-- anonymous callers internally, but anonymous EXECUTE is unnecessary.
revoke execute on function public.get_platform_margin_settings() from public, anon;
revoke execute on function public.margin_floor_dollars() from public, anon;
revoke execute on function public.submit_quote_request(
  uuid, text, text, text, text, numeric, text, text, text, text,
  text, text, text, text, text, text, numeric, numeric, text
) from public, anon;
grant execute on function public.get_platform_margin_settings() to authenticated, service_role;
grant execute on function public.margin_floor_dollars() to authenticated, service_role;
grant execute on function public.submit_quote_request(
  uuid, text, text, text, text, numeric, text, text, text, text,
  text, text, text, text, text, text, numeric, numeric, text
) to authenticated, service_role;

create unique index if not exists creator_listings_one_per_user_idx
  on public.creator_listings(user_id)
  where user_id is not null;

create or replace function public.creator_listing_meets_approval_requirements(
  p_listing_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_listings cl
    where cl.id = p_listing_id
      and cl.user_id is not null
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

create or replace function public.creator_listing_is_public_ready(
  p_listing_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_listings cl
    where cl.id = p_listing_id
      and cl.review_status = 'approved'
      and coalesce(cl.verified, false)
      and cl.verification_status in ('verified', 'pro_verified')
      and not coalesce(cl.is_suspended, false)
      and public.creator_listing_meets_approval_requirements(cl.id)
  );
$$;

revoke all on function public.creator_listing_is_public_ready(uuid)
  from public, anon, authenticated;
grant execute on function public.creator_listing_is_public_ready(uuid)
  to anon, authenticated, service_role;

create or replace function public.submit_creator_application(
  p_application jsonb,
  p_document_version text default '1.0'
)
returns public.creator_listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.creator_listings%rowtype;
  v_portfolio jsonb := coalesce(p_application -> 'portfolio', '[]'::jsonb);
  v_item jsonb;
  v_primary_pillar text := left(trim(coalesce(p_application ->> 'primary_pillar', '')), 80);
  v_service_id text;
  v_media_type text;
  v_tags text[];
  v_sub_niches text[];
  v_years integer;
begin
  if v_user_id is null then
    raise exception 'Sign in before submitting a creator application';
  end if;
  if coalesce((select role from public.profiles where id = v_user_id), '') <> 'creator' then
    raise exception 'A creator account is required to submit this application';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  if exists (select 1 from public.creator_listings where user_id = v_user_id) then
    raise exception 'You already have a CreatorBridge creator profile';
  end if;

  if jsonb_typeof(coalesce(p_application -> 'tags', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_application -> 'sub_niches', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(v_portfolio) <> 'array' then
    raise exception 'Creator application lists are malformed';
  end if;

  select coalesce(array_agg(left(trim(value), 80)), '{}'::text[])
  into v_tags
  from jsonb_array_elements_text(coalesce(p_application -> 'tags', '[]'::jsonb));

  select coalesce(array_agg(left(trim(value), 80)), '{}'::text[])
  into v_sub_niches
  from jsonb_array_elements_text(coalesce(p_application -> 'sub_niches', '[]'::jsonb))
  where length(trim(value)) > 0;

  v_years := coalesce((p_application ->> 'years_experience')::integer, 0);

  if length(trim(coalesce(p_application ->> 'name', ''))) < 2 then
    raise exception 'Creator name is required';
  end if;
  if length(trim(coalesce(p_application ->> 'bio', ''))) < 100 then
    raise exception 'Creator bio must be at least 100 characters';
  end if;
  if coalesce(p_application ->> 'avatar', '') not like 'storage://%' then
    raise exception 'Upload a CreatorBridge profile photo before submitting';
  end if;
  if coalesce(p_application ->> 'video_intro_url', '') not like 'bunny:%' then
    raise exception 'Upload a CreatorBridge intro video before submitting';
  end if;
  if v_years < 2 then
    raise exception 'Creator applications require at least 2 years of paid experience';
  end if;
  if upper(coalesce(p_application ->> 'country', 'US')) <> 'US' then
    raise exception 'CreatorBridge creator applications are currently US-only';
  end if;
  if v_primary_pillar not in ('video_production', 'photography', 'post_production')
    or coalesce(array_length(v_sub_niches, 1), 0) not between 1 and 3
    or exists (
      select 1
      from unnest(v_sub_niches) as sub_niche
      where not (
        (v_primary_pillar = 'video_production' and left(sub_niche, 3) = 'vp_')
        or (v_primary_pillar = 'photography' and left(sub_niche, 3) = 'ph_')
        or (v_primary_pillar = 'post_production' and left(sub_niche, 3) = 'pp_')
      )
    ) then
    raise exception 'Choose a valid primary pillar and 1 to 3 matching specialties';
  end if;
  if jsonb_array_length(v_portfolio) < 3 then
    raise exception 'Add at least 3 complete portfolio samples';
  end if;

  for v_item in select value from jsonb_array_elements(v_portfolio)
  loop
    v_service_id := left(trim(coalesce(v_item ->> 'service_id', '')), 80);
    v_media_type := lower(trim(coalesce(v_item ->> 'media_type', '')));
    if length(trim(coalesce(v_item ->> 'title', ''))) = 0
      or length(trim(coalesce(v_item ->> 'description', ''))) = 0
      or length(v_service_id) = 0 then
      raise exception 'Every portfolio sample needs a title, description, and specialty';
    end if;
    if not (v_service_id = any(v_sub_niches)) then
      raise exception 'Portfolio specialties must match the selected creator specialties';
    end if;

    if v_primary_pillar = 'photography'
      or left(v_service_id, 3) = 'ph_'
      or v_service_id = 'pp_photo_retouch' then
      if v_media_type <> 'image' or coalesce(v_item ->> 'image_url', '') not like 'storage://%' then
        raise exception 'Photography and retouching samples require uploaded images';
      end if;
    elsif v_media_type <> 'video' or length(trim(coalesce(v_item ->> 'bunny_video_id', ''))) = 0 then
      raise exception 'Video and post-production samples require uploaded Bunny videos';
    end if;
  end loop;

  insert into public.creator_listings (
    user_id, name, business_name, avatar, bio, experience, years_experience,
    tags, availability, verified, verification_status, review_status,
    city, state, country, zip, region_key, email, phone,
    rating, review_count, video_intro_url, primary_pillar, sub_niches
  )
  values (
    v_user_id,
    left(trim(p_application ->> 'name'), 160),
    nullif(left(trim(coalesce(p_application ->> 'business_name', '')), 160), ''),
    left(trim(p_application ->> 'avatar'), 800),
    left(trim(p_application ->> 'bio'), 4000),
    left(trim(coalesce(p_application ->> 'experience', 'mid')), 40),
    v_years,
    v_tags,
    'available',
    false,
    'pending',
    'pending_review',
    nullif(left(trim(coalesce(p_application ->> 'city', '')), 120), ''),
    nullif(left(trim(coalesce(p_application ->> 'state', '')), 80), ''),
    'US',
    nullif(left(trim(coalesce(p_application ->> 'zip', '')), 12), ''),
    nullif(left(trim(coalesce(p_application ->> 'region_key', 'us-tier2')), 40), ''),
    nullif(left(trim(coalesce(p_application ->> 'email', '')), 320), ''),
    nullif(left(trim(coalesce(p_application ->> 'phone', '')), 40), ''),
    0,
    0,
    left(trim(p_application ->> 'video_intro_url'), 800),
    v_primary_pillar,
    v_sub_niches
  )
  returning * into v_listing;

  insert into public.portfolio_items (
    listing_id, service_id, title, description, link, image_url,
    media_type, bunny_video_id, display_order
  )
  select
    v_listing.id,
    left(trim(value ->> 'service_id'), 80),
    left(trim(value ->> 'title'), 160),
    left(trim(value ->> 'description'), 2000),
    null,
    nullif(left(trim(coalesce(value ->> 'image_url', '')), 800), ''),
    lower(trim(value ->> 'media_type')),
    nullif(left(trim(coalesce(value ->> 'bunny_video_id', '')), 120), ''),
    (ordinality - 1)::integer
  from jsonb_array_elements(v_portfolio) with ordinality;

  insert into public.legal_acceptances (
    user_id, document_type, document_version
  )
  values (
    v_user_id,
    'creator_agreement',
    left(trim(coalesce(p_document_version, '1.0')), 40)
  )
  on conflict (user_id, document_type, document_version) do nothing;

  return v_listing;
end;
$$;

revoke all on function public.submit_creator_application(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_creator_application(jsonb, text)
  to authenticated, service_role;

drop function if exists public.get_admin_creator_review_queue();
create function public.get_admin_creator_review_queue()
returns table (
  listing_id uuid,
  creator_user_id uuid,
  creator_name text,
  business_name text,
  city text,
  state text,
  review_status text,
  verification_status text,
  submitted_at timestamptz,
  years_experience integer,
  video_intro_url text,
  portfolio_count bigint,
  package_count bigint,
  service_count bigint,
  approval_ready boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    cl.id as listing_id,
    cl.user_id as creator_user_id,
    cl.name as creator_name,
    cl.business_name,
    cl.city,
    cl.state,
    coalesce(cl.review_status, 'pending_review') as review_status,
    coalesce(cl.verification_status, 'unverified') as verification_status,
    cl.submitted_at,
    cl.years_experience,
    cl.video_intro_url,
    count(distinct pi.id) as portfolio_count,
    count(distinct pkg.id) as package_count,
    count(distinct cs.id) as service_count,
    public.creator_listing_meets_approval_requirements(cl.id) as approval_ready
  from public.creator_listings cl
  left join public.portfolio_items pi on pi.listing_id = cl.id
  left join public.packages pkg on pkg.listing_id = cl.id
  left join public.creator_services cs on cs.listing_id = cl.id
  where coalesce(cl.review_status, 'pending_review') <> 'approved'
  group by cl.id
  order by cl.submitted_at desc nulls last, cl.created_at desc nulls last
  limit 100;
end;
$$;

revoke all on function public.get_admin_creator_review_queue()
  from public, anon, authenticated;
grant execute on function public.get_admin_creator_review_queue()
  to authenticated, service_role;

create or replace function public.admin_approve_creator(
  p_listing_id uuid
)
returns public.creator_listings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_listing public.creator_listings%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not public.creator_listing_meets_approval_requirements(p_listing_id) then
    raise exception 'Creator profile is not ready for approval';
  end if;

  update public.creator_listings
  set review_status = 'approved',
      verified = true,
      verification_status = 'verified',
      updated_at = now()
  where id = p_listing_id
  returning * into v_listing;

  if not found then
    raise exception 'Creator listing not found' using errcode = 'P0002';
  end if;
  return v_listing;
end;
$$;

revoke all on function public.admin_approve_creator(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_approve_creator(uuid)
  to authenticated, service_role;

create or replace function public.admin_approve_creator_noted(
  p_listing_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_notes, ''))) = 0 then
    raise exception 'Approval reason is required';
  end if;
  if not public.creator_listing_meets_approval_requirements(p_listing_id) then
    raise exception 'Creator profile is not ready for approval';
  end if;

  update public.creator_listings
  set review_status = 'approved',
      verified = true,
      verification_status = 'verified',
      review_notes = left(trim(p_notes), 2000),
      updated_at = now()
  where id = p_listing_id;

  if not found then
    raise exception 'Creator listing not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_approve_creator_noted(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_approve_creator_noted(uuid, text)
  to authenticated, service_role;

-- Legacy approvals that never met the complete standard must not become public
-- automatically after filling fields later; put them back through admin review.
update public.creator_listings cl
set review_status = 'rejected',
    verified = false,
    verification_status = 'pending',
    review_notes = case
      when length(trim(coalesce(cl.review_notes, ''))) > 0
        then cl.review_notes || E'\n\nRe-review required after readiness hardening.'
      else 'Re-review required after readiness hardening.'
    end,
    updated_at = now()
where cl.review_status = 'approved'
  and not public.creator_listing_meets_approval_requirements(cl.id);

drop function if exists public.search_creators(text);
create or replace function public.search_creators(query text)
returns table (
  id uuid,
  name text,
  bio text,
  city text,
  state text,
  tier text,
  avatar text,
  verified boolean,
  review_status text,
  primary_pillar text,
  sub_niches text[],
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select
    cl.id,
    cl.name,
    cl.bio,
    cl.city,
    cl.state,
    cl.tier,
    cl.avatar,
    cl.verified,
    cl.review_status,
    cl.primary_pillar,
    cl.sub_niches,
    greatest(
      ts_rank(cl.search_vector, websearch_to_tsquery('english', query)),
      similarity(coalesce(cl.name, ''), query),
      similarity(coalesce(cl.business_name, ''), query),
      similarity(coalesce(cl.primary_pillar, ''), query)
    ) as rank
  from public.creator_listings cl
  where public.creator_listing_is_public_ready(cl.id)
    and (
      cl.search_vector @@ websearch_to_tsquery('english', query)
      or coalesce(cl.name, '') % query
      or coalesce(cl.business_name, '') % query
      or coalesce(cl.primary_pillar, '') % query
      or exists (
        select 1
        from unnest(coalesce(cl.sub_niches, '{}'::text[])) as sub_niche
        where sub_niche ilike '%' || query || '%'
      )
    )
  order by rank desc;
$$;

revoke all on function public.search_creators(text)
  from public, anon, authenticated;
grant execute on function public.search_creators(text)
  to anon, authenticated, service_role;
