-- ============================================================================
-- SECURITY HARDENING DRAFT — REVIEW BEFORE APPLY (written 2026-06-11 by Claude)
--
-- NOT applied to production. Addresses Supabase security advisor warnings.
-- All listed functions already check auth.uid() / is_platform_admin()
-- internally, so this is defense in depth, not a fix for an active hole.
--
-- To apply after review: rename the file to remove the DRAFT suffix and run
-- `supabase db push`, or paste into the Supabase SQL editor.
--
-- MANUAL STEP (dashboard, not SQL): enable "Leaked password protection"
-- under Authentication -> Providers -> Password security.
-- ============================================================================

-- 1. Pin search_path on trigger functions flagged by the linter --------------
alter function public.set_availability_updated_at() set search_path = public, pg_temp;
alter function public.set_support_tickets_updated_at() set search_path = public, pg_temp;

-- 2. Remove anonymous EXECUTE from admin-only SECURITY DEFINER functions -----
-- Anonymous visitors have no reason to invoke admin review actions.
revoke execute on function public.admin_approve_creator(uuid) from anon;
revoke execute on function public.admin_approve_creator_noted(uuid, text) from anon;
revoke execute on function public.admin_reject_creator(uuid) from anon;
revoke execute on function public.admin_suspend_creator(uuid) from anon;
revoke execute on function public.get_admin_creator_review_queue() from anon;
revoke execute on function public.get_admin_platform_summary() from anon;

-- 3. Remove anonymous EXECUTE from authenticated-only workflow functions -----
-- These all require a logged-in user id internally; anon calls only error.
revoke execute on function public.accept_project_application(uuid, uuid) from anon;
revoke execute on function public.apply_to_project(uuid, uuid, text, numeric) from anon;
revoke execute on function public.create_project_brief(text, text, text, numeric, numeric, text, text, text) from anon;
revoke execute on function public.consume_chatbot_ai_quota(uuid, integer) from anon;
revoke execute on function public.refresh_network_post_like_count() from anon;
revoke execute on function public.refresh_network_post_reply_count() from anon;
revoke execute on function public.user_has_project_application(uuid, uuid) from anon;
revoke execute on function public.get_project_client_id(uuid) from anon;
revoke execute on function public.is_platform_admin(uuid) from anon;

-- NOTE deliberately NOT revoked:
--   public.submit_quote_request(...) — the public quote form may run before
--   login and is already protected by Turnstile + the edge function.
--   Review whether guest quote requests are still a supported flow before
--   touching it.

-- 4. Advisor items intentionally left alone ----------------------------------
--   * waitlist_anon_insert WITH CHECK (true): intentional public waitlist.
--   * pg_trgm / unaccent in public schema: moving extensions is disruptive
--     and low value; revisit post-launch.
