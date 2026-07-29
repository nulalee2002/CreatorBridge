# CreatorBridge Contract, Call, and Change Order Design

**Date:** 2026-07-29  
**Status:** Approved product design  
**Scope:** Generated project agreements, signatures, retainer gating, Zoom kickoff calls, agreed call summaries, material scope changes, change-order payments, project education, and document access.

## Outcome

CreatorBridge will protect each booked project with this locked lifecycle:

**Accepted proposal → generated contract → required identity verification → both signatures → 50% retainer → Zoom kickoff call → agreed call summary → change order only when material terms changed → additional payment when applicable → production begins or continues.**

The original signed agreement is immutable. Conversation does not silently rewrite it. CreatorBridge generates, stores, and exposes the original agreement and every change order to both project parties.

There are no real production users to migrate. QA projects and contracts may be recreated for clean end-to-end testing.

## Current State

The repository already implements:

- Contract generation after an accepted proposal with a selected package.
- A structured contract snapshot containing parties, project scope, deliverables, timeline, price, revisions, usage, cancellation, disputes, and communication terms.
- SHA-256 content hashing.
- Drawn, typed, and saved electronic signatures.
- Signature audit records with role, legal name, timestamp, IP, device, and signed content hash.
- Regenerated private PDFs containing recorded signatures.
- Both-signatures-before-retainer checkout gating.
- Retainer-paid and countersigned-contract gates for project-call scheduling.
- Recorded Zoom Video SDK project calls with consent, transcript, shared summary, attributed revisions, and both-party agreement.

The repository does not implement formal contract amendments or change orders. Current call summaries can document decisions but cannot legally or operationally change the contract. Some public copy saying custom scopes are negotiable after the first call is too loose and must be corrected.

## Chosen Approach

CreatorBridge will add immutable, platform-generated change orders linked to the original agreement and project. Call summaries may help prefill a draft, but only a separately approved and signed change order alters material project terms.

This approach was chosen over:

1. **Rewrite the original contract after the call:** Rejected because it breaks signature and hash evidence.
2. **Treat an agreed call summary as the amendment:** Rejected because summaries mix ordinary clarifications and contractual changes.
3. **Create a separate versioned change order:** Chosen because it preserves the original agreement and creates a clear, auditable delta.

## Material Change Rule

Ordinary creative clarification remains in the agreed call summary. Examples include references, aesthetic preferences, shot priorities, communication details, and explanations that do not alter either party's obligations.

A change order is required when the conversation changes one or more material terms:

- Total price or funded amount.
- Included deliverables or quantities.
- Usage or licensing rights.
- Included revisions.
- Production, shoot, or delivery dates.
- Location or travel obligations.
- Crew, equipment, or production responsibilities.
- Source/raw-file obligations.
- Cancellation or delivery obligations.
- Another term that changes what a party must provide, pay, or accept.

The interface will explain the distinction and provide a “Create change order” action from an agreed call summary or the Project Documents area.

## Change Order Model

Each change order belongs to one project and one original contract and receives an immutable sequence and document number, for example `CB-2026-ABC123-CO-01`.

Store:

- Project, original contract, client, creator listing, and creator user identifiers.
- Sequence number and public document number.
- Initiating user and optional source call-summary identifier.
- Reason for the change.
- Structured original-term references.
- Structured proposed changes.
- Added deliverables, revised dates, revisions, usage, and responsibilities.
- Price delta in cents.
- Template version, terms snapshot, and SHA-256 content hash.
- Private PDF reference.
- Status and timestamps.
- Client and creator signature timestamps.
- Additional-retainer and additional-final payment state when price increases.
- Void, decline, expiry, and supersession metadata.

Recommended statuses:

- `draft`
- `proposed`
- `client_signed`
- `creator_signed`
- `countersigned`
- `awaiting_additional_retainer`
- `active`
- `declined`
- `void`
- `superseded`

Change-order signatures use their own table and reference the exact change-order content hash. The existing saved-signature system may be reused securely.

## Initiation and Approval

Either project party may create a draft. The initiator completes the structured changes and proposes the document. Both parties may review the same rendered terms and sign in either order.

A draft or one-party-signed document has no effect on the original scope. Declining or voiding a change order leaves the original agreement unchanged. Editing a proposed or signed change requires voiding that version and generating a new hashed version; signatures never carry forward to changed content.

Both signers must remain identity verified. A duplicate-restricted, suspended, or reverification-required user cannot sign or activate a change order.

## Payment

The original project's 50/50 protected-payment structure remains unchanged.

The first self-service release supports:

- No-cost material changes.
- Positive price increases.

No-cost changes become active when both parties sign.

For a price increase, the change-order amount uses its own 50/50 protected-payment record:

- Both signatures are required first.
- The client pays 50% of the added amount as the additional retainer.
- The expanded scope becomes active only after that payment succeeds.
- The remaining 50% is added to the amount due at delivery and approval.
- Creator and client platform fees follow the same project fee rules unless a later approved business rule changes them.

Self-service price reductions, refunds, or credits are deferred because they can conflict with an already paid retainer and cancellation rules. Those cases route to documented support resolution in the first release.

Payment creation must be idempotent and server-authoritative. The trusted change-order amount comes from the countersigned database snapshot, never from the browser request.

## Call Summary Relationship

The call summary remains a shared, editable, versioned record. Both parties may correct it, and both must agree before it becomes an agreed summary.

Agreement on a call summary means the written summary accurately reflects the conversation. It does not amend the project contract. When a summary contains a material change, either party selects the relevant decisions and starts a change-order draft. The change order remains separately reviewed, signed, and funded.

The summary should display one of:

- “No contract changes identified.”
- “Change order draft created.”
- “Change order active.”

The platform must never use AI output alone to create binding terms. AI may propose a structured draft from the transcript, but a person must review it before proposal and both parties must sign.

## Generated Documents and Access

CreatorBridge generates:

- The original production agreement.
- The final countersigned agreement PDF.
- Every proposed and countersigned change-order PDF.
- Payment receipts and status records.

Both parties receive read and download access through short-lived signed URLs from private storage. Project documents remain available from a shared Project Documents area. Authorized administration gains access only through existing platform-administration and dispute/support rules.

The Project Documents area shows:

- Original agreement and signature status.
- Change orders in sequence with status and amount.
- Agreed call summaries and source call.
- Retainer, added-payment, and final-payment receipts.
- Delivery and approval records when available.

Historical signed documents are append-only. A later change order never overwrites an earlier PDF.

## Attorney Review Metadata Removal

Implementation must remove every occurrence of `attorney_review_required` and equivalent unfinished-attorney-review warnings from the active platform:

- Generated contract terms.
- Change-order terms and templates.
- UI copy.
- Edge Functions.
- Database migrations or current-schema definitions where safely superseded.
- Tests and scripts.
- Active product documentation and support knowledge.

Historical migration files should not be destructively rewritten if they have already been applied. A new migration may remove stored fields or generate future documents without them. Repository search and product verification must demonstrate that no active code path, generated document, or user-facing surface treats attorney review as a requirement or blocker.

## Project Education

Essential rules must be visible without asking the platform AI.

### First-Time Project Protection Guide

The first project visit after proposal acceptance shows an acknowledged, role-specific guide.

Client guidance explains:

- CreatorBridge generates the agreement.
- Both identities and signatures are required.
- The 50% retainer unlocks the kickoff call.
- Call summaries document discussions.
- Material changes require a signed change order.
- Added work may require an added retainer.
- Final payment follows delivery.

Creator guidance explains:

- Review and sign the generated agreement.
- Do not start before the retainer is confirmed.
- Use the kickoff call to confirm project details.
- Do not perform added work until its change order is active.
- Keep communication, delivery, and approval on CreatorBridge.

The educational acknowledgment does not replace contract, recording, or biometric consent.

### Persistent Lifecycle

The Project Board shows a permanent lifecycle timeline:

- Proposal accepted.
- Agreement awaiting identities/signatures.
- Retainer awaiting payment.
- Kickoff call available.
- Call summary awaiting agreement.
- Change order awaiting action, when applicable.
- Production underway.
- Delivery submitted.
- Final payment.

Locked stages explain the precise prerequisite. A permanent “How this project works” action reopens the full guide.

### Contextual Explanations

Contract, checkout, call, summary, change-order, delivery, revision, dispute, and payment surfaces display concise rules at the moment they apply. Important state transitions also create in-app notifications and concise transactional emails with direct project links.

The platform AI remains optional assistance, not the source of truth.

## Security and Authorization

- Only project parties and authorized administrators may read project contracts, change orders, signatures, and private PDFs.
- All creation, proposal, signing, voiding, payment, and activation actions use authenticated Edge Functions or hardened RPCs.
- RLS protects direct reads and rejects cross-project access.
- Content hashes bind signatures to exact structured terms.
- Payment amounts are derived server-side.
- Webhooks are signature-verified and idempotent.
- Call scheduling and token generation continue to require countersigned contract, paid retainer, and verified parties.
- A change order cannot retroactively legitimize work started before activation.

## Failure Handling

- PDF failure leaves the structured document recoverable and unsigned.
- A signature retry is idempotent for the same signer and content hash.
- Editing after proposal voids the prior version and requires new signatures.
- Payment failure leaves an increased-price change order countersigned but inactive.
- A declined change order preserves the original scope.
- Provider or email failure never changes document or payment state.
- A call-summary disagreement does not modify the contract or block the existing project; it remains visibly unresolved.

## Testing and Acceptance

Automated and browser verification must demonstrate:

1. Contract generation follows an accepted proposal and selected package.
2. Unverified parties may review but cannot sign.
3. Retainer payment cannot begin until both verified parties sign.
4. Project calls cannot be scheduled or joined before the countersigned contract and paid retainer.
5. Ordinary call-summary edits do not change contract terms.
6. Either party can draft a change order.
7. A draft, declined, or one-party-signed change order has no project effect.
8. A no-cost change becomes active only after both signatures.
9. A positive-price change becomes active only after both signatures and the additional 50% retainer.
10. The remaining added 50% is included in the delivery-stage amount.
11. Browser-supplied price tampering is rejected.
12. Editing proposed content changes the hash and invalidates prior signatures.
13. Both parties can view and download the original agreement, change orders, summaries, and receipts; unrelated users cannot.
14. The project timeline reports the correct current stage and lock reason.
15. Role-specific education appears once, records acknowledgment, and remains reopenable.
16. Direct API calls cannot bypass identity, signature, payment, or call gates.
17. Generated documents and active UI contain no `attorney_review_required` field or warning.
18. Desktop and mobile flows pass for client, creator, empty, pending, declined, failed-payment, and completed states.

## Deferred

- Self-service price reductions and partial refunds.
- Binding changes created automatically by AI.
- Rewriting original signed agreements.
- Treating a call summary as a contract amendment.
- Off-platform signatures, payment, or scope changes.

