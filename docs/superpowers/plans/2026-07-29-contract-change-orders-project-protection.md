# Contract Change Orders and Project Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the original signed production agreement, add separately signed and funded change orders, expose all project records to both parties, and explain the complete protected-project lifecycle inside CreatorBridge.

**Architecture:** The original `contracts` record remains immutable evidence. Each material change becomes a separately hashed `contract_change_orders` record with independent signatures and a separate 50/50 payment ledger. Supabase enforces lifecycle state and authorization, Edge Functions render/sign/pay provider-backed documents, and the Project Board presents documents, education, and exact lock reasons.

**Tech Stack:** React 18, Supabase Postgres/RLS/RPCs, Supabase Edge Functions on Deno, Stripe PaymentIntents/webhooks, private Supabase Storage, jsPDF, Node test runner, Vite.

## Global Constraints

- Preserve the approved lifecycle in `docs/superpowers/specs/2026-07-29-contract-call-change-order-design.md`.
- Implement after the shared human-identity predicates in the identity plan are merged and verified.
- Never rewrite an original signed contract, its terms snapshot, content hash, signatures, or PDF.
- An agreed call summary documents the conversation but never changes binding terms.
- A proposed or signed change order cannot be edited. Changed content creates a new sequence/hash and requires new signatures.
- First release supports zero-dollar changes and positive price increases only. Price reductions, refunds, and credits route to support.
- Positive additions use an independent 50/50 ledger: added retainer before activation, added final at delivery.
- Browser-supplied prices, party IDs, hashes, statuses, and payment totals are untrusted.
- Remove `attorney_review_required` from active generation, tests, UI, and documentation without rewriting already-applied migration history.
- Preserve unrelated worktree changes and deploy only after the phase review is approved.

---

## Task 1: Add failing change-order domain tests and static verification

**Files:**

- Create: `tests/changeOrderTerms.test.js`
- Create: `scripts/verify-change-orders.mjs`
- Modify: `package.json`
- Modify: `tests/contractTerms.test.js`

- [ ] Add red tests for canonical terms, supported price deltas, 50/50 allocation, status effects, and hash invalidation:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChangeOrderTerms,
  splitChangeOrderAmount,
  changeOrderHasProjectEffect,
} from '../src/utils/changeOrderTerms.js';

test('positive additions split cents without losing a cent', () => {
  assert.deepEqual(splitChangeOrderAmount(10001), {
    retainerCents: 5001,
    finalCents: 5000,
  });
});

test('only active change orders affect project scope', () => {
  for (const status of ['draft', 'proposed', 'client_signed', 'creator_signed', 'countersigned', 'awaiting_additional_retainer', 'declined', 'void', 'superseded']) {
    assert.equal(changeOrderHasProjectEffect(status), false);
  }
  assert.equal(changeOrderHasProjectEffect('active'), true);
});

test('price decreases are routed to support', () => {
  assert.throws(() => buildChangeOrderTerms({ priceDeltaCents: -1 }), /support/i);
});
```

- [ ] Change the existing contract test so it asserts active generated terms do not contain the removed attorney-review field.
- [ ] Add `scripts/verify-change-orders.mjs` to check table/RLS/function/function-config/UI/payment/webhook/document requirements and to scan active paths for the removed field. Exclude applied migration history from the active-path assertion.
- [ ] Add:

```json
"test:change-orders": "node --test tests/changeOrderTerms.test.js",
"verify:change-orders": "node scripts/verify-change-orders.mjs"
```

- [ ] Run and confirm the change-order verifier fails before implementation:

```bash
npm run test:change-orders
npm run verify:change-orders
npm run test:contracts
```

- [ ] Commit the red tests:

```bash
git add package.json tests/changeOrderTerms.test.js tests/contractTerms.test.js scripts/verify-change-orders.mjs
git commit -m "test: define protected change order lifecycle"
```

## Task 2: Remove active attorney-review metadata and lock contract immutability

**Files:**

- Modify: `src/utils/contractTerms.js`
- Modify: `tests/contractTerms.test.js`
- Create: `supabase/migrations/20260729130000_lock_contracts_and_remove_review_metadata.sql`
- Modify: `scripts/verify-contract-esign-rebook.mjs`
- Modify: `docs/2026-06-30-codex-video-calls-spec.md`

- [ ] Remove the field from `buildContractTerms` so all newly generated agreements omit it.
- [ ] Add a `before update or delete` contract evidence trigger that rejects changes to `terms`, `content_hash`, `template_version`, parties, project, and accepted proposal after the first signature exists.
- [ ] Add equivalent append-only protections to `contract_signatures`.
- [ ] Remove the field from unsigned QA contract JSON and regenerate its hash/PDF through the normal document path. Do not alter signed records.
- [ ] Make the migration leave signed historical JSON intact while ensuring no active code or rendered UI reads or displays the legacy field.
- [ ] Update the contract verifier to assert future generation omits the field and signed evidence is immutable.
- [ ] Run:

```bash
npm run test:contracts
npm run verify:contracts
npm run verify:change-orders
rg -n "attorney_review_required" src supabase/functions tests scripts
```

- [ ] The final `rg` command must return no active-code matches.
- [ ] Commit:

```bash
git add src/utils/contractTerms.js tests/contractTerms.test.js supabase/migrations/20260729130000_lock_contracts_and_remove_review_metadata.sql scripts/verify-contract-esign-rebook.mjs docs/2026-06-30-codex-video-calls-spec.md
git commit -m "fix: remove active attorney review metadata"
```

## Task 3: Create the change-order evidence and payment schema

**Files:**

- Create: `supabase/migrations/20260729131000_project_change_orders.sql`
- Modify: `supabase/schema.sql`
- Create: `src/utils/changeOrderTerms.js`
- Test: `tests/changeOrderTerms.test.js`
- Test: `scripts/verify-change-orders.mjs`

- [ ] Implement `buildChangeOrderTerms` as a deterministic structured snapshot containing original contract reference, reason, source summary, before/after terms, price delta, responsibilities, dates, revisions, rights, and document version.
- [ ] Create `contract_change_orders` with project/contract/party references, per-contract sequence, public document number, initiator, optional source summary, structured terms, price delta, content hash, PDF reference, status, decline/void/supersession metadata, and timestamps.
- [ ] Enforce:

```sql
check (price_delta_cents >= 0);
unique (contract_id, sequence_number);
unique (document_number);
```

- [ ] Create `change_order_signatures` with signer user/role/name/method, signature reference, consent text, signed hash, IP, user agent, and unique `(change_order_id, signer_role)`.
- [ ] Create `change_order_payments` with immutable added amount, retainer/final amounts, fee snapshot, Stripe PaymentIntent IDs, statuses, transfer IDs/statuses, and audit timestamps. Use one ledger row per positive change order.
- [ ] Create private storage conventions under existing protected document/signature buckets; do not make a public bucket.
- [ ] Add RLS so only project parties and platform admins can read. Mutations occur through hardened RPCs/Edge Functions, not direct authenticated writes.
- [ ] Add append-only triggers for proposed or later change-order terms, all signatures, and successful payment evidence.
- [ ] Add `public.get_project_change_orders(project_id)` returning reduced document/payment state to authorized parties.
- [ ] Add `public.get_project_documents(project_id)` returning the original contract, change orders, agreed summaries, and payment receipt references without issuing storage URLs.
- [ ] Add indexes for project, contract sequence, pending signatures, pending added retainer, outstanding added final, and Stripe intent lookup.
- [ ] Update `supabase/schema.sql`.
- [ ] Run:

```bash
npm run test:change-orders
npm run verify:change-orders
```

- [ ] Commit:

```bash
git add supabase/migrations/20260729131000_project_change_orders.sql supabase/schema.sql src/utils/changeOrderTerms.js tests/changeOrderTerms.test.js scripts/verify-change-orders.mjs
git commit -m "feat: add immutable change order evidence model"
```

## Task 4: Add draft, proposal, decline, void, and status transition RPCs

**Files:**

- Create: `supabase/migrations/20260729132000_change_order_workflow.sql`
- Modify: `scripts/verify-change-orders.mjs`

- [ ] Add `create_change_order_draft(project_id, source_summary_id, reason, changes, price_delta_cents)`:

  - authenticate the caller;
  - require the caller to be a project party;
  - require the original contract to be countersigned;
  - require both parties to pass `require_verified_project_parties`;
  - allow only zero or positive cents;
  - validate structured change keys and lengths;
  - allocate the next sequence under an advisory lock;
  - snapshot canonical terms and compute `digest(terms::text, 'sha256')`;
  - derive party IDs and original terms from the database.

- [ ] Add `propose_change_order(change_order_id)` to move only `draft → proposed` after complete fields and a successfully rendered PDF exist.
- [ ] Add `decline_change_order(change_order_id, reason)` for the non-initiating project party, with a required reason and no effect on the original contract.
- [ ] Add `void_change_order(change_order_id, reason)` for the initiator before activation. A proposed or signed document becomes immutable evidence with `void` status.
- [ ] Add `supersede_change_order(change_order_id, reason)` that creates a new draft sequence rather than editing the signed/proposed row.
- [ ] Add `refresh_change_order_signature_status(change_order_id)` as service-only:

  - one signature maps to the signer-specific state;
  - both signatures plus zero price maps to `active`;
  - both signatures plus positive price maps to `awaiting_additional_retainer`;
  - no other function can mark a change order active.

- [ ] Add notifications for proposed, signed, countersigned, declined, voided, and active transitions.
- [ ] Add stable conflict/error codes for UI handling.
- [ ] Run:

```bash
npm run verify:change-orders
npm run build
```

- [ ] Commit:

```bash
git add supabase/migrations/20260729132000_change_order_workflow.sql scripts/verify-change-orders.mjs
git commit -m "feat: add change order workflow transitions"
```

## Task 5: Generate, store, sign, and download change-order PDFs

**Files:**

- Create: `supabase/functions/_shared/changeOrderPdfStorage.ts`
- Create: `supabase/functions/generate-change-order/index.ts`
- Create: `supabase/functions/sign-change-order/index.ts`
- Modify: `supabase/functions/create-storage-signed-url/index.ts`
- Modify: `supabase/config.toml`
- Create: `src/utils/changeOrderPdf.js`
- Modify: `scripts/verify-change-orders.mjs`

- [ ] Reuse the established contract PDF typography, private storage reference parser, signature rendering, and audit behavior without sharing mutable contract state.
- [ ] Render the document number, original agreement number/date, reason, exact before/after deltas, price increase, payment schedule, unchanged-terms statement, content hash, and signatures.
- [ ] Make `generate-change-order` authenticate a project party, render from the trusted database snapshot, store the private proposed PDF, and return reduced metadata.
- [ ] Make `sign-change-order` follow the contract signature controls:

  - authenticate and derive signer role;
  - require the signer and other project party to remain identity verified at activation;
  - require the browser hash to equal the database hash;
  - allow drawn, typed, or owned saved signature;
  - write one idempotent signature per role/hash;
  - refresh state and regenerate the countersigned PDF.

- [ ] Reject signatures for draft, declined, void, superseded, or active records.
- [ ] Extend `create-storage-signed-url` to authorize change-order document paths through project membership and return short-lived URLs. Never accept an arbitrary bucket/path without record-level authorization.
- [ ] Add function entries for `generate-change-order` and `sign-change-order`.
- [ ] Run:

```bash
npm run verify:change-orders
npm run verify:contracts
npm run build
```

- [ ] Commit:

```bash
git add supabase/functions/_shared/changeOrderPdfStorage.ts supabase/functions/generate-change-order/index.ts supabase/functions/sign-change-order/index.ts supabase/functions/create-storage-signed-url/index.ts supabase/config.toml src/utils/changeOrderPdf.js scripts/verify-change-orders.mjs
git commit -m "feat: generate and sign change order documents"
```

## Task 6: Add the independent 50/50 change-order payment flow

**Files:**

- Create: `supabase/functions/create-change-order-payment/index.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Modify: `supabase/functions/release-payment/index.ts`
- Modify: `supabase/config.toml`
- Modify: `scripts/verify-release-payment-security.mjs`
- Modify: `scripts/verify-margin-protection.mjs`
- Modify: `scripts/verify-change-orders.mjs`

- [ ] Make `create-change-order-payment` accept only `changeOrderId` and phase (`retainer` or `final`). Derive client, creator, project, amount, fee percentages, and Stripe account from the countersigned database snapshot.
- [ ] Require:

  - authenticated paying client;
  - both identities currently verified;
  - `awaiting_additional_retainer` for retainer creation;
  - `active` plus project `delivered` or `approved` for final creation;
  - no already paid/released phase.

- [ ] Calculate the split as:

```ts
const retainerAmountCents = Math.ceil(priceDeltaCents / 2);
const finalAmountCents = priceDeltaCents - retainerAmountCents;
```

- [ ] Apply the same creator/client fee rules as the original project through one shared fee helper. Charge any change-order client booking fee only once, on the added final, matching the original payment policy.
- [ ] Create Stripe intents with:

```ts
metadata: {
  paymentFlow: 'change_order',
  paymentType: `change_order_${phase}`,
  changeOrderId,
  projectId,
}
```

- [ ] Use idempotency key `cb_change_order_{id}_{phase}` and reuse a pending usable intent.
- [ ] Extend the verified Stripe webhook so:

  - a successful added retainer marks the ledger paid and atomically activates the change order;
  - a successful added final marks that phase paid;
  - failure/cancel events update only the matching ledger phase;
  - Stripe amount/currency/metadata must match the trusted ledger before state changes;
  - event IDs remain idempotent.

- [ ] Extend `release-payment` so original project proceeds and each paid change-order phase are transferred from their own source charges. Record each transfer independently and never add the change amount to the immutable original transaction.
- [ ] Require the original final and every active positive change-order final to be paid before project completion/release can finish.
- [ ] Preserve retry safety: an already recorded transfer ID must never be recreated.
- [ ] Add `[functions.create-change-order-payment]` to `supabase/config.toml`.
- [ ] Run:

```bash
npm run verify:release-payment-security
npm run verify:margin-protection
npm run verify:change-orders
npm run build
```

- [ ] Commit:

```bash
git add supabase/functions/create-change-order-payment/index.ts supabase/functions/stripe-webhook/index.ts supabase/functions/release-payment/index.ts supabase/config.toml scripts/verify-release-payment-security.mjs scripts/verify-margin-protection.mjs scripts/verify-change-orders.mjs
git commit -m "feat: fund change orders with protected payments"
```

## Task 7: Build the Project Documents and change-order user experience

**Files:**

- Create: `src/components/change-orders/ChangeOrderPanel.jsx`
- Create: `src/components/change-orders/ChangeOrderForm.jsx`
- Create: `src/components/change-orders/ChangeOrderSignModal.jsx`
- Create: `src/components/change-orders/ChangeOrderPayment.jsx`
- Create: `src/components/ProjectDocuments.jsx`
- Modify: `src/components/calls/CallSummary.jsx`
- Modify: `src/pages/CheckoutPage.jsx`
- Modify: `src/pages/ProjectBoard.jsx`
- Modify: `src/pages/CreatorProfilePage.jsx`
- Modify: `scripts/verify-change-orders.mjs`

- [ ] Build a structured draft form with explicit material-change categories, before/after values, reason, price delta, date/responsibility fields, and no negative-price option.
- [ ] Permit either project party to draft. Show that draft, declined, and one-party-signed records do not alter the project.
- [ ] Add “Create change order” to an agreed Call Summary. Prefill only selected human-confirmed summary decisions and source-summary ID; do not automatically create or propose binding terms.
- [ ] Build a review/sign modal that shows the exact hash-bound terms and independent signature status.
- [ ] Build the added-retainer payment surface after both signatures and display “New scope is not active until this payment succeeds.”
- [ ] Extend checkout/delivery payment UI to list the original final plus every outstanding change-order final as separate protected charges. Confirm each server-created PaymentIntent and refresh the ledger after success.
- [ ] Build `ProjectDocuments` with the original agreement, change orders in sequence, agreed summaries, and payment receipts. Generate signed URLs only when the user selects a document.
- [ ] Correct public profile copy that implies custom scope can be informally negotiated after a call. State that material changes use a signed change order.
- [ ] Add accessible loading, empty, retry, decline, failed-payment, and support-routed decrease states for desktop and mobile.
- [ ] Integrate `ProjectDocuments` and `ChangeOrderPanel` into `ProjectBoard`.
- [ ] Run:

```bash
npm run verify:change-orders
npm run build
```

- [ ] Commit:

```bash
git add src/components/change-orders/ChangeOrderPanel.jsx src/components/change-orders/ChangeOrderForm.jsx src/components/change-orders/ChangeOrderSignModal.jsx src/components/change-orders/ChangeOrderPayment.jsx src/components/ProjectDocuments.jsx src/components/calls/CallSummary.jsx src/pages/CheckoutPage.jsx src/pages/ProjectBoard.jsx src/pages/CreatorProfilePage.jsx scripts/verify-change-orders.mjs
git commit -m "feat: add project documents and change order experience"
```

## Task 8: Add first-project education, lifecycle locks, and notifications

**Files:**

- Create: `supabase/migrations/20260729133000_project_protection_education.sql`
- Create: `src/components/ProjectProtectionGuide.jsx`
- Modify: `src/components/ProjectTimeline.jsx`
- Modify: `src/pages/ProjectBoard.jsx`
- Modify: `src/components/ContractAction.jsx`
- Modify: `src/components/ContractView.jsx`
- Modify: `src/components/calls/ProjectCallsPanel.jsx`
- Modify: `src/components/calls/CallSummary.jsx`
- Modify: `src/pages/CheckoutPage.jsx`
- Modify: `src/components/DisputeModal.jsx`
- Modify: `scripts/verify-change-orders.mjs`

- [ ] Create `project_guide_acknowledgments` with project, user, role, guide version, and timestamp. RLS permits party reads and an RPC writes only the caller's acknowledgment.
- [ ] Show the role-specific guide on the first Project Board visit after proposal acceptance. Do not treat educational acknowledgment as legal, recording, or biometric consent.
- [ ] Add permanent “How this project works” access so the guide can always be reopened.
- [ ] Extend `ProjectTimeline` to compute the approved lifecycle from trusted records:

  - proposal accepted;
  - identities/signatures;
  - original retainer;
  - kickoff call;
  - agreed summary;
  - pending/active change order;
  - production;
  - delivery;
  - original and added final payments.

- [ ] Every locked stage must show the exact prerequisite and next action. Never infer completion from a client-only flag.
- [ ] Add concise contextual explanations to contract, checkout, call, summary, change-order, delivery, revision, dispute, and payment surfaces.
- [ ] Add in-app notifications and existing transactional-email hooks for proposal, signature, retainer, call availability, summary, change-order, added payment, delivery, and final-payment transitions.
- [ ] Keep the platform AI optional; all rules must be visible in the deterministic UI.
- [ ] Run:

```bash
npm run verify:notifications
npm run verify:change-orders
npm run build
```

- [ ] Commit:

```bash
git add supabase/migrations/20260729133000_project_protection_education.sql src/components/ProjectProtectionGuide.jsx src/components/ProjectTimeline.jsx src/pages/ProjectBoard.jsx src/components/ContractAction.jsx src/components/ContractView.jsx src/components/calls/ProjectCallsPanel.jsx src/components/calls/CallSummary.jsx src/pages/CheckoutPage.jsx src/components/DisputeModal.jsx scripts/verify-change-orders.mjs
git commit -m "feat: explain protected project lifecycle"
```

## Task 9: Verify end to end, stage rollout, and stop for deployment approval

**Files:**

- Create: `scripts/verify-change-orders-live.mjs`
- Modify: `scripts/verify-booking-e2e.mjs`
- Modify: `scripts/verify-project-lifecycle.mjs`
- Modify: `scripts/verify-video-calls.mjs`
- Modify: `scripts/verify-launch-sweep.mjs`
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-07-29-contract-call-change-order-design.md`

- [ ] Add a live QA verifier for project-party RLS, draft/propose/sign states, zero-dollar activation, positive added-retainer activation, added-final requirement, price tampering, hash invalidation, private downloads, and reason-required decline/void actions.
- [ ] Extend the booking flow test to assert:

```text
accepted proposal
→ generated agreement
→ both verified signatures
→ original 50% retainer
→ kickoff call
→ agreed summary
→ countersigned change order
→ added 50% retainer
→ delivery
→ original final plus added final
→ independent releases
```

- [ ] Add change-order verification to the launch sweep.
- [ ] Run the complete pre-deployment evidence set:

```bash
npm run test:contracts
npm run test:change-orders
npm run verify:contracts
npm run verify:change-orders
npm run verify:project-lifecycle
npm run verify:video-calls
npm run verify:release-payment-security
npm run verify:notifications
npm run build
npm audit
git diff --check
```

- [ ] Confirm no active attorney-review references:

```bash
rg -n "attorney_review_required|unfinished attorney|attorney review required" src supabase/functions tests scripts docs --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**'
```

- [ ] Confirm migrations and worktree state without changing production:

```bash
supabase migration list
git status --short
```

- [ ] Present a Fable evidence report covering contract, payment, identity, call, document, notification, and RLS trust surfaces.
- [ ] Stop for approval before applying migrations or deploying functions.
- [ ] After approval, deploy migrations first, then document/sign/payment/storage/webhook/release functions, then deploy the frontend.
- [ ] Run the live verifier with two QA accounts and Stripe test mode, including one no-cost and one positive-price change order.
- [ ] Download and visually compare the original contract and final change-order PDFs. Confirm the original bytes/hash remain unchanged.
- [ ] Record the verified implementation and rollout date in the approved design spec.
- [ ] Commit:

```bash
git add package.json scripts/verify-change-orders-live.mjs scripts/verify-booking-e2e.mjs scripts/verify-project-lifecycle.mjs scripts/verify-video-calls.mjs scripts/verify-launch-sweep.mjs docs/superpowers/specs/2026-07-29-contract-call-change-order-design.md
git commit -m "test: verify protected change order lifecycle"
```

## Phase Acceptance Gate

Contract and change-order work is complete only when local and live QA prove that the original agreement never changes, identity and signature gates cannot be bypassed, no-cost changes activate only after both signatures, positive changes activate only after the added retainer, all added final amounts are paid before completion, each provider charge/transfer is independently auditable, both parties can access private records, and active product surfaces contain no attorney-review requirement.
