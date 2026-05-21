-- Repair profile RLS after admin-policy hardening.
-- Keep profile reads simple so profile policies never query profiles recursively.

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Platform admins can read profiles" on public.profiles;
create policy "Platform admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_platform_admin());
