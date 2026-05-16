alter table public.portfolio_items
  add column if not exists image_url text,
  add column if not exists media_type text default 'link';

comment on column public.portfolio_items.image_url is
  'Optional CreatorBridge portfolio preview image URL or storage reference.';

comment on column public.portfolio_items.media_type is
  'Portfolio item media classification for future image, video, and link handling.';
