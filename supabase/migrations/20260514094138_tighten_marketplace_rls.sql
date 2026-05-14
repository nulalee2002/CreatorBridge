-- Tighten CreatorBridge marketplace RLS for production trust.
-- Public browsing should only see approved supply and open project briefs.
-- Payment ledger writes must stay server-side through trusted Edge Functions.

drop policy if exists "Listings are viewable by everyone" on public.creator_listings;
drop policy if exists "Approved listings are viewable by everyone" on public.creator_listings;
create policy "Approved listings are viewable by everyone"
  on public.creator_listings
  for select
  to anon, authenticated
  using (
    verified = true
    or verification_status in ('verified', 'pro_verified')
  );

drop policy if exists "Creators can view own listings" on public.creator_listings;
create policy "Creators can view own listings"
  on public.creator_listings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Projects viewable by everyone" on public.projects;
drop policy if exists "Open projects viewable by everyone" on public.projects;
create policy "Open projects viewable by everyone"
  on public.projects
  for select
  to anon, authenticated
  using (status = 'open');

drop policy if exists "Project participants can view projects" on public.projects;
create policy "Project participants can view projects"
  on public.projects
  for select
  to authenticated
  using (
    client_id = (select auth.uid())
    or accepted_creator_id in (
      select id::text from public.creator_listings where user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.project_applications pa
      join public.creator_listings cl on cl.id = pa.listing_id
      where pa.project_id = public.projects.id
        and cl.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can insert transactions" on public.transactions;

comment on table public.transactions is
  'Payment ledger records are server-owned. Authenticated users may read participant rows through RLS, but inserts and updates must go through trusted Edge Functions using the service role.';

comment on table public.payment_events is
  'Payment event records are server-owned. Participants may read related events, but client applications must not insert payment events directly.';
