# CreatorBridge Launch Security, Delivery, and Revisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved CreatorBridge launch hardening and one complete, server-authoritative final-delivery flow with two included revisions, unlimited $50 paid revisions, private 5 GB delivery versions, five-day review, and truthful final-payment completion.

**Architecture:** Additive Supabase migrations create guarded trust fields, revision ledgers, project-conversation mappings, immutable delivery versions, and scheduled state transitions. Focused React modules replace Project Board's prototype logic while existing contracts, change orders, identity, messaging filters, and 50/50 payment ledgers remain authoritative. Stripe and email transitions are idempotent Edge Functions; the browser only requests and displays server state.

**Tech Stack:** React 19, React Router 8, Vite 8, Supabase Postgres/Auth/Storage/Edge Functions/Cron, Stripe PaymentIntents and Connect, Resend, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-launch-security-delivery-revisions-design.md`

## Global Constraints

- Every project includes exactly `2` revisions.
- Every additional revision costs the client exactly `5000` cents; no client booking fee is added.
- The creator's trusted 10%, 8%, or 6% fee is deducted inside the $50 revision payment.
- Direct files are final deliverables only and total at most `5_000_000_000` bytes per delivery version.
- External Drive/Dropbox-compatible links do not count toward the direct-upload limit.
- Bunny remains profile/introduction media only.
- Formal server submission, not a pasted chat link, starts a `120`-hour review window.
- Revision and dispute state block approval; resubmission starts a fresh 120-hour window.
- Direct files remain through active work and for seven days after approval; holds suspend deletion.
- SMS and Frame.io are out of scope.
- Existing signed contracts and historical migrations are immutable.
- Never expose service-role or Stripe secret material to the browser or test output.
- Preserve the user's modified `docs/2026-06-30-video-calls-decisions-notes.md` and untracked audit report.

---

### Task 1: Baseline and business-rule test harness

**Files:**
- Create: `src/config/projectCompletion.js`
- Create: `tests/projectCompletionPolicy.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `INCLUDED_REVISIONS`, `PAID_REVISION_PRICE_CENTS`, `DELIVERY_DIRECT_LIMIT_BYTES`, `REVIEW_WINDOW_HOURS`, `DOWNLOAD_RETENTION_DAYS`, `creatorFeePctForCompletedProjects(completedProjects)`, `calculatePaidRevisionSplit(completedProjects)`.

- [ ] Write tests asserting constants `2`, `5000`, `5_000_000_000`, `120`, and `7`, plus exact $45/$46/$47 creator nets for 10%/8%/6% tiers.
- [ ] Run `node --test tests/projectCompletionPolicy.test.js`; verify it fails because the module does not exist.
- [ ] Implement the pure constants and integer-cent fee calculation in `src/config/projectCompletion.js`.
- [ ] Add `test:project-completion` and an aggregate `test` script to `package.json`.
- [ ] Run the focused test and the existing 33-test suite; verify all pass.
- [ ] Commit only Task 1 files with `test: lock project completion business rules`.

### Task 2: Protect payment, verification, and admin trust fields

**Files:**
- Create using `supabase migration new launch_trust_field_guards`: CLI-generated migration file under `supabase/migrations/`
- Create: `scripts/verify-launch-trust-guards.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: trigger functions `private.guard_profile_trust_columns()`, `private.guard_client_profile_trust_columns()`, `private.guard_creator_listing_trust_columns()`; authenticated self-service writes remain possible for non-protected columns.

- [ ] Write the static verifier first. It must fail unless the migration protects fee waivers, completed project counters, tier/fee overrides, creator review/verification state, Stripe onboarding identifiers, payout state, suspension state, and admin/identity flags; pins `search_path`; revokes privileged function execution; and leaves RLS enabled.
- [ ] Run `node scripts/verify-launch-trust-guards.mjs`; verify failure.
- [ ] Run `supabase migration new launch_trust_field_guards` and implement security-invoker `BEFORE UPDATE` guards that reject protected-column changes when `current_user = 'authenticated'`, while service-role/server updates remain possible. Do not use deprecated `auth.role()`. Schema-qualify all privileged references and keep helpers in `private`.
- [ ] Replace broad profile/listing/client-profile update grants with the narrowest practical grants while preserving legitimate self-service columns.
- [ ] Add direct REST/live checks using disposable QA rows: owner can update display data; owner cannot change fee, verification, payout, or admin data; unrelated user cannot update the row.
- [ ] Add `verify:launch-trust-guards` to `package.json`, run the static verifier, migration parser, and live verifier when Supabase is reachable.
- [ ] Run Supabase advisors and inspect function privilege warnings.
- [ ] Commit migration, verifier, and script entry with `fix: protect payment and trust fields`.

### Task 3: Enforce the admin shell before rendering

**Files:**
- Create: `src/components/auth/AdminRequired.jsx`
- Create: `tests/adminRouteGuard.test.js`
- Modify: `src/App.jsx`
- Modify: `tests/routeShell.test.js`

**Interfaces:**
- Produces: `<AdminRequired dark user loading>{children}</AdminRequired>` using `supabase.rpc('is_platform_admin')`; renders children only after `data === true`.

- [ ] Write source/behavior tests asserting all five `/admin` routes use `AdminRequired`, the component checks `is_platform_admin`, and denied users never render child content.
- [ ] Run the focused tests and verify failure.
- [ ] Implement a loading, signed-out, denied, provider-error, and allowed state in the focused component.
- [ ] Replace the generic client wrappers on admin dashboard, support, operations, finance, and analytics routes.
- [ ] Run focused tests, `npm run build`, and authenticated/unauthorized browser checks.
- [ ] Commit with `fix: gate admin routes before render`.

### Task 4: Normalize two included revisions everywhere

**Files:**
- Create using `supabase migration new enforce_two_included_revisions`: CLI-generated migration file under `supabase/migrations/`
- Create: `scripts/verify-two-revisions.mjs`
- Modify: `src/components/PackageBuilder.jsx`
- Modify: `src/config/fees.js`
- Modify: `src/data/rates.js`
- Modify: `src/data/seedCreators.js`
- Modify: `src/utils/pricing.js`
- Modify: `src/utils/contractTerms.js`
- Modify: `src/utils/contractPdf.js`
- Modify: `src/components/ContractView.jsx`
- Modify: `src/components/QuoteOutput.jsx`
- Modify: `src/components/RequestQuoteModal.jsx`
- Modify: `src/components/SupportChatbot.jsx`
- Modify: `src/data/supportKnowledge.js`
- Modify: active legal/help/email files reported by `rg -l "72 hours|72-hour|revisions|unlimited revisions" src supabase/functions`
- Modify: `tests/contractTerms.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `INCLUDED_REVISIONS` from Task 1.
- Produces: all new package writes and contract snapshots contain `revisions: 2`; database constraint rejects other active package values.

- [ ] Extend tests to assert package normalization and contract text “two included revisions”; add a repository scan that rejects active 1/3/5/10/unlimited revision claims and 72-hour review copy.
- [ ] Run tests/verifier and observe failures.
- [ ] Create the migration, update existing package rows to two, set default two, and add a `CHECK (revisions = 2)` constraint after normalization.
- [ ] Remove revision editing from Package Builder and hard-code server/client serializers to two.
- [ ] Replace active 72-hour language with five calendar days and normalize all package/calculator/contract/help/chatbot/email/legal copy.
- [ ] Preserve immutable signed contract rows; change only future generators and QA/seed values.
- [ ] Run contract tests, `verify:contracts`, `audit:platform`, repository scan, and build.
- [ ] Commit with `feat: enforce two included revisions platform wide`.

### Task 5: Add revision purchase and request ledgers

**Files:**
- Create using `supabase migration new project_revision_ledgers`: CLI-generated migration file under `supabase/migrations/`
- Create: `scripts/verify-project-revision-ledgers.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces tables `project_revision_purchases` and `project_revision_requests`; RPCs `get_project_revision_state(uuid)` and `request_project_revision(uuid, uuid, text, text)`; server-only fulfillment function `private.fulfill_paid_revision(uuid, text)`.
- `get_project_revision_state` returns included total/used/remaining, paid available/used, active delivery ID, and request lock reason.

- [ ] Write the verifier to require RLS, project-party SELECT, no direct client mutation, unique Stripe intent/event identifiers, one paid purchase per request, included ordinals 1..2, and transactional row locking.
- [ ] Run verifier and observe failure.
- [ ] Create both ledgers, constraints, indexes, RLS/grants, and project-party read policies.
- [ ] Implement `get_project_revision_state` as security-invoker where possible.
- [ ] Implement `request_project_revision` with `FOR UPDATE`: verify caller is project client, active delivery is under review, no dispute is open, consume included 1 then 2 or the oldest paid entitlement, create one request, pause delivery review, and return the request.
- [ ] Revoke all execution from `PUBLIC`/`anon`; grant only the client request/state RPCs to authenticated and keep fulfillment private/server-only.
- [ ] Test double-submit, concurrent consume, cross-project entitlement, third request without payment, and unlimited sequential paid entitlements.
- [ ] Run advisors and commit with `feat: add auditable revision entitlements`.

### Task 6: Implement exact-$50 Stripe revision payments

**Files:**
- Create: `supabase/functions/create-revision-payment/index.ts`
- Create: `tests/paidRevisionPolicy.test.js`
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Modify: `supabase/functions/send-notification-email/index.ts`
- Modify: `scripts/verify-release-payment-security.mjs`
- Create: `scripts/verify-paid-revisions.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces Edge Function request `{ projectId: string, idempotencyKey: string }`; response `{ purchaseId, clientSecret, amountCents: 5000, creatorNetCents, platformFeeCents }`.
- Stripe metadata: `paymentFlow=paid_revision`, `paymentType=project_revision`, `revisionPurchaseId`, `projectId`.

- [ ] Write pure/source tests asserting an authenticated project client is required, amount is always 5000, no client fee is added, fee tier is server-derived, and metadata/idempotency are present.
- [ ] Run tests and observe failure.
- [ ] Implement the Edge Function using the project's trusted client, creator listing, and completed-project count; insert/reuse a pending purchase before creating the PaymentIntent.
- [ ] Extend the verified webhook so `payment_intent.succeeded` validates currency, amount, metadata, and trusted purchase row before idempotently fulfilling one entitlement.
- [ ] Add failed/canceled payment state handling and in-app/email notification events without granting entitlement.
- [ ] Add email templates for revision purchase success/failure and revision request.
- [ ] Test Stripe test-mode success, duplicate webhook, wrong amount, wrong project, canceled intent, and repeated purchases.
- [ ] Commit with `feat: sell unlimited fixed-price revisions`.

### Task 7: Add project-specific conversation mapping

**Files:**
- Create using `supabase migration new project_conversations`: CLI-generated migration file under `supabase/migrations/`
- Create: `src/utils/projectConversations.js`
- Create: `tests/projectConversations.test.js`
- Modify: `src/pages/MessagesPage.jsx`
- Modify: current `send_message_secure` migration through a new replacement definition in the Task 7 migration
- Modify: `scripts/verify-messaging.mjs`

**Interfaces:**
- Produces table `project_conversations(project_id uuid primary key, conversation_id uuid unique, client_id uuid, creator_user_id uuid, created_at timestamptz)` and RPC `get_or_create_project_conversation(uuid)`.
- Produces `buildProjectThreadKey(message)`, preferring `projectId`, then server conversation ID; never participant-pair merge for project messages.

- [ ] Write unit/source checks proving two project IDs between the same users remain separate and existing non-project messages remain readable.
- [ ] Run tests and observe failure.
- [ ] Create the mapping table, project-party RLS, unique constraints, and authenticated RPC that derives both parties from the project.
- [ ] Extend secure message sending to accept an optional project ID, verify the mapped conversation, and include project context in notification payloads.
- [ ] Refactor Messages Page thread grouping to project/conversation identity and show project title on project threads.
- [ ] Run message-filter, messaging, project lifecycle, and browser multi-project tests.
- [ ] Commit with `feat: keep project conversations separate`.

### Task 8: Add immutable delivery and private Storage model

**Files:**
- Create using `supabase migration new project_delivery_versions`: CLI-generated migration file under `supabase/migrations/`
- Create: `supabase/functions/create-delivery-upload/index.ts`
- Create: `supabase/functions/finalize-project-delivery/index.ts`
- Create: `supabase/functions/create-delivery-download/index.ts`
- Create: `src/utils/projectDelivery.js`
- Create: `tests/projectDeliveryPolicy.test.js`
- Create: `scripts/verify-project-deliveries.mjs`
- Modify: `package.json`

**Interfaces:**
- Tables: `project_deliveries`, `project_delivery_items`, `project_delivery_holds`.
- Upload request `{ projectId, deliveryDraftId, fileName, contentType, sizeBytes }`; response `{ itemId, bucket, objectPath, signedUploadToken }`.
- Finalize request `{ projectId, deliveryDraftId, note, idempotencyKey }`; response `{ deliveryId, version, reviewDeadlineAt }`.
- Download request `{ deliveryItemId }`; response `{ signedUrl, expiresAt }`.

- [ ] Write tests for 5 GB combined size, unsafe types, zero-item submission, external URL normalization, immutable submitted versions, and project-party download authorization.
- [ ] Run tests/verifier and observe failure.
- [ ] Create append-only delivery/item/hold tables with explicit statuses, unique version/idempotency constraints, RLS, indexes, and metadata retention fields.
- [ ] Update the private `project-deliveries` bucket to a 5 GB object limit and replace uploader-only read rules with project-party signed-URL access. Do not make the bucket public.
- [ ] Implement server-issued non-overwriting object paths and signed resumable upload tokens; validate creator ownership, allowed content type, byte size, and draft state.
- [ ] Implement finalization that locks the project/draft, verifies completed items and combined size, assigns the next version, records UTC 120-hour deadline, supersedes the prior delivery, changes project state, creates an in-app notification, and posts a pinned project-conversation system message.
- [ ] Implement short-lived signed downloads after checking project party/admin authorization and retention/hold state.
- [ ] Test unrelated-user denial, creator/client access, 5 GB boundary, duplicate finalization, and mixed direct/external items.
- [ ] Run advisors and commit with `feat: add private versioned project delivery`.

### Task 9: Build the unified delivery and revision interface

**Files:**
- Create: `src/components/project/DeliveryComposer.jsx`
- Create: `src/components/project/DeliveryHistory.jsx`
- Create: `src/components/project/DeliveryReviewPanel.jsx`
- Create: `src/components/project/RevisionPurchasePanel.jsx`
- Create: `src/hooks/useProjectCompletion.js`
- Modify: `src/pages/ProjectBoard.jsx`
- Modify: `src/pages/MessagesPage.jsx`
- Create: `tests/projectCompletionUi.test.js`

**Interfaces:**
- `useProjectCompletion(projectId)` returns `{ deliveries, revisionState, loading, error, refresh, finalizeDelivery, requestRevision, beginRevisionPurchase, approveDelivery, disputeDelivery }`.
- Delivery Composer accepts direct files and `{ label, url }` external items in one draft and renders aggregate bytes against 5 GB.

- [ ] Write source/UI tests for final-only copy, combined 5 GB indicator, external links excluded from size, two included revisions, locked third request, exact $50 copy, five-day deadline, version history, and no 200 MB prototype text.
- [ ] Run tests and observe failure.
- [ ] Implement resumable uploads with progress, pause/resume/retry, signed-token refresh, and non-overwriting paths using the current supported Supabase TUS flow.
- [ ] Implement external-link validation and the one formal submit action.
- [ ] Split Project Board prototype delivery/revision logic into the focused components and use only server state for status/deadlines.
- [ ] Render pinned delivery/revision cards in the project conversation and immutable prior versions in history.
- [ ] Verify zero-context client and creator flows at desktop and mobile widths.
- [ ] Commit with `feat: add unified final delivery experience`.

### Task 10: Add review reminders, auto-approval, retention, and cleanup

**Files:**
- Create using `supabase migration new schedule_project_completion_jobs`: CLI-generated migration file under `supabase/migrations/`
- Create: `supabase/functions/process-project-reviews/index.ts`
- Create: `supabase/functions/cleanup-project-deliveries/index.ts`
- Create: `scripts/verify-project-review-jobs.mjs`
- Modify: `supabase/functions/send-notification-email/index.ts`
- Modify: `package.json`

**Interfaces:**
- Review job requires a server-only secret and processes claimed due rows idempotently.
- Cleanup job deletes only objects whose approved retention deadline passed and which have no dispute, payment-attention, legal, or support hold.

- [ ] Write structural/live tests for one 48-hour reminder, one 24-hour reminder, no browser-triggered approval, dispute/revision blocking, fresh deadline on resubmission, seven days after approval, and hold-aware deletion.
- [ ] Run tests and observe failure.
- [ ] Implement atomic SQL claim helpers with `FOR UPDATE SKIP LOCKED` and event markers that prevent duplicate reminders/approval.
- [ ] Implement the server-only review processor and delivery/email/in-app events.
- [ ] Schedule it with Supabase Cron/`pg_cron` using Vault-backed function credentials; avoid secret literals in migration files.
- [ ] Implement cleanup that deletes Storage objects, records deletion metadata, preserves audit rows, retries failures, and leaves external links untouched.
- [ ] Schedule cleanup and verify job entries/run history in the remote project.
- [ ] Test boundary timestamps, duplicate invocations, active disputes, payment attention, and support holds.
- [ ] Commit with `feat: automate review and delivery retention`.

### Task 11: Make final payment truthful and recoverable

**Files:**
- Create using `supabase migration new final_payment_recovery`: CLI-generated migration file under `supabase/migrations/`
- Create: `supabase/functions/process-final-payment/index.ts`
- Create: `src/components/project/FinalPaymentAttention.jsx`
- Create: `tests/finalPaymentPolicy.test.js`
- Modify: `supabase/functions/create-payment-intent/index.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Modify: `supabase/functions/release-payment/index.ts`
- Modify: `src/pages/CheckoutPage.jsx`
- Modify: `src/pages/ProjectBoard.jsx`
- Modify: payment/approval email and contract/help copy
- Modify: `scripts/verify-release-payment-security.mjs`

**Interfaces:**
- Retainer PaymentIntent uses `setup_future_usage: 'off_session'` and records consent timestamp plus Stripe customer/payment-method identifiers on the transaction.
- Final processor request `{ projectId }`; server job may process due approved projects in a batch.
- Project state `final_payment_attention` is not equivalent to paid/released.

- [ ] Write tests asserting the retainer saves a reusable method with explicit consent copy, final amount is server-derived, approval queues but does not falsely mark payment, and only signed Stripe webhook success releases payout.
- [ ] Run tests and observe failure.
- [ ] Add payment-method/consent/attempt/error columns and indexes without storing card data.
- [ ] Update retainer creation and checkout consent UI.
- [ ] Implement final-payment attempt using the trusted customer/payment method and existing 50/50 plus change-order math.
- [ ] On `requires_action`/decline/missing method, store payment attention and expose an authenticated on-session recovery action.
- [ ] Extend webhook idempotency so successful final payment is the only transition to paid/released; keep existing Connect transfer safety.
- [ ] Remove frontend auto-approval/payment mutation and inaccurate “released” language.
- [ ] Test Stripe test cards for success, decline, authentication required, retry, duplicate webhook, and wrong amount.
- [ ] Commit with `fix: automate final payment without false release`.

### Task 12: Complete public and operational audit cleanup

**Files:**
- Create: `src/config/support.js`
- Modify: `src/pages/NetworkingPage.jsx`
- Modify: all support-address files returned by `rg -l "drl33@creatorbridge\.studio|ADMIN_SUPPORT_EMAIL|SUPPORT_EMAIL" src supabase/functions scripts`
- Modify: email log statements in `supabase/functions/send-notification-email/index.ts` and `supabase/functions/stripe-webhook/index.ts`
- Modify: `src/App.jsx`
- Modify: `vite.config.js`
- Create/update: `public/sitemap.xml`
- Modify: `scripts/generate-sitemap.js`
- Create: `tests/publicLaunchCleanup.test.js`
- Modify: `tests/qaCleanup.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces `SUPPORT_EMAIL` client constant and server `SUPPORT_EMAIL` environment/fallback resolution without inventing a new mailbox.
- Public Network derives counts/posts/chat only from Supabase and renders truthful empty/loading/error states.

- [ ] Write repository tests rejecting fabricated `net-seed`/`m-seed` content and invented creator counts, missing sitemap, scattered support literals, recipient email logging, and the Marcus Reed QA identity at the release gate.
- [ ] Run tests and observe failure.
- [ ] Remove fabricated Network activity and add truthful signed-out, empty, loading, and provider-error states.
- [ ] Centralize support configuration across client, legal/help, scripts, chatbot, and Edge Functions.
- [ ] Redact recipient addresses and unnecessary personal data from logs while retaining provider message/event IDs.
- [ ] Generate a canonical sitemap matching intended public routes and verify `robots.txt` reference.
- [ ] Convert large route imports to `React.lazy`/`Suspense` and configure stable manual chunks for vendor-heavy Zoom/PDF/admin paths.
- [x] Remove the Marcus Reed QA fixture after browser acceptance data no longer depends on it. Completed in the live database on 2026-08-23; remaining creator-listing count verified as zero.
- [ ] Run cleanup tests, build, bundle inspection, public readiness, platform language, network, and support verifiers.
- [ ] Commit with `fix: remove launch audit leftovers`.

### Task 13: Add distributed trust-surface rate limiting

**Files:**
- Create using `supabase migration new distributed_edge_rate_limits`: CLI-generated migration file under `supabase/migrations/`
- Modify: `supabase/functions/_shared/rateLimit.ts`
- Create: `supabase/functions/_shared/distributedRateLimit.ts`
- Create: `tests/rateLimitPolicy.test.js`
- Create: `scripts/verify-distributed-rate-limits.mjs`
- Modify: payment, identity, messaging, support, AI, and notification Edge Functions that import `checkRateLimit`

**Interfaces:**
- Produces private RPC `private.consume_edge_rate_limit(action_key text, subject_hash text, limit_count int, window_seconds int)` returning `{ allowed, remaining, retry_after_seconds }`.
- Produces TypeScript `checkDistributedRateLimit(admin, { action, subject, limit, windowSeconds, failClosed }): Promise<RateLimitResult>`.

- [ ] Write tests for shared enforcement across two simulated instances, expiry, subject hashing, payment/identity fail-closed, low-risk controlled failure, and no raw IP/email persistence.
- [ ] Run tests and observe failure.
- [ ] Create a private/unexposed ledger with expiry index and atomic upsert function; revoke all public execution.
- [ ] Implement SHA-256 subject hashing with a server secret and replace process-memory checks on trust surfaces.
- [ ] Add scheduled pruning of expired buckets.
- [ ] Run load/concurrency checks and Supabase advisors.
- [ ] Commit with `fix: distribute trust-surface rate limits`.

### Task 14: Commit browser automation and run the launch verification matrix

**Files:**
- Create: `playwright.config.js`
- Create: `e2e/auth.setup.js`
- Create: `e2e/admin-access.spec.js`
- Create: `e2e/project-completion.spec.js`
- Create: `e2e/public-empty-states.spec.js`
- Create: `e2e/mobile-project-completion.spec.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/verify-launch-sweep.mjs`

**Interfaces:**
- Produces `test:e2e` and `verify:project-completion-live` commands with disposable QA identifiers and scoped cleanup.

- [ ] Install and pin `@playwright/test`; commit the lockfile.
- [ ] Add authenticated client/creator/admin setup using dedicated QA accounts, never real users.
- [ ] Automate unauthorized admin denial, empty Network/directory, two separate same-party projects, mixed delivery, 5 GB rejection via mocked upload metadata, included revisions, paid revision test-mode flow, dispute, auto-approval job invocation, payment attention, success, retention hold, and signed download denial.
- [ ] Add desktop and mobile projects plus screenshot/video/trace retention on failure.
- [ ] Run all unit tests, build, `audit:platform`, dependency audit, contract, change-order, messaging, video, readiness, collaboration, language, Storage, database, Stripe, email, Cron, and E2E checks.
- [ ] Inspect the first, last, empty, unauthorized, failure, retry, mobile, and desktop states; do not accept structural source scans as provider proof.
- [ ] Verify remote migration alignment and Supabase advisors before deployment.
- [ ] Deploy migrations/functions/frontend in dependency order only after test-mode verification; rerun production read-only smoke checks.
- [ ] Record any provider or authorization blocker plainly. Do not call the platform complete while a required acceptance path is unverified.
- [ ] Commit with `test: cover project completion end to end`.

### Task 15: Credential rotation and Git-history runbook

**Files:**
- Create: `docs/security/credential-rotation-and-history-runbook.md`
- Modify: `.gitignore` only if the audit finds an uncovered environment-file pattern
- Modify: `scripts/audit-env.mjs`

**Interfaces:**
- Produces a secret-free, target-specific operations checklist; does not perform history rewrite without explicit approval.

- [ ] Extend the environment audit to inspect tracked files and build output without printing secret values.
- [ ] Write the runbook covering Stripe test-key/webhook rotation, Supabase key review, Vercel/Supabase secret updates, webhook endpoint verification, backup refs, `git filter-repo` target removal, force-push coordination, and mandatory re-clone instructions.
- [ ] Run the audit and verify current source/bundle cleanliness.
- [ ] Rotate provider credentials only with dashboard/API authority and verify new test payments/webhooks before revoking the old values.
- [ ] Request separate explicit authorization before rewriting and force-pushing shared Git history or changing repository visibility.
- [ ] Commit the safe audit/runbook work with `docs: add credential exposure recovery runbook`.

## Final Completion Rule

The build is complete only when Tasks 1-14 pass locally and against configured test providers, migrations/functions are aligned with the deployed Supabase project, production read-only smoke checks pass, and no audit acceptance item is left untracked. Task 15's history rewrite remains a separately authorized destructive operation; its absence must be reported as an open launch risk rather than hidden behind passing code tests.
