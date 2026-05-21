-- Ensure creators retain access to their own listings after public browse tightening.

alter table public.creator_listings enable row level security;

drop policy if exists "Approved listings are viewable by everyone" on public.creator_listings;
create policy "Approved listings are viewable by everyone"
  on public.creator_listings
  for select
  to anon, authenticated
  using (
    verified = true
    or verification_status in ('verified', 'pro_verified')
    or review_status = 'approved'
  );

drop policy if exists "Creators can view own listings" on public.creator_listings;
create policy "Creators can view own listings"
  on public.creator_listings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Creators can insert own listings" on public.creator_listings;
create policy "Creators can insert own listings"
  on public.creator_listings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Creators can update own listings" on public.creator_listings;
create policy "Creators can update own listings"
  on public.creator_listings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Creators can delete own listings" on public.creator_listings;
create policy "Creators can delete own listings"
  on public.creator_listings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
