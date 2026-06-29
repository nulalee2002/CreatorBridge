-- ============================================================================
-- DATABASE SECURITY HARDENING — APPLY READY
--
-- Defense-in-depth for public RPC surface:
-- * pin search_path on flagged functions
-- * remove anonymous EXECUTE from admin/workflow functions
-- * remove public access to financial and trigger-only functions
--
-- Admin functions retain authenticated EXECUTE intentionally: dashboard callers
-- are signed-in users and each admin RPC re-checks is_platform_admin() internally.
-- Trigger functions continue to run normally after EXECUTE grants are revoked.
-- ============================================================================

alter function public.creator_text_has_outbound_leak(text) set search_path = public, pg_temp;
alter function public.set_availability_updated_at() set search_path = public, pg_temp;
alter function public.set_support_tickets_updated_at() set search_path = public, pg_temp;

revoke execute on function public.admin_approve_creator(uuid) from anon;
revoke execute on function public.admin_approve_creator_noted(uuid, text) from anon;
revoke execute on function public.admin_reject_creator(uuid) from anon;
revoke execute on function public.admin_suspend_creator(uuid) from anon;
revoke execute on function public.get_admin_creator_review_queue() from anon;
revoke execute on function public.get_admin_platform_summary() from anon;

revoke execute on function public.accept_project_application(uuid, uuid) from anon;
revoke execute on function public.apply_to_project(uuid, uuid, text, numeric) from anon;
revoke execute on function public.create_project_brief(text, text, text, numeric, numeric, text, text, text) from anon;
revoke execute on function public.consume_chatbot_ai_quota(uuid, integer) from anon;
revoke execute on function public.user_has_project_application(uuid, uuid) from anon;
revoke execute on function public.get_project_client_id(uuid) from anon;
revoke execute on function public.is_platform_admin(uuid) from anon;

revoke execute on function public.grant_referral_credit_for_released_transaction(uuid) from anon;
revoke execute on function public.grant_referral_credit_for_released_transaction(uuid) from authenticated;

revoke execute on function public.enforce_listing_margin_floor() from anon, authenticated;
revoke execute on function public.enforce_package_margin_floor() from anon, authenticated;
revoke execute on function public.prevent_client_phone_verification_tamper() from anon, authenticated;
revoke execute on function public.refresh_network_post_like_count() from anon, authenticated;
revoke execute on function public.refresh_network_post_reply_count() from anon, authenticated;

