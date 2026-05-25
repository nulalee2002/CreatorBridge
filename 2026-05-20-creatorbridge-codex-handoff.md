# CreatorBridge — Codex Technical Handoff Report
**Date:** 2026-05-20  
**Prepared by:** Claude (Cowork session)  
**For:** Codex — continuing QA, debugging, and next-feature work  
**Project:** `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc`  
**Live site:** https://www.creatorbridge.studio  
**Supabase project ID:** `mxizhszqhbhxzkkhgnmg`  
**GitHub repo:** `nulalee2002/CreatorMatch` (Vercel project: `creator-bridge`)

---

## 1. Current Platform Status

### Confirmed Working
- Full end-to-end Stripe payment cycle: client pays retainer → webhook fires → project status updates → creator delivers → client pays final balance → webhook fires → Stripe transfer to creator's Express account → `final_transfer_id` populated. Verified live on 2026-05-21 05:31 UTC.
- Stripe webhook v17 is live and correctly handles `payment_intent.succeeded` for both retainer and final payment types.
- Project status lifecycle transitions are correct: `open → accepted → retainer_paid → in_progress → delivered → approved → final_paid`.
- Creator Stripe Express Connect account `acct_1TYwLCRJtjbSy0AN` is fully onboarded: `stripe_onboarded = true`, `payouts_enabled = true`.
- Chatbot is returning real Anthropic AI responses (confirmed by 200 status in edge function logs). Uses model `claude-haiku-4-5-20251001`, `max_tokens: 350`.
- Nav role-gating: creators see dashboard icon → `/dashboard`, clients see user icon → `/client`. Avatar is clickable and routes correctly.
- Auth modal, creator registration, project board, creator profile pages, client profile page — all render.
- All 8 Supabase Edge Functions are ACTIVE (see Section 11).
- All 19 migrations applied to live Supabase.
- RLS enabled on all core marketplace tables. Three RLS fix migrations applied on 2026-05-20 to resolve infinite recursion bug.

### Partially Working
- `release-payment` edge function (v16) has `verify_jwt: false`. The function does correctly check transaction state before releasing, but it is not JWT-protected. Any caller who knows the endpoint URL and a valid `transactionId` could potentially trigger a payout release. **This is a security risk.** See Section 9.
- Two older test transactions (`4d278d89` and `38e19b23`) have `final_status = 'paid'` but `final_transfer_id = null`. These were created during earlier QA sessions where the webhook did not complete the transfer (the webhook was on an older version at the time). These transactions are orphaned — money was charged but the creator transfer was never created. They need manual cleanup or a backfill script. See Section 9.
- `test-topup` edge function (v2) is live and CORS-enabled for QA. It is protected only by a custom request header. It must not be left callable from production without additional protection.
- Admin hub (`/admin` route) is a stub. The route exists and is protected to admin-role users only, but it does no real admin actions yet.
- Storage buckets (`creator-portfolio`, `creator-intros`, `client-assets`, `project-attachments`, `project-deliveries`) were created and RLS policies were written in schema source, but file upload flows are not fully wired in the UI. Supabase Storage is a placeholder.
- Mobile QA has not been performed in this session.

### Still Broken or Untested
- Full browser QA with a fresh non-test user account has not been performed. All browser QA used the two test accounts.
- Messaging page has not been QA'd end-to-end in this session.
- Network page has not been QA'd in this session.
- Availability calendar, package builder, portfolio upload — not QA'd in this session.
- Creator registration full flow (new signup, 5-step form, `canPublish` gate, Supabase listing creation) — not QA'd.
- Client verification flow — not QA'd.
- Stripe Connect onboarding for a new creator account — not QA'd.
- Rate calculator — not QA'd.
- Referral rewards logic — code exists, not QA'd.
- `creatormatch.studio` does not redirect to `creatorbridge.studio` — this is a known outstanding item from before this session.
- Turnstile captcha: `VITE_TURNSTILE_SITE_KEY` is not in the local `.env`. Acceptable only if set in Vercel. Needs confirmation.
- Admin control hub is a read-only stub with no real functionality.

### What Changed Since the Last Codex Handoff
This section covers changes made in the Cowork session on 2026-05-20 that Codex has not yet seen:

1. **`stripe-webhook` deployed to v17** — permanent fix for project status after retainer payment. Now correctly sets `status = 'retainer_paid'` (previously was setting `status = 'active'` on the deployed version, though local source was correct). The v17 source now matches the correct local source.
2. **`test-topup` edge function deployed to v2** — redeployed with CORS headers so it can be called from the browser during QA.
3. **`src/App.jsx`** — nav role-gating added, avatar made clickable with role-based routing.
4. **`src/components/SupportChatbot.jsx`** — chatbot error handling improved: errors now logged to console with `[Chatbot]` prefix instead of silently falling back.
5. **Three RLS fix migrations applied** (see Section 4) — resolved infinite recursion in `profiles` table policies.
6. **Commit `832fbf4`** pushed to `main` — Vercel auto-deployed.
7. **`supabase/functions/stripe-webhook/index.ts` and `supabase/functions/release-payment/index.ts`** — these local files are modified but NOT committed. The deployed versions (v17 and v16) are the correct live state, but git does not track them. See Section 10.

---

## 2. Payment / Checkout Status

### Payment Flow (Confirmed Live)
The complete Stripe payment cycle was tested end-to-end on 2026-05-20 to 2026-05-21:

```
Client creates project → Creator applies → Client accepts application
→ Client pays retainer via Stripe (50% + 5% client fee)
→ stripe-webhook fires: payment_intent.succeeded (paymentType=retainer)
→ transactions.retainer_status = 'paid'
→ projects.status = 'retainer_paid'
→ Creator submits delivery
→ Client approves delivery
→ Client pays final balance via Stripe (50% + 5% client fee)
→ stripe-webhook fires: payment_intent.succeeded (paymentType=final)
→ transactions.final_status = 'paid'
→ markProjectCompleted: projects.status = 'final_paid', approved_at set
→ releaseCreatorPayout: Stripe transfer created to creator Express account
→ transactions.final_status = 'released', final_transfer_id populated
```

**Money math for a $1,000 project (Launch tier creator):**
- Client pays retainer: $1,000 × 50% = $500 + 5% client fee = $525
- Client pays final: $500 + 5% client fee = $525
- Creator receives: $500 − 10% (Launch tier fee) = $450 on the final transfer
- Platform retains: $50 creator fee + $25 client fee per payment = $100 total
- `project_amount` stored in cents: 100000 (= $1,000)
- `creator_fee_amount` in cents: 10000 (= $100 for Launch tier)

### Stripe Connect Status
- Connect type: Express
- Creator test account: `acct_1TYwLCRJtjbSy0AN`
- `stripe_onboarded: true`, `payouts_enabled: true`, `charges_enabled` should be true
- Platform Stripe mode: **TEST**. Real/live Stripe keys are not active.

### Verified Transaction Record
```
Transaction ID:    be165cd8-5738-406b-9e1a-6fdb6ab9ab51
Project ID:        941a309f-aaa2-4653-8811-d4deea235248
Project title:     E2E QA Test — Brand Video Series
retainer_status:   paid
retainer_PI:       pi_3TZP6BIeWupwRQNU0S6UXFiX
final_status:      released
final_PI:          pi_3TZPCFIeWupwRQNU1FFYMd6P
final_transfer_id: tr_1TZPCTIeWupwRQNUsZeu0NjG
final_paid_at:     2026-05-21 05:31:17 UTC
final_released_at: 2026-05-21 05:31:18 UTC
project_status:    final_paid
creator_tier:      launch
```

### Orphaned Transactions (Need Cleanup)
```
Transaction ID: 4d278d89-3a7f-47bb-9ffb-3a85b2f27e07
Project:        E2E Purchase Cycle Test — Brand Video
final_status:   paid      ← charged but no transfer created
final_transfer_id: NULL   ← PROBLEM
project_status: final_paid

Transaction ID: 38e19b23-f476-49f6-89a0-81a12aa9e9ff
Project:        QA budgeted checkout brand video
final_status:   paid      ← charged but no transfer created
final_transfer_id: NULL   ← PROBLEM
project_status: final_paid
```
These were created in earlier QA sessions when `stripe-webhook` was on an older version without the `releaseCreatorPayout` call wired to the `final` payment type. The clients were charged, the creator was never paid. In test mode this is harmless, but it should be addressed before going live.

### Stripe Test Card Behavior
- `4242 4242 4242 4242` — standard test card. Works in the Stripe Elements UI. Creates a PaymentIntent that goes to `requires_payment_method` then `succeeded`. Standard QA card.
- `tok_visa` — Stripe tokenized test card for programmatic confirmation without the UI. Used for automated QA: `stripe.confirmCardPayment(clientSecret, { payment_method: { card: { token: 'tok_visa' } } })`.
- Stripe test mode: new charges appear as "pending" balance, not available balance. Use the `test-topup` edge function to add available test balance if a transfer fails with "insufficient available balance".

### Webhook Events Handled in stripe-webhook v17
- `payment_intent.succeeded` — handles both `retainer` and `final` paymentTypes
- `payment_intent.payment_failed` — logs the failure to `payment_events`
- `account.updated` — syncs `stripe_onboarded` / `payouts_enabled` to `creator_listings`
- `transfer.created` — logs the transfer to `payment_events`

### Remaining Payment Risks / Edge Cases
1. **`release-payment` is not JWT-protected** — see Section 9.
2. **Duplicate retainer on checkout** — if a user navigates to `/checkout/:projectId` without `?payment=final`, they will be charged the retainer again. The checkout page must read payment type from the URL param.
3. **`project_amount` is server-set but `creator_fee_amount` may still be calculated client-side** — needs audit of `create-payment-intent` to confirm fee percentages come from the database tier, not browser-provided values.
4. **Referral reward (7% fee reduction) is wired in code but untested** — `next_project_fee_pct` field exists on `creator_listings`. Verify it is consumed correctly in `create-payment-intent` before live launch.
5. **`first_booking_fee_waived` / `next_booking_fee_waived` client fee logic** — the `consumeClientFeeWaiver` function in `stripe-webhook` looks correct but has not been tested with a real waiver in place.

---

## 3. Test Accounts and Credentials

**IMPORTANT: These are test-only accounts on a test-mode Stripe project. Safe for Codex to use, create records against, and test with.**

### Creator Test Account
| Field | Value |
|-------|-------|
| Email | `drl33+creator@creatorbridge.studio` |
| Password | `CB-Creator-K7mQ92rV!26` |
| Role | `creator` |
| Display name | Marcus Reed / Copper Line Media |
| Supabase user ID | `0a638e1d-9ad3-41b8-8cfd-db08141cd355` |
| Creator listing ID | `ff6c1f99-4ca0-41a9-9861-39ce4e993924` |
| Stripe Express account | `acct_1TYwLCRJtjbSy0AN` |
| Stripe onboarded | `true` |
| Payouts enabled | `true` |
| Tier | `launch` (0 completed projects toward tier, test transactions not counted) |
| Profile data | 3 services, 3 portfolio items, 2 packages — seeded in Supabase |
| Safe for Codex | Yes — create/edit/delete test records freely |

### Client Test Account
| Field | Value |
|-------|-------|
| Email | `drl33+client@creatorbridge.studio` |
| Password | `CB-Client-L8pN43sX!26` |
| Role | `client` |
| Display name | Avery Thompson / Sonoran Launch Group |
| Supabase user ID | `8ccbe8c7-0a9d-4be2-a3e0-e7be42c4a1cf` |
| Stripe customer | No saved customer ID — each payment creates a new PI |
| Profile data | `client_profiles` row exists with basic data |
| Safe for Codex | Yes — create/edit/delete test records freely |

### Admin Access
There is no dedicated admin test account. Admin access requires `profiles.role = 'admin'`. To test the `/admin` route, manually set an existing user's role to `admin` via SQL. The admin hub is currently a stub — it shows platform stats and a dispute queue UI but has no real write actions. Safe to inspect, nothing destructive.

---

## 4. Backend / Supabase Changes

### Migrations Applied (Full List, Newest First)
| Version | Name | Purpose |
|---------|------|---------|
| 20260520191419 | drop_duplicate_weak_rls_policies | Removed old permissive overlapping policies |
| 20260520190832 | add_missing_creator_rls_policies | Fixed creator listings SELECT policy gap |
| 20260520055544 | fix_rls_infinite_recursion | Removed self-referencing subquery in profiles RLS |
| 20260519123000 | require_creator_payout_before_project_acceptance | DB constraint: creator must have stripe_account_id before acceptance |
| 20260519120000 | harden_project_budget_checkout | Adds minimum_budget enforcement, budget validation |
| 20260517112238 | harden_network_page_flow | RPC `send_connection_request` — validates auth, prevents self-connection, enforces limits |
| 20260517101522 | harden_availability_calendar_flow | RPC `upsert_creator_availability` — verifies listing ownership |
| 20260516235356 | admin_control_hub_foundation | Creates `admin_audit_log`, `platform_settings` tables (admin-only RLS) |
| 20260516170242 | secure_message_send_flow | RPC `send_creatorbridge_message` — auth required, contact-info blocking at DB layer |
| 20260516143200 | secure_quote_booking_flow | RPCs `submit_quote_request`, `create_project_brief` — server-validated inserts |
| 20260516113000 | secure_project_application_flow | RPCs `apply_to_project`, `accept_project_application` — atomic, auth-checked |
| 20260516104000 | add_quote_request_read_receipts | Adds `quote_requests.read` column + RPC `mark_quote_request_read` |
| 20260516102000 | add_message_read_receipts | Adds read-state columns + RPC `mark_conversation_messages_read` |
| 20260515202000 | add_portfolio_item_media | Adds media columns to `portfolio_items` |
| 20260514115348 | secure_storage_foundation | Creates private storage buckets with RLS |
| 20260514094138 | tighten_marketplace_rls | Removed broad/permissive RLS policies across core tables |
| 20260514090847 | secure_stripe_payment_flow | Transactions RLS hardening, payment event policies |
| 20260509172236 | client_profile_personalization | Adds `avatar_url`, `website`, `bio` to `client_profiles` |
| 20260508130000 | prelaunch_platform_hardening | Initial comprehensive schema and RLS baseline |

### Edge Functions (All ACTIVE)
| Slug | Version | verify_jwt | Notes |
|------|---------|-----------|-------|
| `stripe-webhook` | 17 | false | Uses Stripe signature validation instead of JWT |
| `release-payment` | 16 | **false** | ⚠️ Security risk — should be JWT-protected |
| `create-payment-intent` | 14 | true | |
| `create-connect-account` | 15 | true | |
| `check-connect-status` | 13 | true | |
| `create-storage-signed-url` | 6 | true | |
| `chatbot` | 3 | true | |
| `test-topup` | 2 | false | QA only — protected by `x-job-secret: qa-topup-2026` header |

### Supabase Secrets Set (Names Only — No Values)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` (auto-provided)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided)
- `ANTHROPIC_API_KEY`

**Note:** The root `.env` file in the project directory contains Stripe secret key names for local edge function development. These must NOT be present in a live/production `.env`. All real secret values are in Supabase Edge Function Secrets and Vercel environment variables.

### Tables Affected by Recent Migrations
`profiles`, `creator_listings`, `creator_services`, `portfolio_items`, `creator_availability`, `packages`, `projects`, `project_applications`, `transactions`, `payment_events`, `quote_requests`, `messages`, `network_posts`, `state_chat_messages`, `connection_requests`, `client_profiles`, `client_reviews`, `disputes`, `referrals`, `admin_audit_log`, `platform_settings`

### RPCs Added
- `apply_to_project(p_project_id uuid, p_listing_id uuid, p_proposal_text text, p_proposed_rate numeric)`
- `accept_project_application(p_project_id uuid, p_application_id uuid)`
- `submit_quote_request(...)` — full quote/project creation
- `create_project_brief(...)` — project board posting
- `send_creatorbridge_message(p_conversation_id text, p_recipient_id uuid, p_body text)`
- `mark_conversation_messages_read(p_conversation_id text)`
- `mark_quote_request_read(p_quote_id uuid)`
- `upsert_creator_availability(p_listing_id uuid, p_availability jsonb)`
- `send_connection_request(p_target_user_id uuid)`

### Commands Run This Session
```bash
supabase functions deploy stripe-webhook --project-ref mxizhszqhbhxzkkhgnmg --no-verify-jwt
supabase functions deploy test-topup --project-ref mxizhszqhbhxzkkhgnmg --no-verify-jwt
# Earlier sessions:
supabase db push --project-ref mxizhszqhbhxzkkhgnmg
supabase functions deploy chatbot --project-ref mxizhszqhbhxzkkhgnmg
```

### Supabase Errors Encountered and Resolution Status
| Error | Resolution |
|-------|-----------|
| RLS infinite recursion on `profiles` table — policies had a subquery that read `profiles` inside a `profiles` policy | Fixed by migration `fix_rls_infinite_recursion` (20260520055544) |
| `operator does not exist: uuid = text` on JOIN between `projects.id` and `transactions.project_id` | Workaround: use `p.id::text = t.project_id::text` in raw SQL. Root cause: `transactions.project_id` is text type, `projects.id` is uuid. Not fixed at schema level yet. |
| `Database error querying schema` on login — caused by NULL in `confirmation_token` Auth column | Fixed by setting nullable Auth text fields to empty strings via Supabase Auth admin API |

---

## 5. Stripe / Payment Infrastructure

### Mode
**TEST mode only.** No live Stripe keys are active. All charges, transfers, and Connect accounts are in Stripe test environment.

### Connect Account Type
Express. Creator onboarding uses `create-connect-account` edge function which calls `stripe.accounts.create({ type: 'express' })`.

### Webhook
- **Endpoint URL:** `https://mxizhszqhbhxzkkhgnmg.supabase.co/functions/v1/stripe-webhook`
- **Stripe dashboard endpoint name:** "captivating-oasis" (Lee's Stripe account)
- **Secret stored as:** `STRIPE_WEBHOOK_SECRET` in Supabase Edge Function Secrets
- **Events configured:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `transfer.created`
- **Webhook version deployed:** v17
- **Idempotency:** Webhook checks `payment_events.stripe_event_id` before processing — duplicate events are safely ignored

### Stripe Errors Encountered
| Error | Resolution |
|-------|-----------|
| "Insufficient available balance" on transfer | Fixed by calling `test-topup` edge function to add $2,000 test balance (`tu_1TZP6gIeWupwRQNUzV2Lx6yH`). Normal in test mode — pending balance ≠ available balance. |
| Stripe iframe cross-origin access blocked | Cannot interact with Stripe Elements iframes programmatically. Workaround: call `create-payment-intent` directly from browser fetch, get `clientSecret`, then call `stripe.confirmCardPayment` with `tok_visa` token. |

### Remaining Stripe Dashboard Setup Needed
- Enable leaked password protection in Supabase Auth dashboard (currently disabled — security advisor flag).
- Configure webhook to send additional events if needed (e.g., `payout.paid`, `dispute.created`).
- When switching to live mode: replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Supabase secrets and create a new live webhook endpoint. No code changes should be required.

---

## 6. Frontend Changes

### Files Changed This Session
| File | Change |
|------|--------|
| `src/App.jsx` | Nav role-gating: creators see dashboard icon → `/dashboard`, clients see user icon → `/client`. Avatar made clickable with role-based routing. Avatar shows `authProfile.avatar_url` if set, else first initial. |
| `src/components/SupportChatbot.jsx` | `sendToAnthropic` now logs errors to console with `[Chatbot]` prefix. Returns `null` on failure. `handleSend` handles null with console warning instead of silent fallback. |

### Commit: `832fbf4` — "Role-gated nav, clickable avatar, chatbot error logging"
Both files changed, 68 insertions, 37 deletions. Pushed to `main`, auto-deployed to Vercel.

### Known Stale Cache / Vercel Deploy Concerns
- `supabase/functions/stripe-webhook/index.ts` and `supabase/functions/release-payment/index.ts` are modified locally but NOT committed. The deployed edge function versions (v17 and v16) are correct. Codex should NOT commit these local modifications as-is without first verifying they match the deployed source exactly.
- Untracked files that should not be committed: `.agents/`, `creatorbridge-new-assets/`, `creatorbridge-ui-overview.html`, `public/images/creatorbridge/client-command-center-alt.jpg`, `skills-lock.json`, `supabase/.gitignore`, `supabase/config.toml`, `video/`
- `vercel.json` sets no-cache headers for `sw.js`, `manifest.json`, and HTML. PWA service worker is versioned and should force-refresh on deploy.

### Routes
All existing routes intact. The `/admin` route (`AdminDashboard.jsx`) is protected to admin-role users. Nav items are role-gated as of commit `832fbf4`.

---

## 7. Chatbot Changes

### Files Changed
`src/components/SupportChatbot.jsx` — error logging improvement only. No behavior changes.

### Architecture
The chatbot has two layers:
1. **Supabase Edge Function (`chatbot` v3):** Receives the conversation history from the frontend, calls Anthropic API (`claude-haiku-4-5-20251001`, `max_tokens: 350`), returns the AI response.
2. **Frontend (`SupportChatbot.jsx`):** Maintains chat state, detects booking/quote intent from 51 phrases, runs multi-step booking and quote assistant flows locally, submits completed bookings to Supabase via RPC.

### What the Chatbot Answers
- General platform questions (how CreatorBridge works, pricing, categories, etc.)
- Booking assistant: 6-step flow for clients to submit a project brief
- Quote assistant: 6-step flow for creators to build a project quote
- Routes booking submissions through `submit_quote_request` RPC

### What the Chatbot Should NOT Answer
- It is configured via system prompt to refuse to provide contact information for creators outside of a confirmed booking. The DB-level message filter (`send_creatorbridge_message` RPC) also blocks contact details at the database layer.
- It should not attempt to create bookings or quotes on behalf of unauthenticated users without prompting login first.

### API Status
- Model: `claude-haiku-4-5-20251001`
- Anthropic account balance as of 2026-05-20: ~$9.50 (Lee added $10; previous balance was −$0.50)
- Rate limit: 40 requests per 60 seconds
- Cost per message: ~$0.002. $9.50 covers ~4,500–5,000 responses.
- **Lee does not want auto-recharge.** When balance runs low, Lee must manually add credits at console.anthropic.com/settings/billing.

### Failure Behavior
If Anthropic API call fails, `sendToAnthropic` returns `null`. `handleSend` logs a console warning and the chat shows a fallback message. Errors are now visible in browser DevTools under `[Chatbot]` prefix. Previously errors were swallowed silently.

### Chatbot Positioning
Uses pure inline CSS `position: fixed; bottom: 24px; right: 24px`. Do NOT convert to Tailwind utility classes — previous attempts caused Tailwind to override the position.

---

## 8. QA Performed This Session

### Browser Used
Claude in Chrome (via MCP tool). Chromium-based, standard viewport.

### Creator Account Tests Completed
- Logged in as `drl33+creator@creatorbridge.studio` ✓
- Applied to a project brief via project board ✓
- Submitted delivery after project moved to `retainer_paid` ✓

### Client Account Tests Completed
- Logged in as `drl33+client@creatorbridge.studio` ✓
- Created a new project brief via project board ✓
- Accepted creator application ✓
- Paid retainer via Stripe (`tok_visa` programmatic confirmation) ✓
- Approved delivery and paid final balance (`tok_visa`) ✓

### Payment Tests Completed
- Retainer payment confirmed: `pi_3TZP6BIeWupwRQNU0S6UXFiX` → `succeeded` ✓
- Final payment confirmed: `pi_3TZPCFIeWupwRQNU1FFYMd6P` → `succeeded` ✓
- Webhook processing verified: `final_transfer_id = tr_1TZPCTIeWupwRQNUsZeu0NjG` ✓
- `project_status = final_paid` confirmed in DB ✓

### What Still Needs Browser QA
- Creator registration (full 5-step form with new account)
- Creator Stripe Connect onboarding (new account from scratch)
- Creator dashboard: availability, packages, portfolio, earnings
- Messaging page end-to-end (send message, read receipt, contact filter)
- Network page: post, reply, like, state chat
- Client profile: avatar upload, bio, website
- Rate calculator
- Referral flow end-to-end
- Mobile/responsive layout
- Chatbot on mobile (should not auto-open)
- PWA install and cached icon refresh
- `creatormatch.studio` redirect

---

## 9. Known Issues and Warnings

### Critical
1. **`release-payment` (v16) has `verify_jwt: false`** — This function calls `stripe.transfers.create()`. Any caller with the Supabase function URL and a valid `transactionId` can trigger it. The function does verify that `retainer_status = 'paid'` and `final_status = 'paid'` before transferring, which limits the blast radius. But this should be fixed before live launch. Recommended fix: add JWT verification and check that the calling user is the client on the transaction. Set `verify_jwt: true` and redeploy.

2. **Two orphaned transactions with `final_transfer_id = NULL`:**
   - `4d278d89-3a7f-47bb-9ffb-3a85b2f27e07` — `final_status = 'paid'`, no transfer
   - `38e19b23-f476-49f6-89a0-81a12aa9e9ff` — `final_status = 'paid'`, no transfer
   These were charged in test mode. In production these would mean the creator was never paid. Recommend: write a one-time backfill script that calls `stripe.transfers.create()` for transactions with `final_status = 'paid'` and `final_transfer_id IS NULL` and `retainer_status = 'paid'`. Run in test mode first to verify, then apply equivalent logic if this ever happens in live mode.

### Medium Risk
3. **`projects.id` is UUID, `transactions.project_id` is TEXT** — All joins between these two tables require explicit `::text` casts. This is a schema inconsistency that should be fixed in a migration (either cast `project_id` to UUID or add a generated column). Until fixed, any raw SQL join without the cast will throw `operator does not exist: uuid = text`.

4. **Local edge function source is ahead of git** — `supabase/functions/stripe-webhook/index.ts` and `supabase/functions/release-payment/index.ts` are modified locally but not committed. The live deployed versions are correct. Before Codex commits any edge function changes, run a diff between local source and the deployed version to ensure no regressions.

5. **`VITE_TURNSTILE_SITE_KEY` missing from local `.env`** — The platform includes Cloudflare Turnstile bot protection in auth and quote flows. This key is expected in Vercel environment variables. If it is not set in Vercel, bot protection silently degrades. Verify in Vercel dashboard before launch.

6. **`creatormatch.studio` does not redirect to `creatorbridge.studio`** — Outstanding item. Low urgency but should be done before any marketing launch.

### Low Risk / Fragile Areas
7. **`SupportChatbot.jsx` is dense and fragile** — Contains animated Bridge avatar, `ThinkingAvatar`, 51-phrase intent detection, booking assistant, quote assistant, draft saving, auth modal dispatch, and Supabase submission. Do not restructure unless doing a dedicated chatbot audit. Chatbot positioning uses inline styles — do not convert to Tailwind.

8. **`src/components/CreatorDirectory.jsx`** — Contains the 13-condition `canPublish` gate, rotating preview creators, and homepage/directory hybrid. A visual change to the homepage will touch this file. Do not simplify the `canPublish` conditions.

9. **`src/components/auth/AuthModal.jsx`** — Contains TOS modal bug fix and creator redirect. Treat as fragile. Do not restructure event handling unless auth is broken.

10. **React controlled inputs cannot be updated with `.value =`** — Stripe card fields and React form inputs use synthetic events. To set a value programmatically: use `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` then dispatch `new Event('input', { bubbles: true })`. Standard DOM assignment or `form_input` tool alone will not update React state.

11. **Stripe test mode: pending vs. available balance** — In test mode, charges land as "pending" balance, not "available" balance. If a transfer fails with "insufficient available balance", use the `test-topup` edge function (POST to `https://mxizhszqhbhxzkkhgnmg.supabase.co/functions/v1/test-topup` with header `x-job-secret: qa-topup-2026` and body `{ "amount": 200000 }`).

### Console Errors (Not Verified This Session)
The following are expected to be present in browser console and are not blocking:
- Large bundle warning in `npm run build` was fixed in a previous session. If it reappears, check `vite.config.js` for the vendor chunk split config.
- Supabase realtime subscription warnings on the network page are expected when no state chat messages exist yet.

---

## 10. Git Status

### Current Branch
`main`

### Latest 10 Commits
```
832fbf4 Role-gated nav, clickable avatar, chatbot error logging
5e7716b Upgrade chatbot: real AI, personality, subtle nudge popup, suppress on reset-password
d27f7f0 Add reset password page and route
33d6629 Add forgot password flow to auth modal
8b05194 Harden Stripe onboarding flow
967ad69 Harden project checkout and payout readiness
dcd78dc Harden network page and refresh mobile app icon
88ac00b Harden availability and calendar sync
6f146d2 Add secure checkout lock and read-only admin hub
415d85c Harden chatbot and refresh mobile app icon
```

### Git Status (Short)
```
 M .DS_Store
 M supabase/.temp/cli-latest
 M supabase/.temp/gotrue-version
 M supabase/.temp/linked-project.json
 M supabase/.temp/storage-version
 M supabase/functions/release-payment/index.ts    ← NOT committed
 M supabase/functions/stripe-webhook/index.ts     ← NOT committed
?? .agents/
?? creatorbridge-new-assets/
?? creatorbridge-ui-overview.html
?? public/images/creatorbridge/client-command-center-alt.jpg
?? skills-lock.json
?? supabase/.gitignore
?? supabase/config.toml
?? video/
```

### Everything Pushed?
The two JavaScript files — `src/App.jsx` and `src/components/SupportChatbot.jsx` — are committed and pushed in commit `832fbf4`. Everything important for the frontend is live.

The edge function source files (`supabase/functions/stripe-webhook/index.ts` and `supabase/functions/release-payment/index.ts`) are modified locally but NOT committed. The live deployed versions (v17 and v16) are the correct state. Codex should treat the deployed versions as canonical and commit the local source only after verifying they match.

### Files to Not Touch
- `supabase/.temp/` — auto-generated by Supabase CLI, never commit
- `.DS_Store` — never commit
- `creatorbridge-new-assets/` — raw AI-generated image assets, large files, not needed in git
- `video/` — raw video files, never commit
- `skills-lock.json` — Cowork plugin file, not project source

---

## 11. Supabase / Vercel Status

### Migrations (19 Applied)
```
20260508130000  prelaunch_platform_hardening
20260509172236  client_profile_personalization
20260514090847  secure_stripe_payment_flow
20260514094138  tighten_marketplace_rls
20260514115348  secure_storage_foundation
20260515202000  add_portfolio_item_media
20260516102000  add_message_read_receipts
20260516104000  add_quote_request_read_receipts
20260516113000  secure_project_application_flow
20260516143200  secure_quote_booking_flow
20260516170242  secure_message_send_flow
20260516235356  admin_control_hub_foundation
20260517101522  harden_availability_calendar_flow
20260517112238  harden_network_page_flow
20260519120000  harden_project_budget_checkout
20260519123000  require_creator_payout_before_project_acceptance
20260520055544  fix_rls_infinite_recursion
20260520190832  add_missing_creator_rls_policies
20260520191419  drop_duplicate_weak_rls_policies
```

### Edge Functions (All ACTIVE)
```
stripe-webhook           v17   verify_jwt=false
release-payment          v16   verify_jwt=false  ← SECURITY CONCERN
create-payment-intent    v14   verify_jwt=true
create-connect-account   v15   verify_jwt=true
check-connect-status     v13   verify_jwt=true
create-storage-signed-url v6   verify_jwt=true
chatbot                  v3    verify_jwt=true
test-topup               v2    verify_jwt=false  ← QA ONLY
```

### Vercel
- Project: `creator-bridge`
- Repo: `nulalee2002/CreatorMatch`
- Branch: `main` (auto-deploys on push)
- Latest deploy triggered by commit `832fbf4`
- Production URL: https://www.creatorbridge.studio
- Framework: Vite/React
- `vercel.json` sets no-cache headers for HTML, `sw.js`, `manifest.json`

---

## 12. Recommended Next Steps for Codex (Priority Order)

1. **[Security — high priority] Fix `release-payment` JWT validation.** Change `verify_jwt` to `true` in the edge function, add auth header parsing, and verify the calling user matches `transactions.client_id` before allowing the transfer. Redeploy as v17. This is the biggest security gap before live launch.

2. **[Data cleanup] Backfill orphaned transactions.** For `4d278d89` and `38e19b23`, either run `releaseCreatorPayout` logic manually (or via a one-off script) to create the missing Stripe transfers, or mark them as `final_status = 'abandoned'` with a note. Do this in test mode — real money is not involved.

3. **[Schema] Fix `transactions.project_id` type mismatch.** Write a migration to `ALTER TABLE transactions ALTER COLUMN project_id TYPE uuid USING project_id::uuid`. Then remove all `::text` casts from join queries. Verify no existing data would fail the cast first.

4. **[QA — browser] Full creator registration flow.** Log in with a fresh non-test account or use `drl33+creator` and simulate the 5-step form. Verify the `canPublish` gate, Supabase listing creation, portfolio minimum, intro video requirement, and pending review state.

5. **[QA — browser] Messaging end-to-end.** Log in as both client and creator. Send a message. Verify read receipts update. Attempt to send a phone number in a message — it should be blocked by the `send_creatorbridge_message` RPC.

6. **[QA — browser] Availability, packages, and portfolio.** Log in as creator. Save availability calendar. Build a package. Upload or link a portfolio item. Verify persistence via Supabase (not just localStorage).

7. **[QA — browser] Network page.** Create a post, reply, like. Try the state chat. Verify connection requests.

8. **[Security] Audit `test-topup` access.** Before live launch, either delete this function or add IP/origin restrictions. The `x-job-secret` header is adequate for test mode but is not production-safe.

9. **[Infrastructure] Verify `VITE_TURNSTILE_SITE_KEY` in Vercel.** Log in to Vercel dashboard and confirm `VITE_TURNSTILE_SITE_KEY` is set. If missing, add it. Without it, bot protection silently degrades on auth and quote forms.

10. **[Infrastructure] Set up `creatormatch.studio` redirect to `creatorbridge.studio`.** Add a Vercel redirect rule or DNS CNAME forward.

11. **[QA — browser] Stripe Connect onboarding for a new creator.** Create a new test creator account, go through the Stripe Connect Express onboarding flow, verify `stripe_onboarded` and `payouts_enabled` flip to `true` in `creator_listings` via the `account.updated` webhook.

12. **[Monitoring] Enable leaked password protection** in Supabase Auth dashboard (Settings → Auth → Security). Currently flagged by Supabase security advisor.

---

## 13. File-Change Index

| File Path | Change Summary | Risk | Codex Review | Reason |
|-----------|---------------|------|-------------|--------|
| `src/App.jsx` | Nav role-gating, clickable avatar with role routing | Low | Yes | Simple conditional nav — verify no role edge cases (e.g., user with no role set) |
| `src/components/SupportChatbot.jsx` | Error logging only — no behavior changes | Low | No | Cosmetic improvement, no logic change |
| `supabase/functions/stripe-webhook/index.ts` | v17: `retainer_paid` status fix, `releaseCreatorPayout` on final payment — **LOCAL ONLY, NOT COMMITTED** | High | Yes | Deployed source differs from git. Codex must diff and commit the deployed state. |
| `supabase/functions/release-payment/index.ts` | v16: idempotency key change — **LOCAL ONLY, NOT COMMITTED** | High | Yes | Deployed source differs from git. Same action needed. |
| `supabase/migrations/20260520055544_fix_rls_infinite_recursion.sql` | RLS fix — removes self-referencing subquery in profiles policies | Medium | Yes | Verify profiles RLS is correct after fix |
| `supabase/migrations/20260520190832_add_missing_creator_rls_policies.sql` | Adds missing creator listings SELECT policy | Medium | Yes | Verify creators can read their own listings |
| `supabase/migrations/20260520191419_drop_duplicate_weak_rls_policies.sql` | Removes old weak policies | Medium | Yes | Verify no required access was accidentally removed |
| `supabase/migrations/20260519120000_harden_project_budget_checkout.sql` | Budget minimum enforcement | Low | No | Straightforward constraint |
| `supabase/migrations/20260519123000_require_creator_payout_before_project_acceptance.sql` | Stripe account required before acceptance | Low | No | Protects against no-payout-method acceptance |
| `Codex memory.md` | Updated with all session findings | Low | No | Memory file for AI agents |

---

*Report generated: 2026-05-20. Prepared from live Supabase data, git log, and edge function registry. Do not expose Stripe secret key values, Supabase service role key, webhook secret, or Anthropic API key in any commit, log, or file.*
