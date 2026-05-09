alter table public.client_profiles
  add column if not exists avatar_url text,
  add column if not exists website text,
  add column if not exists bio text;

comment on column public.client_profiles.avatar_url is 'Client logo or headshot URL shown on the client command center.';
comment on column public.client_profiles.website is 'Client company or brand website shown as booking context.';
comment on column public.client_profiles.bio is 'Short client profile summary for creator trust context.';
