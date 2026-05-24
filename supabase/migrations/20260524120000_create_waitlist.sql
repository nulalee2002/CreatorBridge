-- ── Prompt 5: Waitlist email capture ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source     text        NOT NULL DEFAULT 'homepage'
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can join the waitlist
CREATE POLICY "waitlist_anon_insert"
  ON public.waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- No SELECT policy = only service role can read the list
