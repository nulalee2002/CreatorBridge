# Human Identity and Duplicate Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one provider-backed human identity state per CreatorBridge account, require Twilio phone verification for both roles, prevent duplicate creator portfolios, and enforce identity at every trusted server action.

**Architecture:** Supabase owns the platform trust state, Stripe Identity owns government-ID and selfie processing, and Twilio Verify owns phone possession checks. Shared private Postgres predicates become the single authorization boundary for RPCs and Edge Functions. The browser can display status and start provider flows, but it cannot write verification outcomes.

**Tech Stack:** React 18, Supabase Postgres/RLS/RPCs, Supabase Edge Functions on Deno, Stripe Identity, Stripe webhooks, Twilio Verify, Node test runner, Vite.

## Global Constraints

- Preserve the approved design in `docs/superpowers/specs/2026-07-29-human-identity-duplicate-prevention-design.md`.
- Do not store government-ID images, selfie media, face templates, embeddings, raw Stripe verification reports, or raw provider webhook payloads.
- Do not make phone number unique; company and household phone reuse is risk context, not proof of duplicate identity.
- Use service-role writes only for provider outcomes. Authenticated users receive read-only reduced status through RPCs.
- Require a written reason for every administrative adverse, duplicate, recovery, or override decision.
- A successful verification has no arbitrary expiry. Only explicit risk or recovery triggers may set `reverification_required`.
- Preserve unrelated worktree changes and deploy only after the phase review is approved.

---

## Task 1: Add failing trust-model verification tests

**Files:**

- Create: `scripts/verify-human-identity-foundation.mjs`
- Create: `tests/humanIdentityPolicy.test.js`
- Modify: `package.json`

- [ ] Add `tests/humanIdentityPolicy.test.js` with pure policy cases for trusted status, action gates, and retry/review behavior.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityAllowsTrustedAction,
  phoneAllowsContact,
  nextIdentityState,
} from '../src/utils/humanIdentityPolicy.js';

test('only verified identity unlocks trusted actions', () => {
  for (const status of [
    'unverified',
    'consent_required',
    'pending',
    'retry_required',
    'manual_review',
    'duplicate_restricted',
    'rejected',
    'reverification_required',
  ]) {
    assert.equal(identityAllowsTrustedAction(status), false);
  }
  assert.equal(identityAllowsTrustedAction('verified'), true);
});

test('phone verification is required for contact', () => {
  assert.equal(phoneAllowsContact({ phoneVerified: false }), false);
  assert.equal(phoneAllowsContact({ phoneVerified: true }), true);
});

test('verified identity remains verified without a trigger', () => {
  assert.equal(nextIdentityState('verified', 'normal_return'), 'verified');
  assert.equal(nextIdentityState('verified', 'suspicious_recovery'), 'reverification_required');
});
```

- [ ] Add `scripts/verify-human-identity-foundation.mjs` to assert that the migration, provider functions, server gates, RLS policies, and forbidden-column checks exist. Make it scan identity migrations for forbidden names such as `id_image`, `selfie_url`, `face_embedding`, `raw_payload`, and `verification_report_json`.
- [ ] Add package scripts:

```json
"test:human-identity": "node --test tests/humanIdentityPolicy.test.js",
"verify:human-identity": "node scripts/verify-human-identity-foundation.mjs"
```

- [ ] Run the tests and confirm they fail because the policy helper and implementation do not exist:

```bash
npm run test:human-identity
npm run verify:human-identity
```

- [ ] Commit the red tests:

```bash
git add package.json tests/humanIdentityPolicy.test.js scripts/verify-human-identity-foundation.mjs
git commit -m "test: define human identity trust requirements"
```

## Task 2: Create the shared identity database and security boundary

**Files:**

- Create: `supabase/migrations/20260729120000_human_identity_verification.sql`
- Create: `src/utils/humanIdentityPolicy.js`
- Modify: `supabase/schema.sql`
- Test: `tests/humanIdentityPolicy.test.js`
- Test: `scripts/verify-human-identity-foundation.mjs`

- [ ] Implement the pure browser policy helper with an explicit status allowlist:

```js
export const TRUSTED_IDENTITY_STATUS = 'verified';

export function identityAllowsTrustedAction(status) {
  return status === TRUSTED_IDENTITY_STATUS;
}

export function phoneAllowsContact({ phoneVerified }) {
  return phoneVerified === true;
}

export function nextIdentityState(current, trigger) {
  if (current === 'verified' && trigger === 'normal_return') return 'verified';
  if (current === 'verified' && trigger === 'suspicious_recovery') return 'reverification_required';
  return current;
}
```

- [ ] In `20260729120000_human_identity_verification.sql`, add shared phone state to `profiles`:

```sql
alter table public.profiles
  add column if not exists phone_e164 text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;
```

- [ ] Create `identity_consents` with `user_id`, `consent_version`, `accepted_at`, audit IP/user agent, and a unique `(user_id, consent_version)` key.
- [ ] Create `identity_verifications` with provider reference, purpose, status, birth-date check result, document result, selfie result, limited risk label, attempt count, review reason, duplicate-linked original user, verified/reverification timestamps, and check constraints for the approved status set.
- [ ] Create `identity_provider_events` with a unique Stripe event ID, reduced event type, processing result, and timestamp. Do not include a raw payload column.
- [ ] Create append-only `identity_review_actions` with target user, verification, action, reason, reviewer, linked original account, and timestamp.
- [ ] Add indexes for latest user verification, review queue status, provider session lookup, and event idempotency.
- [ ] Enable RLS on all four tables. Give authenticated users read access only to their own consent and reduced verification rows. Keep provider events and review actions admin/service-only.
- [ ] Add `creatorbridge_private.user_phone_verified(uuid)` and `creatorbridge_private.user_identity_verified(uuid)` as `security definer`, fixed-search-path predicates. Identity must return false for suspension, duplicate restriction, rejection, manual review, or reverification.
- [ ] Add `public.get_my_trust_status()` returning only phone state, reduced identity status, retry availability, review message, and last timestamps.
- [ ] Add a trigger that blocks authenticated direct updates to protected `profiles.phone_*` fields while allowing service-role provider functions.
- [ ] Add an admin-only `public.require_verified_project_parties(project_id)` helper returning the client and creator trust result so every project gate uses identical semantics.
- [ ] Update `supabase/schema.sql` to reflect the migration without adding provider media or payload fields.
- [ ] Run:

```bash
npm run test:human-identity
npm run verify:human-identity
```

- [ ] Commit:

```bash
git add supabase/migrations/20260729120000_human_identity_verification.sql supabase/schema.sql src/utils/humanIdentityPolicy.js tests/humanIdentityPolicy.test.js scripts/verify-human-identity-foundation.mjs
git commit -m "feat: add shared human identity trust model"
```

## Task 3: Generalize Twilio verification for clients and creators

**Files:**

- Create: `supabase/functions/phone-send-code/index.ts`
- Create: `supabase/functions/phone-check-code/index.ts`
- Create: `src/components/PhoneVerification.jsx`
- Modify: `src/components/ClientVerification.jsx`
- Modify: `src/components/CreatorDirectory.jsx`
- Modify: `supabase/config.toml`
- Modify: `scripts/verify-client-phone-gate.mjs`
- Test: `scripts/verify-human-identity-foundation.mjs`

- [ ] Copy the validated Twilio request, normalization, rate limiting, and error-handling patterns from `client-phone-send-code` and `client-phone-check-code` into role-neutral functions.
- [ ] Authenticate the bearer token in both new functions and derive `user_id` from Supabase Auth. Never accept a browser-supplied user ID.
- [ ] On send, write the normalized E.164 number to `profiles`, reset `phone_verified` and `phone_verified_at`, and keep `client_profiles` synchronized when a client row exists.
- [ ] On a successful Twilio check, set the profile fields server-side and synchronize the compatibility client row. A number change must reset only phone verification, not Stripe Identity.
- [ ] Add `[functions.phone-send-code]` and `[functions.phone-check-code]` entries to `supabase/config.toml` with JWT verification enabled.
- [ ] Extract the reusable phone UI from `ClientVerification.jsx` into `PhoneVerification.jsx`. It should accept `purpose`, `onVerified`, and plain-language `unlockCopy`.
- [ ] Keep `ClientVerification.jsx` as the client flow wrapper and invoke the shared functions.
- [ ] Add the shared phone step to the creator application's final submission section without blocking draft saves.
- [ ] Update the phone verification scripts to assert both client and creator flows and ensure no client-supplied verification flag is trusted.
- [ ] Run:

```bash
npm run verify:client-phone-gate
npm run verify:human-identity
npm run build
```

- [ ] Commit:

```bash
git add supabase/functions/phone-send-code/index.ts supabase/functions/phone-check-code/index.ts src/components/PhoneVerification.jsx src/components/ClientVerification.jsx src/components/CreatorDirectory.jsx supabase/config.toml scripts/verify-client-phone-gate.mjs scripts/verify-human-identity-foundation.mjs
git commit -m "feat: verify phone ownership for both roles"
```

## Task 4: Add biometric consent and Stripe Identity session creation

**Files:**

- Create: `supabase/functions/create-identity-session/index.ts`
- Create: `src/components/IdentityConsent.jsx`
- Create: `src/components/IdentityVerification.jsx`
- Create: `src/hooks/useTrustStatus.js`
- Modify: `supabase/config.toml`
- Modify: `src/components/CreatorDirectory.jsx`
- Modify: `src/components/ContractSignModal.jsx`
- Test: `scripts/verify-human-identity-foundation.mjs`

- [ ] Define one versioned consent constant in both the function and UI test fixture. The screen must explain the document, live selfie, age, likeness, provider processing, CreatorBridge's limited retention, support/review path, and policy links.
- [ ] Make `create-identity-session` require an authenticated user, exact consent version, supported purpose (`creator_application` or `first_contract`), and no active verified status.
- [ ] Insert the consent record before calling Stripe. Use an idempotency key based on user, purpose, and consent row.
- [ ] Create a Stripe Identity `document` session with live capture and matching selfie:

```ts
const session = await stripe.identity.verificationSessions.create({
  type: 'document',
  client_reference_id: user.id,
  metadata: { user_id: user.id, purpose },
  options: {
    document: {
      require_live_capture: true,
      require_matching_selfie: true,
    },
  },
  return_url: `${siteUrl}/verification/identity/return`,
}, {
  idempotencyKey: `identity_${user.id}_${purpose}_${consent.id}`,
});
```

- [ ] Persist only the session ID, user ID, purpose, platform status, consent reference, and timestamps. Return only the Stripe-hosted session URL.
- [ ] Implement `useTrustStatus` through `get_my_trust_status()` and make `IdentityVerification` resume a pending session or request a new secure attempt when allowed.
- [ ] Place the dedicated consent immediately before redirecting to Stripe in creator submission and first-contract signing. Do not imply that Stripe Connect is identity verification.
- [ ] Update `VerificationFlow.jsx` so payout onboarding and human identity are distinct steps.
- [ ] Add `[functions.create-identity-session]` to `supabase/config.toml`.
- [ ] Run:

```bash
npm run verify:human-identity
npm run build
```

- [ ] Commit:

```bash
git add supabase/functions/create-identity-session/index.ts src/components/IdentityConsent.jsx src/components/IdentityVerification.jsx src/hooks/useTrustStatus.js src/components/CreatorDirectory.jsx src/components/ContractSignModal.jsx src/components/VerificationFlow.jsx supabase/config.toml scripts/verify-human-identity-foundation.mjs
git commit -m "feat: add consented Stripe Identity verification"
```

## Task 5: Process Stripe Identity outcomes safely and idempotently

**Files:**

- Create: `supabase/functions/stripe-identity-webhook/index.ts`
- Modify: `supabase/config.toml`
- Modify: `scripts/audit-env.mjs`
- Modify: `scripts/verify-human-identity-foundation.mjs`

- [ ] Use a dedicated `STRIPE_IDENTITY_WEBHOOK_SECRET` so payment and identity webhook failure domains remain separate.
- [ ] Verify the `Stripe-Signature` header against the unmodified request body before parsing.
- [ ] Claim the Stripe event ID in `identity_provider_events` before processing; return success for a previously completed event.
- [ ] Handle `identity.verification_session.verified`, `identity.verification_session.requires_input`, `identity.verification_session.canceled`, and `identity.verification_session.redacted`.
- [ ] On verified, retrieve the Verification Report and reduce it through an explicit allowlist:

```ts
const reduced = {
  document_status: report.document?.status ?? null,
  selfie_status: report.selfie?.status ?? null,
  error_code: session.last_error?.code ?? null,
  verified_at: new Date().toISOString(),
};
```

- [ ] Never persist the report object, document file IDs, selfie media, extracted identity fields beyond the approved age result, or request body.
- [ ] Mark a clear, adult, document-and-selfie result `verified`. Route uncertain results, an available provider duplicate insight, or inconsistent account evidence to `manual_review`. Do not auto-link accounts from shared company data.
- [ ] Treat undocumented provider fields as absent. Any future duplicate-signal adapter must be feature-detected, allowlisted, covered by a fixture test, and reviewed before enabling an adverse action. Reviewers may document a Stripe Dashboard duplicate insight through the audited admin action flow.
- [ ] Add `[functions.stripe-identity-webhook]` with JWT verification disabled because Stripe authenticates by signature.
- [ ] Add the new secret to environment auditing without printing its value.
- [ ] Run:

```bash
npm run audit:env
npm run verify:human-identity
```

- [ ] Commit:

```bash
git add supabase/functions/stripe-identity-webhook/index.ts supabase/config.toml scripts/audit-env.mjs scripts/verify-human-identity-foundation.mjs
git commit -m "feat: process Stripe Identity outcomes safely"
```

## Task 6: Enforce identity in onboarding, contact, contracts, payments, calls, and collaboration

**Files:**

- Create: `supabase/migrations/20260729121000_enforce_human_identity_gates.sql`
- Modify: `supabase/functions/sign-contract/index.ts`
- Modify: `supabase/functions/create-payment-intent/index.ts`
- Modify: `supabase/functions/create-call-token/index.ts`
- Modify: `supabase/functions/create-collaboration-payment/index.ts`
- Modify: `scripts/verify-creator-onboarding-hardening.mjs`
- Modify: `scripts/verify-contract-esign-rebook.mjs`
- Modify: `scripts/verify-video-calls.mjs`
- Modify: `scripts/verify-collaboration-payments.mjs`
- Test: `scripts/verify-human-identity-foundation.mjs`

- [ ] Override `submit_creator_application` so draft writes remain available but final submission requires verified email, phone, adult identity, and no restriction.
- [ ] Extend `creator_listing_meets_approval_requirements`, `admin_approve_creator`, and `admin_approve_creator_noted` to require verified identity and phone in addition to Stripe Connect and existing completeness requirements.
- [ ] Override `create_project_brief`, `submit_quote_request`, and `send_creatorbridge_message` so creator contact actions require the caller's shared profile phone verification. Preserve existing anti-spam, authorization, budget, and notification logic from the latest definitions.
- [ ] Override `schedule_project_call` to call `require_verified_project_parties` in addition to the countersigned-contract and paid-retainer checks.
- [ ] In `sign-contract`, reject the signer unless `user_identity_verified(user.id)` is true. Each party must be verified before their own signature is written.
- [ ] In `create-payment-intent`, reject retainer and final payment creation unless both project parties pass the shared project helper.
- [ ] In `create-call-token`, verify both project parties immediately before issuing a token, even if a call was scheduled earlier.
- [ ] In creator collaboration acceptance and payment creation, require both creator accounts to be approved and identity verified.
- [ ] Return stable, user-safe error codes such as `PHONE_VERIFICATION_REQUIRED`, `IDENTITY_VERIFICATION_REQUIRED`, `IDENTITY_REVIEW_REQUIRED`, and `DUPLICATE_ACCOUNT_RESTRICTED` so the UI can show the correct next step.
- [ ] Extend every verifier to prove the new check occurs server-side.
- [ ] Run:

```bash
npm run verify:creator-onboarding-hardening
npm run verify:contracts
npm run verify:video-calls
npm run verify:collaboration-payments
npm run verify:human-identity
npm run build
```

- [ ] Commit:

```bash
git add supabase/migrations/20260729121000_enforce_human_identity_gates.sql supabase/functions/sign-contract/index.ts supabase/functions/create-payment-intent/index.ts supabase/functions/create-call-token/index.ts supabase/functions/create-collaboration-payment/index.ts scripts/verify-creator-onboarding-hardening.mjs scripts/verify-contract-esign-rebook.mjs scripts/verify-video-calls.mjs scripts/verify-collaboration-payments.mjs scripts/verify-human-identity-foundation.mjs
git commit -m "feat: enforce human identity at trusted actions"
```

## Task 7: Add audited identity review and duplicate recovery

**Files:**

- Create: `supabase/migrations/20260729122000_identity_admin_review.sql`
- Create: `src/components/admin/IdentityReviewTab.jsx`
- Modify: `src/pages/AdminOperations.jsx`
- Modify: `scripts/verify-human-identity-foundation.mjs`

- [ ] Add `get_admin_identity_review_queue()` returning only reduced verification state, capability context, phone state, risk label, linked original user, attempts, and account/project counts.
- [ ] Add `admin_resolve_identity_review(verification_id, action, reason, original_user_id)` with an admin check, mandatory nonblank reason, locked transition rules, and an append-only review-action insert.
- [ ] Support only the approved actions: secure retry, false-positive clearance, duplicate restriction/link, non-duplicate rejection, reverification, and original-account restoration.
- [ ] When confirming a duplicate, restrict the newer account and preserve all history. Before clearing a duplicate, assert that the action cannot leave two approved creator listings for the same provider-backed person.
- [ ] Build `IdentityReviewTab` with status filters, reduced details, Stripe session reference, a link to the secured Stripe provider surface, reason-required actions, and confirmation for adverse decisions.
- [ ] Do not fetch or display biometric evidence from Supabase.
- [ ] Add the tab to `AdminOperations.jsx` and refresh the queue after a successful action.
- [ ] Run:

```bash
npm run verify:human-identity
npm run build
```

- [ ] Commit:

```bash
git add supabase/migrations/20260729122000_identity_admin_review.sql src/components/admin/IdentityReviewTab.jsx src/pages/AdminOperations.jsx scripts/verify-human-identity-foundation.mjs
git commit -m "feat: add audited identity review and recovery"
```

## Task 8: Verify locally, stage production configuration, and stop for rollout approval

**Files:**

- Create: `scripts/verify-human-identity-live.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-launch-sweep.mjs`
- Modify: `docs/superpowers/specs/2026-07-29-human-identity-duplicate-prevention-design.md`

- [ ] Add a live verifier that uses dedicated QA accounts to test cross-user RLS, draft-vs-submit behavior, contact gates, contract signing gates, payment gates, call gates, admin reason requirements, and idempotent webhook-event claims.
- [ ] Do not automate real biometric submission. The live verifier should confirm session creation in Stripe test mode and then print the exact manual test checkpoints for verified, retry, and review outcomes.
- [ ] Add the identity tests to `verify:launch-sweep`.
- [ ] Run the full pre-deployment evidence set:

```bash
npm run test:human-identity
npm run verify:human-identity
npm run verify:creator-onboarding-hardening
npm run verify:client-phone-gate
npm run verify:contracts
npm run verify:video-calls
npm run build
npm audit
git diff --check
```

- [ ] Confirm the migration list and deployment diff without changing production:

```bash
supabase migration list
git status --short
```

- [ ] Present a Fable evidence report covering trust surfaces, commands, unresolved external configuration, and the exact production rollout sequence.
- [ ] Stop for approval before any production migration or function deployment.
- [ ] After approval, deploy migrations first, then `phone-send-code`, `phone-check-code`, `create-identity-session`, `stripe-identity-webhook`, `sign-contract`, `create-payment-intent`, `create-call-token`, and collaboration functions.
- [ ] Configure the Stripe Identity webhook endpoint for identity event types and add `STRIPE_IDENTITY_WEBHOOK_SECRET` in Supabase.
- [ ] Run the live verifier and complete one client and one creator Stripe test-mode identity flow.
- [ ] Record the verified implementation and rollout date in the approved design spec without changing the locked decisions.
- [ ] Commit:

```bash
git add package.json scripts/verify-human-identity-live.mjs scripts/verify-launch-sweep.mjs docs/superpowers/specs/2026-07-29-human-identity-duplicate-prevention-design.md
git commit -m "test: verify human identity rollout"
```

## Phase Acceptance Gate

Identity work is complete only when local tests pass, the user approves the reviewed code, migrations and functions deploy cleanly, Stripe test-mode webhook events are verified, QA demonstrates that direct API calls cannot bypass gates, and no prohibited biometric material is present in Supabase or application logs.
