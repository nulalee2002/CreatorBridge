# CreatorBridge Launch Readiness Todo

Updated: 2026-06-10

This file is intentionally short. Only items that can block a public launch belong in the Launch Gate. Optional features, design polish, and future upgrades stay out of the gate so the finish line does not keep moving.

## Launch Gate: 3 Items Left

- [ ] Run the remaining live browser smoke pass for logged-in/support/admin actions: support ticket submit, notification center unread/read behavior, admin support view/update, admin operations search, admin finance CSV export, admin analytics, and creator agreement print.
- [ ] Review Supabase/Resend bounce logs and remove or correct bad recipient addresses before opening the platform to real users.
- [ ] Run the final `npm run verify:launch-sweep` after the last visual/content change and keep the passing output as launch evidence.

## Already Cleared For Launch Gate

- [x] Local platform audit passed 183 checks on 2026-06-03.
- [x] Production build completed on 2026-06-03 after the latest workflow verifier hardening.
- [x] `npm run verify:workflow-smoke` passed from the Mac terminal on 2026-06-03: messaging/contact protection, project lifecycle/dispute handling, and network membership gates all passed.
- [x] Release-payment security passed.
- [x] Admin/support/search verifier passed.
- [x] Chatbot guide mode passed and does not spend paid AI credits.
- [x] Notification verifier passed.
- [x] Resend email provider verifier passed.
- [x] Supabase Auth SMTP is configured with Resend.
- [x] Supabase Data API grant/RLS audit passed.
- [x] External env verifier passed for required launch services.
- [x] `send-notification-email` rejects unauthenticated calls.
- [x] Request quote onboarding uses the 3 primary pillars and taxonomy specialties.
- [x] Client-assisted brief guidance exists in Project Board and quote request flows.
- [x] Creator application flow guides users through required identity, bio, US location, one primary pillar, 1-3 specialties, portfolio, intro video, and final acknowledgments before submission.
- [x] Creator approval is manual: submitted listings are saved as `pending_review`, hidden from approved directory results, then approved/rejected from Admin Dashboard or Admin Operations.
- [x] Client approval is intentionally self-serve: clients can create accounts without manual admin approval, while creator hiring/payment/proposal activity remains protected by authenticated project and payment flows.
- [x] Admin Operations has the stronger creator approval path because approval requires an admin reason and routes through `admin_approve_creator_noted`.
- [x] Image launch gate cleared on 2026-06-10: active app image references were reduced to 58 paths; 36 handoff images are covered by the existing Unsplash handoff note, 22 background images are cleared by git-history Unsplash filenames, and the 10 visible unknown-source references were replaced with already cleared image paths.
- [x] In-app Browser public/mobile smoke pass completed on 2026-06-03 against local CreatorBridge: homepage, find creators, project board, network, calculator, sample creator profile, login, creator dashboard auth gate, client dashboard auth gate, creator agreement, terms, and dispute policy rendered with no broken images found. Phone-width checks for homepage, find creators, project board, network, calculator, sample creator profile, login, creator dashboard auth gate, and client dashboard auth gate found no horizontal overflow.

## Not Launch Blockers

- Paid chatbot AI can be enabled when needed, but Bridge should stay hybrid: local platform guide first, paid AI only after a logged-in user clicks `Use live AI help`, with account-level daily quota and token limits active.
- SMS/text notifications. Do not add until provider, consent, opt-out, phone verification, and billing are ready.
- Full Claude Design pixel-perfect sweep. Important polish, but not a payment/security/support blocker.
- Additional creator-protection migrations. Review `docs/CREATOR_PROTECTION_AND_SCOPE_CONTROL.md` before writing migrations, but do not change the 50/50 payment structure.
- Profile footer redesign and other non-breaking visual refinements.

## Verified So Far

- Support tickets, admin support, admin finance, admin operations, platform search, SEO/waitlist, admin analytics, accessibility CSS, creator agreement print, and transactional email code exist in the codebase.
- Admin can review creators in `/admin` and `/admin/operations`; admin support tickets are managed in `/admin/support`; finance and analytics have separate guarded admin pages.
- Messaging uses the `send_creatorbridge_message` RPC, which blocks off-platform contact details until there is an active booking.
- Project briefs use the `create_project_brief` RPC, which centralizes project creation through authenticated users rather than loose client-side inserts.
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
- `npm run verify:email-provider` passed with Resend message id `8c86ecad-52d2-4f5c-a176-f9d350d41c36`.
- Supabase Auth SMTP settings are enabled with Resend (`smtp.resend.com`, sender `drl33@creatorbridge.studio`, sender name `CreatorBridge`).
- Supabase Data API grant/RLS audit passed with `issue_count = 0`.
- `npm run verify:release-payment-security` passed: unauthenticated/fake-token calls are blocked, client/admin authorization is present, trusted job secret path exists, and creator payout email resolves through `creator_listings.user_id`.
- `npm run verify:admin-support-search` passed: support ticket RLS, non-admin admin-data blocks, 3-pillar search fields, and admin finance/analytics source queries are working.
- Added `npm run verify:launch-sweep` so the final automated pre-UI checks can be run as one command.
- `npm run verify:launch-sweep` passed on 2026-05-25: build, notifications, Resend, release-payment security, and admin/support/search all passed.
- Notification verifier passed: direct-message notification created, 24-hour response due date set, cross-user RLS blocked, mark-read worked, and unauthenticated email calls were blocked.
- Request quote onboarding now uses the 3 primary pillars and taxonomy specialties instead of old standalone service lanes.
- Current homepage/join/footer copy was adjusted to stop presenting podcast, drone, and events as standalone primary categories.
- `npm run verify:external-env` passed: Vercel production has `VITE_TURNSTILE_SITE_KEY`, and Supabase secrets have `TURNSTILE_SECRET_KEY` plus `RESEND_API_KEY`.
