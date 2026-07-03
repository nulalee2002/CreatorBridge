-- CreatorBridge does not host or promote any outside social media. The
-- creator_listings website/instagram/youtube/vimeo/linkedin columns were dormant
-- (never collected in onboarding, never displayed) and were force-nulled on every
-- save by validate_creator_walled_garden_profile. Remove them entirely.
--
-- Recreate the trigger function WITHOUT the now-invalid null-assignments first,
-- so it no longer references the columns, then drop the columns. The outbound-leak
-- checks on name/business_name/bio and the intro-video gate are preserved — those
-- remain the real anti-poaching guard.
create or replace function public.validate_creator_walled_garden_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    (tg_op = 'INSERT' or new.name is distinct from old.name)
    and public.creator_text_has_outbound_leak(new.name)
  ) or (
    (tg_op = 'INSERT' or new.business_name is distinct from old.business_name)
    and public.creator_text_has_outbound_leak(new.business_name)
  ) or (
    (tg_op = 'INSERT' or new.bio is distinct from old.bio)
    and public.creator_text_has_outbound_leak(new.bio)
  ) then
    raise exception 'Keep contact details and outside links off your CreatorBridge profile.'
      using errcode = '23514';
  end if;

  if coalesce(new.review_status, 'pending_review') in ('pending_review', 'approved')
    and (
      tg_op = 'INSERT'
      or new.review_status is distinct from old.review_status
      or new.video_intro_url is distinct from old.video_intro_url
    )
    and coalesce(new.video_intro_url, '') not like 'bunny:%' then
    raise exception 'Upload your CreatorBridge intro video before submitting your profile.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter table public.creator_listings
  drop column if exists website,
  drop column if exists instagram,
  drop column if exists youtube,
  drop column if exists vimeo,
  drop column if exists linkedin;
