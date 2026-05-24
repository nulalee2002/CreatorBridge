-- ── Prompt 3: Violations system + creator listing extensions ──────────────────

-- 1. Extend creator_listings with strike_count, is_suspended, review_notes
ALTER TABLE public.creator_listings
  ADD COLUMN IF NOT EXISTS strike_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_suspended  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes  text;

-- 2. Violations table
CREATE TABLE IF NOT EXISTS public.violations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  creator_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reported_by    uuid        REFERENCES auth.users ON DELETE SET NULL,
  violation_type text        NOT NULL CHECK (violation_type IN (
                               'off_platform_contact', 'payment_bypass',
                               'fake_credentials', 'harassment', 'other')),
  description    text        NOT NULL,
  strike_number  integer     NOT NULL CHECK (strike_number BETWEEN 1 AND 3),
  status         text        NOT NULL DEFAULT 'under_review'
                             CHECK (status IN ('under_review', 'confirmed', 'dismissed')),
  admin_notes    text
);

ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;

-- Only platform admins can select violations (creators cannot see their own)
CREATE POLICY "violations_admin_select"
  ON public.violations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- Only platform admins can log new violations
CREATE POLICY "violations_admin_insert"
  ON public.violations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- Only platform admins can update violation status / notes
CREATE POLICY "violations_admin_update"
  ON public.violations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- 3. Approve creator with a reason note
CREATE OR REPLACE FUNCTION public.admin_approve_creator_noted(
  p_listing_id uuid,
  p_notes      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.creator_listings
  SET review_status       = 'approved',
      verified            = true,
      verification_status = 'verified',
      review_notes        = p_notes,
      updated_at          = now()
  WHERE id = p_listing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_creator_noted(uuid, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.admin_approve_creator_noted(uuid, text) TO authenticated;

-- 4. Suspend a creator — sets is_suspended, flips verified/review_status so they
--    disappear from all public directory queries that filter on review_status = 'approved'
CREATE OR REPLACE FUNCTION public.admin_suspend_creator(p_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.creator_listings
  SET is_suspended  = true,
      verified      = false,
      review_status = 'suspended',
      updated_at    = now()
  WHERE id = p_listing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_creator(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.admin_suspend_creator(uuid) TO authenticated;
