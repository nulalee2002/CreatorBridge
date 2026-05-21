-- Remove older broad policies that can overlap with the hardened marketplace model.

drop policy if exists "Listings are viewable by everyone" on public.creator_listings;
drop policy if exists "Anyone can view listings" on public.creator_listings;

drop policy if exists "Projects viewable by everyone" on public.projects;
drop policy if exists "Users can insert transactions" on public.transactions;
drop policy if exists "Authenticated users can send messages" on public.messages;

comment on table public.creator_listings is
  'Public listing reads are limited to approved supply. Creators can read and manage their own listings through dedicated owner policies.';

comment on table public.projects is
  'Public project reads are limited to open briefs. Private workflow records are visible only to clients, accepted creators, applicants, and platform admins.';

comment on table public.transactions is
  'Payment ledger records are server-owned. Authenticated users may read participant rows through RLS, but inserts and updates must go through trusted Edge Functions using the service role.';
