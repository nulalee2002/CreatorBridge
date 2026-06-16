alter table public.portfolio_items
  add column if not exists bunny_video_id text;

comment on column public.creator_listings.video_intro_url is
  'Required intro video reference. CreatorBridge-owned Bunny Stream videos are stored as bunny:<video_id>.';

comment on column public.portfolio_items.bunny_video_id is
  'Bunny Stream video id for CreatorBridge-hosted portfolio videos.';

create or replace function public.creator_text_has_outbound_leak(p_text text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_text, '') ~* '(@[a-z0-9_.]{2,}|https?://|www\.|[a-z0-9_-]+\.(com|net|org|io|co|me|us|uk|studio|app|dev|tv|media|photography|film|video)\b|[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}|\+?\d[\s\-.()]{0,2}\d[\s\-.()]{0,2}\d[\s\-.()]{0,2}\d[\s\-.()]{0,2}\d[\s\-.()]{0,2}\d[\s\-.()]{0,2}\d|venmo|cash\s*app|cashapp|zelle|paypal|instagram|youtube|youtu\.be|vimeo|linkedin|loom|tiktok|facebook|twitter|x\.com)'
$$;

create or replace function public.validate_creator_walled_garden_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.website := null;
  new.instagram := null;
  new.youtube := null;
  new.vimeo := null;
  new.linkedin := null;

  if public.creator_text_has_outbound_leak(new.name)
    or public.creator_text_has_outbound_leak(new.business_name)
    or public.creator_text_has_outbound_leak(new.bio) then
    raise exception 'Keep contact details and outside links off your CreatorBridge profile.'
      using errcode = '23514';
  end if;

  if coalesce(new.review_status, 'pending_review') in ('pending_review', 'approved')
    and coalesce(new.video_intro_url, '') not like 'bunny:%' then
    raise exception 'Upload your CreatorBridge intro video before submitting your profile.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists creator_walled_garden_profile_guard on public.creator_listings;
create trigger creator_walled_garden_profile_guard
before insert or update on public.creator_listings
for each row execute function public.validate_creator_walled_garden_profile();

create or replace function public.validate_portfolio_walled_garden_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_video_count integer;
  v_photo_count integer;
begin
  if public.creator_text_has_outbound_leak(new.title)
    or public.creator_text_has_outbound_leak(new.description) then
    raise exception 'Keep contact details and outside links off portfolio text.'
      using errcode = '23514';
  end if;

  if coalesce(new.media_type, 'image') = 'video' then
    if coalesce(new.bunny_video_id, '') = '' then
      raise exception 'Portfolio videos must be uploaded through CreatorBridge.'
        using errcode = '23514';
    end if;
    new.link := null;
  else
    new.bunny_video_id := null;
    if coalesce(new.image_url, '') = '' then
      raise exception 'Portfolio photos need an uploaded image.'
        using errcode = '23514';
    end if;
  end if;

  select count(*) into v_video_count
  from public.portfolio_items
  where listing_id = new.listing_id
    and id is distinct from new.id
    and (media_type = 'video' or bunny_video_id is not null);

  select count(*) into v_photo_count
  from public.portfolio_items
  where listing_id = new.listing_id
    and id is distinct from new.id
    and coalesce(media_type, 'image') <> 'video'
    and bunny_video_id is null;

  if coalesce(new.media_type, 'image') = 'video' then
    v_video_count := v_video_count + 1;
  else
    v_photo_count := v_photo_count + 1;
  end if;

  if v_video_count > 3 then
    raise exception 'Portfolio video cap is 3 videos.'
      using errcode = '23514', constraint = 'portfolio_video_cap';
  end if;

  if v_photo_count > 6 then
    raise exception 'Portfolio photo cap is 6 photos.'
      using errcode = '23514', constraint = 'portfolio_photo_cap';
  end if;

  return new;
end;
$$;

drop trigger if exists portfolio_walled_garden_item_guard on public.portfolio_items;
create trigger portfolio_walled_garden_item_guard
before insert or update on public.portfolio_items
for each row execute function public.validate_portfolio_walled_garden_item();
