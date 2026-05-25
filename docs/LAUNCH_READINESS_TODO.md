# CreatorBridge Launch Readiness Todo

Updated: 2026-05-25

## Active Launch Checks

- [ ] Re-test creator profile pages after the 3-pillar profile fix. Public profiles must show one primary pillar and 1-3 specialties, never multiple old service lanes such as Drone / Aerial as a standalone primary tab.
- [ ] Re-test Admin Operations global search after the creator listing column fix. Search should work against creator name, business name, city, state, and primary pillar.
- [ ] Run `npm run verify:release-payment-security` after redeploying `release-payment`. It must prove unauthenticated calls are blocked and the final payout email resolves the creator listing's `user_id`, not the listing id.
- [ ] Run live browser QA for support ticket submit, admin support view/update, admin operations, admin finance CSV export, admin analytics, global creator search, and creator agreement print-to-PDF.
- [ ] Run live browser QA for notification center: quote request notification, direct message notification, proposal accepted notification, and unread/read state.
- [ ] Run `npm run verify:notifications` from a network-enabled terminal after notification deploys.
- [ ] Run `npm run verify:email-provider` after Resend setup. It must return a Resend message id, not local mock mode.
- [ ] Confirm Supabase Edge Function secrets include `RESEND_API_KEY`, and optionally `RESEND_FROM_EMAIL` if the sender should differ from `CreatorBridge <drl33@creatorbridge.studio>`.
- [ ] Confirm Supabase Dashboard → Authentication → Emails uses the Resend/custom SMTP provider for Auth emails, not the default Supabase sender.
- [ ] Review Supabase/Resend bounce logs and remove or correct bounced recipient addresses before launch.
- [x] Run `supabase db query --linked -f scripts/verify-data-api-grants.sql` and fix any `CHECK_RLS_OFF` or `CHECK_NO_DATA_API_GRANT` rows before UI redesign work.
- [ ] Confirm Vercel production has `VITE_TURNSTILE_SITE_KEY` and Supabase Edge Functions have `TURNSTILE_SECRET_KEY`.
- [ ] Confirm `release-payment` is protected in production by a valid user token or trusted job secret. Do not assume Supabase `verify_jwt` config from function list alone.
- [ ] Verify `send-notification-email` rejects unauthenticated calls after redeploy.
- [ ] Choose an SMS provider before adding text notifications. Do not fake SMS until phone verification, consent, opt-out, and provider billing are configured.

## UI Redesign Queue

- [ ] Use the Claude Design prompt in `docs/CLAUDE_DESIGN_3_PILLAR_UI_PROMPT.md` to regenerate the design around the final 3-pillar taxonomy.
- [ ] Keep the current production app functional while the redesign is prepared. Do not replace the whole UI until security, payment, support, and admin flows have clean QA.
- [ ] Replace placeholder/AI-looking images with realistic client-work imagery from the curated image library or approved external sources.
- [ ] Rebuild the profile footer/bottom layout to match the new design direction instead of stretching or clipping on wide screens.

## Verified So Far

- Support tickets, admin support, admin finance, admin operations, platform search, SEO/waitlist, admin analytics, accessibility CSS, creator agreement print, and transactional email code exist in the codebase.
- The search migration `20260525102500_update_search_for_three_pillar_taxonomy.sql` was corrected and applied to production.
- The old orphaned payment transactions are no longer orphaned: both queried records show `final_status = released` with transfer ids.
- In-app notification center code now exists for quote requests, direct messages, and accepted proposals with 24-hour response due dates.

## Corrected On 2026-05-25

- Creator profile pages now prefer `creator_listings.primary_pillar` and `sub_niches` over legacy `creator_services` rows.
- Admin Operations global search now uses real `creator_listings` columns instead of old nonexistent `display_name` / `location` fields.
- Admin Analytics pending creator count now uses `pending_review`, and tier counts normalize lowercase stored tiers.
- `release-payment` final payout email now resolves the creator auth user through `creator_listings.user_id`.
- Support tickets now sanitize subject and description before insert.
- `send-notification-email` now requires a valid logged-in user token or trusted service-role call before sending.
- Notification emails now skip missing, invalid, and reserved example/test recipient domains instead of sending to fake fallback addresses.
- Resend provider verification passed after rotating the Supabase `RESEND_API_KEY` secret. Resend showed the QA support email as delivered.
- Supabase Data API grant/RLS audit passed with `issue_count = 0`.
