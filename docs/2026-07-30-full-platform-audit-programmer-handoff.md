# CreatorBridge Full Platform Audit and Programmer Handoff

**Report date:** July 30, 2026

**Repository:** `content-pricing-calc`

**Production site:** `https://creatorbridge.studio` and `https://www.creatorbridge.studio`

**Audited production commit:** `304f948` (`fix: close full-platform audit gaps`)

**Vercel production deployment:** `dpl_DKEt9DtbM1CpaRnojexbgSC2BW7o`
**Audit method:** Fable Mode, static code review, automated tests, live Supabase verification scripts, Stripe test-mode payment E2E, production build, and real-browser desktop/mobile testing.

## 1. Executive conclusion

CreatorBridge is not a prototype shell. The repository contains a substantial production platform covering creator onboarding, client onboarding, verified identity, creator discovery, project briefs, proposals, generated contracts, signatures, Stripe payments, change orders, Zoom-powered calls, messaging, a closed creator network, creator-to-creator hiring, support, and protected administration.

The completed audit fixed the code defects that could be safely reproduced and corrected in the repository. The final automated and browser checks passed, and the corrected build was deployed to production. There are no known unresolved compile failures, broken audited routes, moderate-or-higher dependency advisories, or known active database-permission leaks in the areas covered by the verification suite.

The platform is **not yet fully launch-proven with real people and live provider transactions**. The remaining work is mostly provider acceptance testing, human usability testing, operational configuration review, and one important identity-architecture decision: the current code can manually restrict a confirmed duplicate account, but it does not itself perform an automatic biometric one-to-many search across every existing CreatorBridge member.

This report supersedes older launch documents where they conflict with the current code. In particular:

- `attorney_review_required` has been removed from active code and is not a platform blocker.
- The contract lifecycle is generated and enforced by the platform.
- Phone and identity trust gates now apply to protected creator and client actions.
- Change orders and project documentation were added after several older readiness documents were written.
- The full browser audit described below is complete, although real-provider acceptance tests remain.

## 2. Locked product decisions reflected in the code

The intended project lifecycle is:

`accepted proposal → generated contract → both signatures → 50% retainer → Zoom kickoff call → agreed call summary → change order only when material terms change → additional payment when applicable → production begins or continues`

The implementation is designed around these rules:

1. CreatorBridge generates the original production agreement from trusted project and proposal data.
2. Both the client and creator sign the same hash-bound agreement.
3. A retainer cannot be created without a countersigned agreement.
4. Video calls unlock after the retainer is paid and a countersigned agreement exists.
5. An agreed call summary can support a later change order, but ordinary conversation does not silently rewrite the agreement.
6. Material changes use a separate generated, signed, and stored change order.
7. Positive price changes use an additional 50/50 payment path.
8. Refunds, credits, and price reductions route through support rather than being silently self-served.
9. Both project parties must have verified phone and identity status for protected contract/project actions.
10. Successful identity verification does not expire every year. Reverification is triggered only by defined security or identity events.
11. Identity verification receives a dedicated consent screen immediately before Stripe Identity opens.
12. Creators and clients use Twilio phone verification.
13. `attorney_review_required` is not present in active code and must not be reintroduced as a blocker.

Primary design references:

- `docs/superpowers/specs/2026-07-29-contract-call-change-order-design.md`
- `docs/superpowers/plans/2026-07-29-contract-change-orders-project-protection.md`
- `docs/superpowers/specs/2026-07-29-human-identity-duplicate-prevention-design.md`
- `docs/superpowers/plans/2026-07-29-human-identity-duplicate-prevention.md`
- `docs/2026-06-30-codex-contract-esign-rebook-spec.md`
- `docs/2026-06-30-codex-video-calls-spec.md`

## 3. Audit scope and proof

### 3.1 Automated verification completed

The final audit observed these checks passing:

| Verification | Result |
|---|---:|
| Focused Node test suite | 28 passed, 0 failed |
| Platform static/behavior audit | 265 checks passed |
| Launch sweep | 19 sections passed |
| Production build | Passed |
| Dependency advisory audit | 0 vulnerabilities from the available offline advisory data |
| Creator onboarding live verifier | Passed with rollback and cleanup |
| Human identity live foundation verifier | Passed |
| Change-order live verifier | Passed |
| Network portfolio-sharing live verifier | Passed |
| Messaging verifier | Passed |
| Project lifecycle/dispute verifier | Passed |
| Combined workflow smoke | Passed |
| Stripe booking E2E in test mode | Passed |
| Support screenshot cleanup verifier | Passed |
| Active `attorney_review_required` scan | No active-code matches |
| Client-source secret scan | No server secrets referenced in `src` or `public` |

Primary commands:

```bash
node --test tests/*.test.js
npm run audit:platform
npm run audit:env
npm run verify:launch-sweep
npm run verify:workflow-smoke
npm run verify:creator-onboarding-live
npm run verify:human-identity-live
npm run verify:change-orders-live
npm run verify:network-portfolio-sharing-live
npm run verify:booking-e2e
npm run verify:support-cleanup-live
npm audit --offline --audit-level=moderate
npm run build
```

### 3.2 Browser verification completed

The browser audit covered 32 public/error/auth-gated routes at desktop size and an iPhone 13 profile. It checked:

- document titles;
- primary headings;
- horizontal overflow;
- broken images;
- mobile touch targets;
- invalid route tails;
- settled loading states;
- console errors;
- public, authenticated client, authenticated creator, and authenticated administrator views.

Authenticated role coverage included:

- client dashboard, projects, messages, network, creator hiring, identity return, invalid checkout, and admin denial;
- creator dashboard, projects, messages, network, Build Your Team, creator-as-hirer client desk, calculator, and invalid routes;
- administrator dashboard, support, operations, finance, analytics, projects, messages, and network.

The production retest confirmed:

- `/checkout/not-a-valid-id` renders `Project not found` as its single page heading;
- malformed checkout IDs no longer generate a Supabase 400 request;
- `/dashboard/build-team` has one page-level heading and no duplicated directory hero;
- audited mobile pages have no horizontal overflow or broken images;
- the settled production client dashboard renders correctly;
- no new CreatorBridge console errors were recorded on the corrected production routes.

The calculator interaction was also exercised. Changing the primary pillar from Photography to Video Production and selecting Brand Films recalculated the live quote from `$4,865` to `$4,851`.

## 4. Findings and fixes completed

### 4.1 Critical and high-risk findings

| Finding | Impact before correction | Correction | Primary code |
|---|---|---|---|
| Privileged database helper functions inherited overly broad `PUBLIC` execution | Anonymous or unrelated callers could potentially probe project/application helpers | Revoked `PUBLIC`/anonymous execution, bound caller-sensitive helpers to `auth.uid()`, and restricted policies to authenticated users | `supabase/migrations/20260728180938_harden_creator_onboarding.sql` |
| Creator approval was not fully centralized around one database readiness rule | An administrator path could drift from public readiness and approve an incomplete creator | Added database readiness functions and made approval depend on verified phone, verified identity, real media, portfolio, package, experience, US location, pillar, and specialty requirements | `supabase/migrations/20260728180938_harden_creator_onboarding.sql`, `supabase/migrations/20260729230513_enforce_human_identity_gates.sql` |
| Creator application persistence could split listing, portfolio, and legal acceptance writes | A failed later write could leave a partially saved application | Added the transactional `submit_creator_application` RPC and live rollback verification | `supabase/migrations/20260728180938_harden_creator_onboarding.sql`, `scripts/verify-creator-onboarding-live.mjs` |
| Retainer creation permitted a legacy contractless path | Money could move without the locked contract lifecycle | `create-payment-intent` now requires an existing `countersigned` contract for every retainer | `supabase/functions/create-payment-intent/index.ts` |
| Checkout could reach a payment path before a creator was accepted | An open project could present misleading checkout state or use fallback data | Added an accepted-creator gate and directs the client to Smart Match/proposal acceptance first | `src/pages/CheckoutPage.jsx` |
| Project-document RPCs had authorization/join compatibility defects | An authorized participant could fail to read project documents; UUID/text joins could fail | Rebuilt `get_project_change_orders` and `get_project_documents` with explicit party/admin authorization and compatible joins | `supabase/migrations/20260730010000_fix_project_document_rpc.sql` |
| Stripe booking E2E no longer represented the new trust/contract lifecycle | The test could fail for the wrong reason or bypass the state being claimed | Added temporary phone/identity trust, a countersigned agreement state, full cleanup, and restored creator counters | `scripts/verify-booking-e2e.mjs`, `scripts/lib/qaTrust.mjs` |

### 4.2 Security, reliability, and data-integrity findings

| Finding | Correction | Primary code |
|---|---|---|
| Malformed UUID route parameters reached Supabase and generated avoidable 400 errors | Added a shared UUID guard and return-before-query behavior | `src/utils/ids.js`, `src/pages/CheckoutPage.jsx`, `tests/ids.test.js` |
| Creator and collaboration profile routes had their own malformed-ID risks | Added route-tail rejection before database/function calls | `src/pages/CreatorProfilePage.jsx`, `src/pages/CollaborationCheckoutPage.jsx`, `scripts/verify-public-readiness.mjs` |
| Optional profile queries used singular response behavior that could produce 406 responses for a new user | Replaced singular optional reads with bounded array reads | `src/pages/ClientProfilePage.jsx`, `src/components/ClientReputationBadge.jsx` |
| QA creator seeding referenced removed external-social columns and public example links | Centralized current-schema QA fixtures and switched portfolio samples to hosted Bunny references | `scripts/lib/qaFixtures.mjs`, `scripts/create-qa-accounts.mjs`, `tests/qaCreatorFixture.test.js` |
| Messaging and project-lifecycle verifiers assumed old trust state and could leave test data behind | Provisioned canonical QA phone/identity trust and added reliable `finally` cleanup/restoration | `scripts/verify-messaging.mjs`, `scripts/verify-project-lifecycle.mjs`, `scripts/lib/qaTrust.mjs` |
| Creator onboarding verifier did not prove phone and identity gates | Added explicit unverified-phone and unverified-identity rejection tests before successful submission | `scripts/verify-creator-onboarding-live.mjs` |
| Dependency graph contained moderate advisory exposure | Upgraded React, React DOM, React Router, and Lucide dependency lines; final advisory audit returned zero | `package.json`, `package-lock.json` |
| Server credentials could accidentally be referenced from browser code | Client-source scan confirmed no Stripe, Supabase service-role, Zoom secret, OpenAI, or Anthropic server key references under `src`/`public` | `scripts/audit-env.mjs`, `src/lib/supabase.js`, Supabase Edge Functions |
| Active attorney-review metadata remained in the earlier contract design | Removed active runtime/test metadata and added a migration that locks contracts without that field | `supabase/migrations/20260729230535_lock_contracts_and_remove_review_metadata.sql`, `src/utils/contractTerms.js`, `scripts/verify-contract-esign-rebook.mjs` |

### 4.3 Browser, mobile, and accessibility findings

| Finding | Correction | Primary code |
|---|---|---|
| Build Your Team embedded the full Creator Directory header and created two page headings | Added an `embedded` directory mode that suppresses the extra breadcrumb and hero | `src/components/CreatorDirectory.jsx`, `src/pages/CreatorHiringDashboard.jsx` |
| Invalid checkout used an `h2` as the page title | Changed the error title to `h1` | `src/pages/CheckoutPage.jsx` |
| Several routes did not expose stable document titles | Expanded route title mapping for collaboration, checkout, matches, identity, reset, admin, legal, and 404 paths | `src/App.jsx` |
| Password reset did not distinguish “checking” from an invalid/expired recovery link | Added a completed session check, invalid-link explanation, return-to-login action, page heading, and password-toggle label | `src/pages/ResetPasswordPage.jsx` |
| The auth honeypot could appear in the accessibility or keyboard tree | Marked it `aria-hidden` and removed it from tab order | `src/components/auth/AuthModal.jsx` |
| Compact auth and generated handoff pages could overflow vertically or have small touch targets | Added mobile scrolling and coarse-pointer 44px control rules | `src/components/auth/AuthModal.jsx`, `src/styles/creatorbridge-handoff.css` |
| Generated calculator/handoff content could retain stale DOM/event state | Reinitialized from a fresh DOM tree in `useLayoutEffect` and removed the tree during cleanup | `src/components/HandoffPage.jsx` |
| Rate calculator controls lacked stable accessible names | Added labels for market, locations, deliverables, crew, revisions, and usage | `src/components/HandoffPage.jsx` |
| An icon-only Messages action lacked an accessible name | Added `aria-label="Open conversation"` | `src/pages/MessagesPage.jsx` |
| Some compact project timeline/brief UI could clip or compress on mobile | Added wrapping and mobile-aware layout constraints | `src/components/ProjectTimeline.jsx`, `src/pages/ProjectBoard.jsx`, `src/styles/creatorbridge-handoff.css` |

## 5. Important remaining gaps and required human work

### 5.1 Priority 0: complete before a public paid launch

#### A. Run a controlled Stripe live-mode transaction

What is verified:

- The complete client money path passed in Stripe test mode.
- A `$500` project produced a `$250` retainer and `$275` final payment.
- The test asserted creator payout, platform fee, webhook settlement, and cleanup.
- The verifier refuses to run with a live Stripe key.

What still needs a human:

1. Confirm production Vercel/Supabase use the intended live Stripe publishable key, secret key, webhook signing secret, Connect account, and redirect URLs.
2. Make one deliberately small real transaction with a real client and creator test arrangement.
3. Observe the Stripe webhook, `transactions`, `payment_events`, transfer, receipt, cancellation/refund handling, and payout dashboard.
4. Confirm `supabase/config.toml` keeps `stripe-webhook` at `verify_jwt = false`; Stripe authenticates through its webhook signature, not a Supabase user JWT.

Key locations:

- `src/pages/CheckoutPage.jsx`
- `src/components/StripeOnboarding.jsx`
- `src/config/fees.js`
- `src/config/margins.js`
- `supabase/functions/create-payment-intent/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/release-payment/index.ts`
- `supabase/functions/create-connect-account/index.ts`
- `supabase/functions/check-connect-status/index.ts`
- `scripts/verify-booking-e2e.mjs`

#### B. Run real Twilio verification for both roles

What is verified:

- Both creator and client phone-verification functions exist.
- Database gates reject protected actions when the phone is not verified.
- Automated tests prove format, code validation, trust-state enforcement, and tamper resistance.

What still needs a human:

1. Upgrade/confirm the Twilio account can send to ordinary US numbers, not only trial-approved numbers.
2. Test one creator and one client using two real phones.
3. Test invalid code, expired code, resend delay, too many attempts, duplicate phone behavior, and support recovery.
4. Confirm messages contain correct CreatorBridge branding and do not expose internal provider language.

Key locations:

- `src/components/PhoneVerification.jsx`
- `src/components/ClientVerification.jsx`
- `supabase/functions/phone-send-code/index.ts`
- `supabase/functions/phone-check-code/index.ts`
- `supabase/functions/client-phone-send-code/index.ts`
- `supabase/functions/client-phone-check-code/index.ts`
- `supabase/migrations/20260729230432_human_identity_verification.sql`
- `scripts/verify-client-phone-gate.mjs`
- `tests/phoneVerification.test.js`

Required Supabase secrets:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

#### C. Complete a real Stripe Identity document/selfie flow

What is verified:

- Dedicated consent UI exists.
- Stripe Identity sessions are created server-side.
- The webhook is signature-verified and idempotent.
- Raw provider payloads and biometric media are not stored in CreatorBridge tables.
- Verified adult/document/selfie state is reduced to an allowlisted trust record.
- Reverification and manual-review states exist.

What still needs a human:

1. Complete one real government-ID and live-selfie session in the intended Stripe mode.
2. Verify every webhook state: verified, requires input, canceled, redacted, retry, and manual review.
3. Verify the return page, notifications, admin review queue, recovery, and privacy/delete handling.
4. Confirm the dedicated `STRIPE_IDENTITY_WEBHOOK_SECRET` belongs to the correct endpoint and environment.

Key locations:

- `src/components/IdentityConsent.jsx`
- `src/components/IdentityVerification.jsx`
- `src/pages/IdentityReturnPage.jsx`
- `src/components/admin/IdentityReviewTab.jsx`
- `src/hooks/useTrustStatus.js`
- `src/utils/humanIdentityPolicy.js`
- `supabase/functions/create-identity-session/index.ts`
- `supabase/functions/stripe-identity-webhook/index.ts`
- `supabase/functions/_shared/identityEventProcessor.js`
- `supabase/functions/_shared/identityPolicy.js`
- `supabase/functions/_shared/identityWebhookPolicy.js`
- `supabase/migrations/20260729230432_human_identity_verification.sql`
- `supabase/migrations/20260729230513_enforce_human_identity_gates.sql`
- `supabase/migrations/20260729230523_identity_admin_review.sql`
- `scripts/verify-human-identity-live.mjs`
- `tests/humanIdentityPolicy.test.js`
- `tests/identitySessionPolicy.test.js`
- `tests/identityWebhookPolicy.test.js`

#### D. Complete a two-person Zoom acceptance call

What is verified:

- Token issuance requires both consents and the scheduled join window.
- The room UI is custom CreatorBridge UI.
- Call scheduling requires a paid retainer, countersigned contract, project-party access, and creator availability.
- The room has a 60-minute cap and cleanup.
- Webhook signature validation, recording sync, private storage, retention timestamps, summaries, revision history, and agreement actions exist.
- Zoom webhook and recovery functions use REST API credentials distinct from Video SDK credentials.

What still needs a human:

1. Use two separate CreatorBridge accounts, browsers, microphones, and cameras.
2. Schedule on a real available day and confirm both users can consent and join.
3. Verify microphone/camera permission flows on desktop and mobile.
4. Confirm the call ends at 60 minutes or run a shortened controlled timer test in a non-production environment.
5. Confirm Zoom produces the expected audio recording and VTT transcript.
6. Confirm the webhook or five-minute recovery sync downloads them to private buckets.
7. Confirm Zoom’s cloud copy is deleted after CreatorBridge stores the approved files.
8. Confirm OpenAI creates the summary when credits are available.
9. Confirm both parties can edit, agree, download signed URLs, and create a change order from an agreed summary.
10. Confirm the UI does not unexpectedly expose Zoom branding through provider errors, permission dialogs, recording notices, or mobile-browser behavior. The application chrome is custom, but this promise must be verified in the real call.

Key locations:

- `src/components/calls/ProjectCallsPanel.jsx`
- `src/components/calls/ScheduleCallModal.jsx`
- `src/components/calls/CallConsent.jsx`
- `src/components/calls/CallRoom.jsx`
- `src/components/calls/CallSummary.jsx`
- `src/lib/callLegal.js`
- `supabase/functions/create-call-token/index.ts`
- `supabase/functions/zoom-webhook/index.ts`
- `supabase/functions/sync-call-recordings/index.ts`
- `supabase/functions/summarize-call/index.ts`
- `supabase/functions/cleanup-call-recordings/index.ts`
- `supabase/migrations/20260715090000_video_calls.sql`
- `supabase/migrations/20260720234626_harden_video_call_pipeline.sql`
- `supabase/migrations/20260721034500_sync_missing_call_recordings.sql`
- `scripts/verify-video-calls.mjs`
- `docs/2026-06-30-codex-video-calls-spec.md`

Required Supabase secrets:

- `ZOOM_VIDEO_SDK_KEY`
- `ZOOM_VIDEO_SDK_SECRET`
- `ZOOM_WEBHOOK_SECRET`
- `ZOOM_VIDEO_API_KEY` and `ZOOM_VIDEO_API_SECRET`
- Legacy fallbacks accepted by recording functions: `ZOOM_API_KEY` and `ZOOM_API_SECRET`
- `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_MAX_TOKENS` for summaries

### 5.2 Priority 1: identity duplicate-prevention architecture

This is the most important limitation to understand correctly.

The platform currently provides:

- one creator listing per authenticated user;
- phone verification;
- Stripe document, adult, liveness, and selfie-match verification;
- a manual-review state;
- an administrator workflow to mark a newer account as a duplicate of a verified original;
- automatic rejection/hiding of a creator listing after the administrator confirms the duplicate;
- audit history and original-account recovery rules.

The platform does **not** currently provide:

- its own biometric template database;
- automatic one-to-many face matching across all CreatorBridge accounts;
- a deterministic provider result that says “this face already belongs to user X”;
- a fully automated duplicate-account restriction E2E test.

The current webhook reducer verifies document, selfie, and adult results but does not calculate or compare a cross-account biometric identity:

- `supabase/functions/_shared/identityWebhookPolicy.js`
- `supabase/functions/_shared/identityEventProcessor.js`

Duplicate restriction is currently an administrator action:

- `src/components/admin/IdentityReviewTab.jsx`
- `supabase/migrations/20260729230523_identity_admin_review.sql`

Recommended programmer action:

1. Confirm with Stripe whether the selected Identity product exposes a supported duplicate-identity or reusable-identity signal for this account and jurisdiction.
2. If Stripe does not, evaluate a vendor that explicitly supports consented one-to-many duplicate detection and account recovery.
3. Do not build a home-grown face-vector database without a separate biometric privacy, retention, deletion, breach-response, and state-law design.
4. Keep the current manual duplicate-review path as a fallback even if an automated provider signal is added.
5. Add a provider-signal field that stores only a reduced allowlisted risk result, not raw biometric evidence.
6. Add a controlled E2E test proving: original verified account remains active, newer duplicate is restricted, creator listing is hidden/rejected, protected actions are denied, and recovery directs the person to the original account.

### 5.3 Priority 1: real-user onboarding and operations rehearsal

The platform currently has QA users and no established real-user operating history. Run a controlled pilot with at least:

- one new creator who completes phone, identity, portfolio, intro video, package, Stripe Connect, submission, admin approval, public profile, proposal, contract, call, delivery, and payout;
- one new client who completes phone, identity, brief, quote/match, proposal acceptance, contract, payment, call, summary, delivery review, and final payment;
- one administrator who handles approval, rejection, identity review, support, finance export, analytics, and a dispute.

The pilot should use zero prior explanation beyond what an ordinary user receives in the UI. Record every point where the user asks what to do next; those are onboarding defects even if the code technically works.

### 5.4 Priority 1: provider and operations checks

| Area | Human check |
|---|---|
| OpenAI | Add API credits; test paid chatbot escalation and call summarization; verify quotas and graceful no-credit behavior |
| Resend | Send to real Gmail/Outlook/mobile clients; review rendering, bounces, suppression, sender identity, and reply behavior |
| Bunny Stream | Upload and play a real intro plus portfolio video; test failed upload, deletion, processing delay, and mobile playback |
| Google Calendar | Complete OAuth, import busy dates, disconnect, reconnect, revoke access, and confirm token/session behavior |
| Supabase scheduled jobs | Confirm call cleanup, recording sync, reminders, support screenshot cleanup, and payment release jobs are running in production |
| Stripe webhooks | Inspect event retries, idempotency, and alerting for failed processing |
| Zoom webhooks | Inspect event subscriptions, endpoint validation, recording event selection, retries, and deletion failures |
| Turnstile | Test signup in normal, private, mobile, VPN, and blocked-cookie browsers |

### 5.5 Priority 2: maintainability and performance work

These are not current launch blockers, but a human programmer should review them:

1. **Generated handoff architecture:** `src/components/HandoffPage.jsx` injects trusted static HTML and runs a bundled static script with `new Function`. The source is local, not user-provided, so this is not an observed injection vulnerability. It is nevertheless harder to type-check, test, and enforce with a strict Content Security Policy. Consider migrating the calculator and other generated pages to normal React components.
2. **Large production chunks:** the production build warns about chunks above 500 kB, including an approximately 807 kB module. Profile the bundle and lazy-load PDF, Zoom, charting, animation, and admin-only code where practical.
3. **Landing-page static HTML:** `src/pages/LandingPage.jsx` uses `dangerouslySetInnerHTML` with a local constant. It is currently static, but contributors must never interpolate user/provider content into it.
4. **Bridge SVG injection:** `src/components/SupportChatbot.jsx` injects a local static SVG. Keep it static or convert it to JSX.
5. **Local environment hygiene:** `npm run audit:env` warned that service-role/Stripe secrets are present in the root local `.env` and that the local Turnstile site key was absent. Vite exposes only `VITE_` names, so this was not a browser leak, but service secrets should preferably live in a separate ignored server/QA environment file with restricted permissions.
6. **Historical documents:** older readiness files contain obsolete blockers and counts. Archive or annotate them so engineers use this report and the current verification scripts first.

## 6. Full platform feature inventory and code map

### 6.1 Platform shell, brand, routing, SEO, and responsive behavior

Features:

- responsive header/footer and role-aware navigation;
- dark/light theme;
- route titles and 404 experience;
- lazy-loaded pages and error boundaries;
- CreatorBridge brand logo, photography, palette, motion, and reduced-motion behavior;
- SEO metadata, organization JSON-LD, sitemap generation;
- desktop cursor effects and long-form scroll progress;
- mobile safe areas and coarse-pointer touch targets.

Primary locations:

- `src/App.jsx`
- `src/main.jsx`
- `src/index.css`
- `src/styles/creatorbridge-handoff.css`
- `src/components/BrandLogo.jsx`
- `src/components/SEO.jsx`
- `src/components/ErrorBoundary.jsx`
- `src/pages/LandingPage.jsx`
- `src/data/image-library.js`
- `public/images/creatorbridge/`
- `scripts/generate-sitemap.js`
- `docs/creatorbridge-brand-guidelines.md`
- `docs/IMAGE_LIBRARY_AUDIT.md`

### 6.2 Authentication, account creation, password recovery, and referrals

Features:

- email/password sign-in and signup;
- Google account entry;
- role selection for client or creator;
- Turnstile bot protection;
- referral-code capture;
- signup audit recording;
- password reset with invalid/expired-link state;
- authenticated route guards.

Primary locations:

- `src/contexts/AuthContext.jsx`
- `src/components/auth/AuthModal.jsx`
- `src/components/TurnstileWidget.jsx`
- `src/components/ReferralSection.jsx`
- `src/pages/ResetPasswordPage.jsx`
- `src/App.jsx`
- `supabase/functions/record-signup-audit/index.ts`
- `supabase/migrations/20260508130000_prelaunch_platform_hardening.sql`
- `supabase/migrations/20260616225637_client_invite_credit.sql`
- `supabase/migrations/20260616230550_client_invite_credit.sql`

### 6.3 Shared phone and human identity trust

Features:

- Twilio phone verification for creators and clients;
- normalized E.164 phone state;
- dedicated biometric consent;
- Stripe Identity government-ID and live-selfie flow;
- adult, document, selfie, retry, review, rejection, duplicate-restricted, and reverification states;
- reusable verified identity;
- defined reverification triggers;
- admin review actions and audit history;
- protected-action trust RPCs.

Primary locations:

- `src/components/PhoneVerification.jsx`
- `src/components/ClientVerification.jsx`
- `src/components/IdentityConsent.jsx`
- `src/components/IdentityVerification.jsx`
- `src/pages/IdentityReturnPage.jsx`
- `src/components/admin/IdentityReviewTab.jsx`
- `src/hooks/useTrustStatus.js`
- `src/utils/humanIdentityPolicy.js`
- `supabase/functions/phone-send-code/index.ts`
- `supabase/functions/phone-check-code/index.ts`
- `supabase/functions/client-phone-send-code/index.ts`
- `supabase/functions/client-phone-check-code/index.ts`
- `supabase/functions/create-identity-session/index.ts`
- `supabase/functions/stripe-identity-webhook/index.ts`
- `supabase/functions/_shared/identityPolicy.js`
- `supabase/functions/_shared/identityWebhookPolicy.js`
- `supabase/functions/_shared/identityEventProcessor.js`
- `supabase/migrations/20260729230432_human_identity_verification.sql`
- `supabase/migrations/20260729230513_enforce_human_identity_gates.sql`
- `supabase/migrations/20260729230523_identity_admin_review.sql`

### 6.4 Creator application, readiness, approval, and public profile

Features:

- guided creator application;
- local draft recovery;
- exactly one creator listing per account;
- one primary pillar and one to three specialties;
- minimum experience and US-location rules;
- real profile media, intro video, portfolio, and packages;
- transactional application submission;
- legal acceptance storage;
- manual administrator review;
- public-readiness quarantine;
- 30-day media-change controls;
- creator dashboard and profile-repair path;
- public profile, reviews, packages, availability, loyalty, and similar creators.

Primary locations:

- `src/components/CreatorDirectory.jsx`
- `src/pages/JoinAsCreator.jsx`
- `src/pages/CreatorDashboard.jsx`
- `src/pages/CreatorProfilePage.jsx`
- `src/components/ProfileSettings.jsx`
- `src/components/PackageBuilder.jsx`
- `src/components/ReviewsSection.jsx`
- `src/components/SimilarCreators.jsx`
- `src/components/TierBadge.jsx`
- `src/components/LoyaltyBadge.jsx`
- `src/utils/creatorApplicationDraft.js`
- `src/utils/creatorReadiness.js`
- `src/data/taxonomy.js`
- `supabase/migrations/20260524140000_three_pillar_taxonomy.sql`
- `supabase/migrations/20260703000000_drop_creator_linkedin_no_external_social.sql`
- `supabase/migrations/20260728180938_harden_creator_onboarding.sql`
- `supabase/migrations/20260729230513_enforce_human_identity_gates.sql`
- `scripts/verify-creator-onboarding-hardening.mjs`
- `scripts/verify-creator-onboarding-live.mjs`
- `scripts/verify-public-readiness.mjs`

### 6.5 Creator media and private storage

Features:

- Bunny Stream intro and portfolio videos;
- private Supabase portfolio photos;
- private client assets, project attachments, project deliveries, contracts, signatures, call audio, call transcripts, and support screenshots;
- signed URL generation;
- creator-text outbound-contact detection;
- removal of creator external social/profile links;
- upload/create/delete video functions.

Primary locations:

- `src/utils/bunnyStream.js`
- `src/utils/storage.js`
- `src/components/CreatorAvatar.jsx`
- `supabase/functions/bunny-create-video/index.ts`
- `supabase/functions/bunny-delete-video/index.ts`
- `supabase/functions/create-storage-signed-url/index.ts`
- `supabase/migrations/20260514115348_secure_storage_foundation.sql`
- `supabase/migrations/20260616093000_bunny_walled_garden_portfolio.sql`
- `supabase/migrations/20260616201112_bunny_walled_garden_portfolio.sql`
- `supabase/migrations/20260711153000_contract_esign_rebook.sql`
- `supabase/migrations/20260715090000_video_calls.sql`
- `supabase/migrations/20260618211908_support_report_screenshots_and_config.sql`
- `scripts/verify-walled-garden-portfolio.mjs`
- `scripts/verify-profile-media.mjs`

Private storage buckets:

- `creator-portfolio`
- `creator-intros`
- `client-assets`
- `project-attachments`
- `project-deliveries`
- `contracts`
- `signatures`
- `call-recordings`
- `call-transcripts`
- `support-screenshots`

### 6.6 Client profile and hiring desk

Features:

- client profile, brand/company details, headshot/logo, and about text;
- client phone and Terms gates;
- saved creators;
- project pipeline;
- creator-as-hirer mode for verified creators;
- client reputation badge without exposing private contact details.

Primary locations:

- `src/pages/ClientProfilePage.jsx`
- `src/components/ClientVerification.jsx`
- `src/components/ClientReputationBadge.jsx`
- `src/components/CreatorDirectory.jsx`
- `supabase/migrations/20260509172236_client_profile_personalization.sql`
- `supabase/migrations/20260616033104_require_client_phone_verification_for_briefs.sql`

### 6.7 Creator discovery, search, Fast Match, and Smart Match

Features:

- creator directory;
- three-pillar and specialty filters;
- location, availability, tier, budget, rating, and keyword search;
- approved/public-ready creator filtering;
- Smart Match scoring;
- match result route;
- similar creators;
- creator hiring search for collaborator roles.

Primary locations:

- `src/components/CreatorDirectory.jsx`
- `src/pages/Search.jsx`
- `src/components/FastMatch.jsx`
- `src/pages/MatchResultsPage.jsx`
- `src/utils/matchingAlgorithm.js`
- `src/data/taxonomy.js`
- `src/data/zipCodes.js`
- `supabase/migrations/20260524130000_create_search_infrastructure.sql`
- `supabase/migrations/20260525102500_update_search_for_three_pillar_taxonomy.sql`
- `scripts/verify-public-readiness.mjs`
- `scripts/verify-three-pillar-taxonomy.mjs`

### 6.8 Project Board, briefs, quote requests, proposals, and timeline

Features:

- public project brief browsing without demo rows;
- authenticated project creation;
- phone-gated brief submission;
- quote requests;
- creator proposals/applications;
- client acceptance;
- project timeline and status transitions;
- delivery, revisions, cancellation, disputes, and no-contact leakage;
- project documents panel and lifecycle education.

Primary locations:

- `src/pages/ProjectBoard.jsx`
- `src/components/RequestQuoteModal.jsx`
- `src/components/QuickQuoteMode.jsx`
- `src/components/ProjectTimeline.jsx`
- `src/components/ProjectDocuments.jsx`
- `src/components/ProjectProtectionGuide.jsx`
- `src/components/CancellationModal.jsx`
- `src/components/DisputeModal.jsx`
- `src/utils/projectStorage.js`
- `supabase/functions/submit-quote-request/index.ts`
- `supabase/migrations/20260516113000_secure_project_application_flow.sql`
- `supabase/migrations/20260516143200_secure_quote_booking_flow.sql`
- `supabase/migrations/20260519120000_harden_project_budget_checkout.sql`
- `supabase/migrations/20260729230557_project_protection_education.sql`
- `supabase/migrations/20260730010000_fix_project_document_rpc.sql`
- `scripts/verify-project-board-public-data.mjs`
- `scripts/verify-project-lifecycle.mjs`

### 6.9 Generated contracts, signatures, documents, and rebooking

Features:

- contract generation from accepted project/proposal/package data;
- canonical deterministic terms;
- SHA-256 content hash;
- typed, drawn, or saved signatures;
- signer name, role, consent, timestamp, IP, and user agent evidence;
- PDF generation and private storage;
- both-party countersignature state;
- rebooking from prior work with a fresh contract and signatures;
- project document index.

Primary locations:

- `src/components/ContractAction.jsx`
- `src/components/ContractView.jsx`
- `src/components/ContractSignModal.jsx`
- `src/components/SignaturePad.jsx`
- `src/components/RebookButton.jsx`
- `src/components/ProjectDocuments.jsx`
- `src/utils/contractTerms.js`
- `src/utils/contractPdf.js`
- `supabase/functions/generate-contract/index.ts`
- `supabase/functions/sign-contract/index.ts`
- `supabase/migrations/20260711153000_contract_esign_rebook.sql`
- `supabase/migrations/20260729230535_lock_contracts_and_remove_review_metadata.sql`
- `supabase/migrations/20260730010000_fix_project_document_rpc.sql`
- `tests/contractTerms.test.js`
- `scripts/verify-contract-esign-rebook.mjs`

### 6.10 Stripe payments, Connect payouts, fees, and disputes

Features:

- Stripe Connect onboarding and status;
- 50% retainer;
- 50% final payment;
- 5% client booking fee charged once on the final payment;
- creator loyalty fees of 10%, 8%, and 6%;
- referral fee waivers/reductions;
- Stripe webhook idempotency;
- protected release and creator transfer;
- cancellation split and dispute controls;
- transaction, payment-event, and dispute evidence records;
- admin release support.

Primary locations:

- `src/pages/CheckoutPage.jsx`
- `src/components/StripeOnboarding.jsx`
- `src/components/FeeBreakdown.jsx`
- `src/components/EarningsTab.jsx`
- `src/components/DisputeModal.jsx`
- `src/config/fees.js`
- `src/config/margins.js`
- `src/config/tiers.js`
- `src/lib/stripe.js`
- `supabase/functions/create-payment-intent/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/release-payment/index.ts`
- `supabase/functions/create-connect-account/index.ts`
- `supabase/functions/check-connect-status/index.ts`
- `supabase/migrations/20260514090847_secure_stripe_payment_flow.sql`
- `supabase/migrations/20260616233000_margin_protection.sql`
- `scripts/verify-booking-e2e.mjs`
- `scripts/verify-release-payment-security.mjs`
- `scripts/verify-margin-protection.mjs`

### 6.11 Change orders

Features:

- material-change form;
- before/after terms;
- optional agreed call-summary reference;
- immutable sequence and document number;
- generated PDF;
- both-party signatures;
- added positive payment split 50/50;
- Stripe settlement;
- activation, decline, void, and supersede states;
- original terms preserved unless explicitly replaced;
- final added-balance display.

Primary locations:

- `src/components/change-orders/ChangeOrderPanel.jsx`
- `src/components/change-orders/ChangeOrderForm.jsx`
- `src/components/change-orders/ChangeOrderSignModal.jsx`
- `src/components/change-orders/ChangeOrderPayment.jsx`
- `src/components/change-orders/ChangeOrderFinalPayments.jsx`
- `src/utils/changeOrderTerms.js`
- `src/utils/changeOrderPdf.js`
- `supabase/functions/generate-change-order/index.ts`
- `supabase/functions/sign-change-order/index.ts`
- `supabase/functions/create-change-order-payment/index.ts`
- `supabase/functions/_shared/changeOrderRelease.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/release-payment/index.ts`
- `supabase/migrations/20260729230543_project_change_orders.sql`
- `supabase/migrations/20260729230551_change_order_workflow.sql`
- `tests/changeOrderTerms.test.js`
- `scripts/verify-change-orders.mjs`
- `scripts/verify-change-orders-live.mjs`

### 6.12 Zoom-powered project calls, recordings, transcripts, and summaries

Features:

- scheduling based on creator availability;
- post-retainer and countersigned-contract gate;
- three included calls plus mutually requested extras;
- recording consent for both parties;
- custom embedded room;
- 60-minute limit;
- signed join token and scheduled time window;
- audio-only recording retention;
- VTT transcript;
- webhook verification;
- delayed-recording recovery job;
- OpenAI summary;
- summary revisions and both-party agreement;
- private signed downloads;
- 120-day retention/cleanup.

Primary locations are listed in section 5.1.D.

### 6.13 Messaging, contact protection, notifications, and email

Features:

- in-platform direct messaging;
- read receipts;
- off-platform contact blocking before an active booking;
- contact allowance after an active booking;
- message sanitization and filter-event logs;
- notification center with unread/read state;
- response due dates;
- transactional email through Resend;
- unauthenticated email rejection.

Primary locations:

- `src/pages/MessagesPage.jsx`
- `src/utils/messageFilter.js`
- `src/utils/inputSecurity.js`
- `src/components/NotificationBell.jsx`
- `src/lib/notifications.js`
- `supabase/functions/send-notification-email/index.ts`
- `supabase/migrations/20260516102000_add_message_read_receipts.sql`
- `supabase/migrations/20260516170242_secure_message_send_flow.sql`
- `supabase/migrations/20260522123028_allow_contact_after_active_booking.sql`
- `supabase/migrations/20260524070000_fix_send_message_regex_boundary.sql`
- `supabase/migrations/20260525180348_notification_center.sql`
- `scripts/verify-messaging.mjs`
- `scripts/verify-message-filter.mjs`
- `scripts/verify-notification-center.mjs`
- `scripts/verify-email-provider.mjs`

### 6.14 Closed creator network and portfolio sharing

Features:

- verified-network membership gate;
- state-based creator network;
- network posts, replies, and likes;
- portfolio feedback and referral lanes;
- portfolio items shared by internal reference;
- no direct network file upload or external portfolio links;
- creator profile deep links.

Primary locations:

- `src/pages/NetworkingPage.jsx`
- `supabase/migrations/20260517112238_harden_network_page_flow.sql`
- `supabase/migrations/20260520193000_harden_network_verified_member_gate.sql`
- `supabase/migrations/20260619031921_network_portfolio_project_sharing.sql`
- `scripts/verify-network.mjs`
- `scripts/verify-network-portfolio-sharing.mjs`
- `scripts/verify-network-portfolio-sharing-live.mjs`

### 6.15 Creator-to-creator hiring and production collaboration

Features:

- creator capabilities stored outside editable profile metadata;
- Build Your Team discovery;
- collaborator invite/composer;
- self-hire protection;
- $250 collaboration floor;
- hiring creator, hired creator, and outside client role isolation;
- ACH-only funded collaboration;
- buyer platform fee waived;
- processing cost assigned to the hiring creator;
- workspace links and link history;
- delivery anchors;
- reviews, surveys, and rehire;
- collaborator reputation and payout release.

Primary locations:

- `src/pages/CreatorHiringDashboard.jsx`
- `src/pages/CollaborationCheckoutPage.jsx`
- `src/components/creator/HireCollaboratorButton.jsx`
- `src/components/collaboration/CollaborationComposer.jsx`
- `src/components/collaboration/CreatorCollaborationIntro.jsx`
- `src/components/collaboration/ProjectWorkspaces.jsx`
- `src/components/collaboration/DeliveryAnchorForm.jsx`
- `src/components/collaboration/CollaborationReviewActions.jsx`
- `src/config/collaborationFees.js`
- `supabase/functions/create-collaboration-payment/index.ts`
- `supabase/migrations/20260622212955_creator_capabilities_project_roles.sql`
- `supabase/migrations/20260622231219_creator_collaboration_lifecycle.sql`
- `supabase/migrations/20260622232120_collaboration_payment_ledger.sql`
- `supabase/migrations/20260622232730_collaboration_workspaces_deliveries.sql`
- `supabase/migrations/20260625005812_collaboration_reviews_rehire.sql`
- `supabase/migrations/20260702000000_fix_collaboration_delivery_and_rehire.sql`
- `scripts/verify-collaboration-launch.mjs`

### 6.16 Availability and Google Calendar

Features:

- creator date availability;
- targeted upsert and stale-date removal;
- availability source tracking;
- Google busy-date import;
- session-scoped Google token behavior;
- schedule-call availability enforcement.

Primary locations:

- `src/components/AvailabilityCalendar.jsx`
- `src/components/GoogleCalendarConnect.jsx`
- `src/utils/dateKeys.js`
- `supabase/migrations/20260517101522_harden_availability_calendar_flow.sql`
- `supabase/migrations/20260720234626_harden_video_call_pipeline.sql`
- `tests/dateKeys.test.js`

### 6.17 Rate calculator, quote builder, packages, and pricing tools

Features:

- three-pillar rate calculator;
- US market and experience multipliers;
- usage, deliverables, crew, revision, travel, rush, raw-file, and cost controls;
- live quote, margin, 50/50 split, and package suggestion;
- line-item builder;
- presets;
- health/rate comparison;
- seasonal demand and regional pricing.

Primary locations:

- `src/components/HandoffPage.jsx`
- `src/data/handoffPages.js`
- `src/components/QuickQuoteMode.jsx`
- `src/components/LineItemBuilder.jsx`
- `src/components/QuoteOutput.jsx`
- `src/components/PresetManager.jsx`
- `src/components/HealthWidget.jsx`
- `src/components/RateComparisonChart.jsx`
- `src/components/SeasonalDemand.jsx`
- `src/components/PackageComparison.jsx`
- `src/utils/pricing.js`
- `src/data/rates.js`
- `src/data/regions.js`
- `src/config/margins.js`

### 6.18 Reviews, reputation, loyalty, and referrals

Features:

- creator reviews;
- client reputation;
- creator loyalty tiers;
- saved creators;
- referral codes and rewards;
- first/next booking fee waivers;
- creator next-project fee reduction;
- collaboration reviews and rehire.

Primary locations:

- `src/components/ReviewsSection.jsx`
- `src/components/ClientReputationBadge.jsx`
- `src/components/TierBadge.jsx`
- `src/components/LoyaltyBadge.jsx`
- `src/components/ReferralSection.jsx`
- `src/components/RebookButton.jsx`
- `supabase/migrations/20260616225637_client_invite_credit.sql`
- `supabase/migrations/20260616233000_margin_protection.sql`
- `supabase/migrations/20260625005812_collaboration_reviews_rehire.sql`

### 6.19 Support, issue reporting, screenshots, violations, and Bridge chatbot

Features:

- support ticket creation;
- optional private screenshot;
- 30-day screenshot retention;
- cleanup job;
- support categories and admin updates;
- violations/strike system;
- local/free Bridge platform guide;
- optional paid OpenAI help behind explicit user action, quota, and token caps;
- no browser-side OpenAI or Anthropic key.

Primary locations:

- `src/components/SupportTicketForm.jsx`
- `src/pages/AdminSupport.jsx`
- `src/components/SupportChatbot.jsx`
- `src/data/supportKnowledge.js`
- `supabase/functions/chatbot/index.ts`
- `supabase/functions/cleanup-support-screenshots/index.ts`
- `supabase/migrations/20260524100000_create_support_tickets.sql`
- `supabase/migrations/20260524110000_create_violations_system.sql`
- `supabase/migrations/20260608090000_create_chatbot_ai_daily_usage.sql`
- `supabase/migrations/20260618211908_support_report_screenshots_and_config.sql`
- `supabase/migrations/20260618212454_schedule_support_screenshot_cleanup.sql`
- `docs/CHATBOT_AI_OPERATIONS.md`
- `scripts/verify-chatbot-guide.mjs`
- `scripts/verify-chatbot-ai.mjs`
- `scripts/verify-support-reporting.mjs`
- `scripts/verify-support-cleanup-live.mjs`

### 6.20 Administrator control center

Features:

- separate trusted admin roster;
- platform summary;
- creator approval/rejection;
- incomplete-profile approval block;
- identity review;
- support ticket management;
- violations and account operations;
- payment release controls;
- finance ledger and CSV export;
- analytics and platform-intelligence reports;
- search and operational lookups.

Primary locations:

- `src/pages/AdminDashboard.jsx`
- `src/pages/AdminSupport.jsx`
- `src/pages/AdminOperations.jsx`
- `src/pages/AdminFinance.jsx`
- `src/pages/AdminAnalytics.jsx`
- `src/components/admin/IdentityReviewTab.jsx`
- `src/utils/exportCsv.js`
- `supabase/migrations/20260516235356_admin_control_hub_foundation.sql`
- `supabase/migrations/20260523050900_admin_write_actions.sql`
- `supabase/migrations/20260728180938_harden_creator_onboarding.sql`
- `supabase/migrations/20260729230523_identity_admin_review.sql`
- `scripts/verify-admin-support-search.mjs`

### 6.21 Platform Intelligence, privacy, export, retention, and deletion

Features:

- versioned event definitions;
- authoritative versus directional event trust;
- private event ledger;
- rejection of message, file, email, and phone contents;
- restricted browser event RPC;
- report generation and schedules;
- governance/retention;
- data export;
- data-subject deletion and pseudonymization.

Primary locations:

- `src/lib/platformIntelligence.js`
- `src/pages/AdminAnalytics.jsx`
- `src/pages/TermsPage.jsx`
- `supabase/functions/generate-platform-report/index.ts`
- `supabase/functions/export-platform-intelligence/index.ts`
- `supabase/functions/retain-platform-intelligence/index.ts`
- `supabase/functions/delete-platform-intelligence-subject/index.ts`
- `supabase/migrations/20260622213810_platform_intelligence_ledger.sql`
- `supabase/migrations/20260625010441_platform_intelligence_governance.sql`
- `supabase/migrations/20260625011117_platform_intelligence_reports.sql`
- `scripts/verify-platform-intelligence.mjs`
- `scripts/verify-platform-intelligence-governance.mjs`
- `scripts/verify-platform-intelligence-reports.mjs`

### 6.22 Legal and policy surfaces

Features:

- Terms of Service;
- Privacy Policy;
- Creator Agreement;
- Dispute Policy;
- versioned legal acceptances;
- project protection guide;
- recording consent;
- identity consent;
- signature consent.

Primary locations:

- `src/pages/TermsOfService.jsx`
- `src/pages/TermsPage.jsx`
- `src/pages/CreatorAgreement.jsx`
- `src/pages/DisputePolicy.jsx`
- `src/components/TermsModal.jsx`
- `src/components/PrivacyModal.jsx`
- `src/components/ProjectProtectionGuide.jsx`
- `src/config/legal.js`
- `src/lib/callLegal.js`
- `supabase/migrations/20260524080000_create_legal_acceptances.sql`
- `supabase/migrations/20260702020000_legal_acceptances_dispute_policy.sql`
- `supabase/migrations/20260729230557_project_protection_education.sql`

## 7. Route inventory

| Route | Purpose | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/find` | Creator directory | Public |
| `/search` | Search | Public |
| `/register` | Creator application | Account flow |
| `/login` | Sign in | Public |
| `/signup` | Create account | Public |
| `/creator/:id` | Creator public profile | Public-ready creators |
| `/dashboard` | Creator operations | Authenticated |
| `/dashboard/build-team` | Creator hiring desk | Authenticated |
| `/collaboration/:collaborationId/payment` | ACH collaboration funding | Authenticated |
| `/client` | Client profile/hiring desk | Authenticated |
| `/messages` | Messages | Authenticated |
| `/projects` | Project Board | Mixed public/authenticated actions |
| `/checkout/:projectId` | Project payment | Authenticated |
| `/matches/:projectId` | Smart Match results | Project participant |
| `/network` | Verified creator network | Verified member |
| `/admin` | Admin dashboard | Platform admin |
| `/admin/support` | Support operations | Platform admin |
| `/admin/operations` | Creator/platform operations | Platform admin |
| `/admin/finance` | Finance | Platform admin |
| `/admin/analytics` | Platform Intelligence | Platform admin |
| `/terms` | Terms | Public |
| `/terms-of-service` | Terms alias | Public |
| `/creator-agreement` | Creator Agreement | Public |
| `/dispute-policy` | Dispute Policy | Public |
| `/join-as-creator` | Creator introduction | Public |
| `/privacy` | Privacy Policy | Public |
| `/reset-password` | Password recovery | Recovery session |
| `/verification/identity/return` | Stripe Identity return | Authenticated |
| `/calculator` | Rate calculator | Public |
| `/rate-calculator` | Calculator alias | Public |
| `*` | 404 | Public |

Route definitions and access wrappers are in `src/App.jsx`.

## 8. Supabase Edge Function inventory

### Payments and Stripe

- `create-payment-intent`
- `stripe-webhook`
- `release-payment`
- `create-connect-account`
- `check-connect-status`
- `create-change-order-payment`
- `create-collaboration-payment`
- `test-topup` (QA/controlled use only)

### Contracts and documents

- `generate-contract`
- `sign-contract`
- `generate-change-order`
- `sign-change-order`
- `create-storage-signed-url`

### Identity and phone

- `phone-send-code`
- `phone-check-code`
- `client-phone-send-code`
- `client-phone-check-code`
- `create-identity-session`
- `stripe-identity-webhook`

### Video calls

- `create-call-token`
- `zoom-webhook`
- `sync-call-recordings`
- `summarize-call`
- `cleanup-call-recordings`
- `zoom-recording-diagnostic`
- `zoom-recordings-diagnostic`
- `zoom-settings-diagnostic`
- `zoom-qa-delete`

Diagnostic and QA deletion functions must be reviewed before launch to ensure they require strong maintenance/admin authorization and are not discoverable public utilities.

### Media

- `bunny-create-video`
- `bunny-delete-video`

### Messaging, notifications, and support

- `send-notification-email`
- `submit-quote-request`
- `cleanup-support-screenshots`
- `chatbot`
- `openai-diagnostic`

`openai-diagnostic` should be confirmed admin/maintenance-only or removed from production if no longer needed.

### Platform Intelligence

- `generate-platform-report`
- `export-platform-intelligence`
- `retain-platform-intelligence`
- `delete-platform-intelligence-subject`

All function configuration is in `supabase/config.toml`.

## 9. Core data inventory

Important public-schema tables include:

- accounts/trust: `profiles`, `client_profiles`, `account_phone_verifications`, `identity_consents`, `identity_verifications`, `identity_provider_events`, `identity_review_actions`, `account_capabilities`;
- creators: `creator_listings`, `creator_services`, `portfolio_items`, `packages`, `availability`, `reviews`, `subscriptions`, `favorites`;
- projects: `projects`, `project_applications`, `quote_requests`, `project_participants`;
- contracts/change orders: `contracts`, `contract_signatures`, `saved_signatures`, `contract_change_orders`, `change_order_signatures`, `change_order_payments`, `project_guide_acknowledgments`;
- payments/disputes: `transactions`, `payment_events`, `disputes`, `dispute_evidence`;
- calls: `project_calls`, `project_call_requests`, `call_consents`, `call_summaries`, `call_summary_revisions`;
- messaging/notifications: `messages`, `message_filter_events`, `notifications`;
- network: `network_posts`, `network_replies`, `network_post_likes`, `state_chat_messages`;
- collaboration: `creator_collaborations`, `collaboration_payments`, `collaboration_workspace_links`, `collaboration_workspace_link_history`, `collaboration_delivery_anchors`, `collaboration_reviews`, `collaboration_surveys`;
- referrals/reputation: `referrals`, `referral_rewards`, `referral_program_settings`, `creator_credit_ledger`, `client_reviews`;
- support/admin: `support_report_config`, `violations`, `platform_admins`;
- intelligence: `platform_event_definitions`, `platform_events`, `platform_event_outbox`, `platform_intelligence_metric_definitions`, `platform_intelligence_reports`, `platform_intelligence_report_schedules`, `platform_intelligence_exports`, `platform_subject_pseudonyms`, `platform_subject_deletion_requests`;
- configuration: `platform_margin_settings`, `legal_acceptances`, `chatbot_ai_usage_daily`.

The consolidated base schema is `supabase/schema.sql`. Production evolution is in `supabase/migrations/`; never edit an already-applied migration to change production. Add a new forward migration.

## 10. Environment and secret map

### Browser-safe Vite variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_GOOGLE_CLIENT_ID`

Only values intended for every browser visitor may use the `VITE_` prefix.

### Server-only Supabase secrets

- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_IDENTITY_WEBHOOK_SECRET`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- Zoom SDK: `ZOOM_VIDEO_SDK_KEY`, `ZOOM_VIDEO_SDK_SECRET`, `ZOOM_WEBHOOK_SECRET`
- Zoom REST recording API: `ZOOM_VIDEO_API_KEY`, `ZOOM_VIDEO_API_SECRET`
- Bunny: `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_PLAYBACK_KEY`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_MAX_TOKENS`
- Chatbot controls: `CHATBOT_AI_ENABLED`, `CHATBOT_AI_DAILY_QUOTA`
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Turnstile: `TURNSTILE_SECRET_KEY`
- jobs: `PLATFORM_JOB_SECRET`, `PLATFORM_INTELLIGENCE_JOB_SECRET`
- document branding: `CONTRACT_LOGO_URL`

Do not print secret values in bug reports. Verify names and presence with `npm run audit:env` and `npm run verify:external-env`.

## 11. Recommended human programmer review order

1. Read this report and the two July 29 design specs.
2. Run the final verification battery on a clean checkout of commit `304f948`.
3. Confirm production migration parity with `supabase migration list`.
4. Review `supabase/config.toml`, especially every `verify_jwt = false` function and its internal signature/maintenance-token validation.
5. Review the four trust boundaries: creator application, contract signing, payment creation, and call token creation.
6. Decide the automatic duplicate-identity architecture described in section 5.2.
7. Run the creator/client/admin zero-context pilot.
8. Complete Twilio, Stripe Identity, Zoom, OpenAI, Resend, Bunny, and Google Calendar provider acceptance tests.
9. Run one controlled Stripe live transaction last.
10. Re-run all automated checks and the desktop/mobile browser matrix after any correction.
11. Archive or clearly mark stale readiness documents.
12. Remove or tightly restrict diagnostics and QA-only functions before opening the platform broadly.

## 12. Definition of done for the human handoff

The programmer should not declare CreatorBridge launch-ready until:

- the clean-checkout automated battery passes;
- production migrations and functions match source control;
- one real creator and one real client complete the full lifecycle;
- Twilio works on ordinary phones;
- Stripe Identity completes and returns the intended reduced trust state;
- the duplicate-account strategy is explicitly resolved and tested;
- Zoom recording/transcript/summary works between two real browsers;
- OpenAI credit-dependent features work or are intentionally disabled with clear UI;
- Resend, Bunny, and Google Calendar complete their real-provider tests;
- a controlled Stripe live payment and transfer reconcile;
- admin/support staff can operate the queues without database-console intervention;
- production monitoring, webhook failure handling, data retention, and recovery ownership are documented.

## 13. Repository state note

At the time this report was written, the audit fixes were committed and deployed. A separate user-owned edit remained uncommitted in:

`docs/2026-06-30-video-calls-decisions-notes.md`

That file was intentionally not modified, staged, or reverted by the audit.
