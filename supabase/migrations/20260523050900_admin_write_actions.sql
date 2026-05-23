-- Phase 2 Admin Write Actions: Approve and Reject Creators

create or replace function public.admin_approve_creator(
  p_listing_id uuid
)
returns public.creator_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.creator_listings%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
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

revoke all on function public.admin_approve_creator(uuid) from public;
grant execute on function public.admin_approve_creator(uuid) to authenticated;


create or replace function public.admin_reject_creator(
  p_listing_id uuid
)
returns public.creator_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.creator_listings%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  update public.creator_listings
  set review_status = 'rejected',
      verified = false,
      verification_status = 'unverified',
      updated_at = now()
  where id = p_listing_id
  returning * into v_listing;

  if not found then
    raise exception 'Creator listing not found' using errcode = 'P0002';
  end if;

  return v_listing;
end;
$$;

revoke all on function public.admin_reject_creator(uuid) from public;
grant execute on function public.admin_reject_creator(uuid) to authenticated;
