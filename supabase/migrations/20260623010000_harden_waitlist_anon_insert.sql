-- ============================================================================
-- WAITLIST ANON INSERT HARDENING
--
-- The original waitlist_anon_insert policy used WITH CHECK (true), which let
-- anonymous callers insert arbitrary rows. This replaces it with bounded field
-- validation while preserving the public waitlist signup path.
--
-- This does not add per-IP rate limiting. True throttling should route signup
-- through an edge function with rate limiting and Turnstile.
-- ============================================================================

drop policy if exists "waitlist_anon_insert" on public.waitlist;

create policy "waitlist_anon_insert"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and char_length(email) <= 254
    and char_length(coalesce(source, '')) <= 64
  );

