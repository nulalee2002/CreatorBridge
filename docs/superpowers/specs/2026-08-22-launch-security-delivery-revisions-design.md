# CreatorBridge Launch Security, Delivery, and Revision Design

**Date:** 2026-08-22  
**Status:** Written design awaiting final user review  
**Scope:** Launch security findings, two-included-revision enforcement, repeatable $50 paid revisions, final-deliverable submission, project-scoped review, five-day approval timing, final-payment automation, notifications, storage retention, public-data cleanup, and launch verification.

## Outcome

CreatorBridge will launch with one server-authoritative project completion flow:

**Creator submits finished deliverables → client receives in-app and email notice → five-day review begins → client approves, disputes, or uses an available revision → a revision pauses review → creator resubmits a new delivery version → a fresh five-day review begins → approval or no response triggers the final-payment attempt → project completes only after Stripe confirms payment.**

Every project includes exactly two revisions. After those two are consumed, a client may buy any number of additional revisions for exactly $50 each. Each successful $50 payment grants one revision entitlement and the entitlement is consumed atomically when the client submits that revision request.

Finished photo and video deliverables may be uploaded directly to private Supabase Storage, up to 5 GB combined per delivery version, or included as external Google Drive, Dropbox, or comparable share links. External files use the customer's or creator's external storage and do not count toward the CreatorBridge upload limit. Bunny remains reserved for creator profile media and introduction videos. Raw working files are not part of CreatorBridge final delivery.

The security and audit work is part of this launch program, not an unrelated backlog. Payment-trusted fields, creator verification fields, administrative access, public seed content, support configuration, rate limiting, frontend loading, and repository-secret handling all receive explicit treatment below.

There are no production customers or creators to migrate. Existing QA and seed records may be updated or recreated, but destructive production operations still require verification and controlled rollout.

## Verified Current State

The local main branch matched GitHub main at commit `18752e3` when the audits were performed. The project build, 265 structural platform checks, 33 unit tests, contract verification, change-order verification, video-call safety verification, creator readiness verification, collaboration verification, messaging checks, and dependency audit passed. The structural checks are useful but do not replace browser, live database, Stripe test-mode, email, and Storage acceptance testing. The repository does not have a committed Playwright or Cypress end-to-end suite.

The existing platform already provides a substantial foundation: authentication, onboarding, identity verification, creator review, creator discovery, briefs, proposals, generated agreements, electronic signatures, 50/50 project payments, change orders, Zoom calls, protected messaging, support, creator collaboration, administration, finance, analytics, and legal policy surfaces. This design extends those systems instead of replacing them.

The current delivery and revision implementation is incomplete:

- `ProjectBoard.jsx` requires an external URL, displays an unwired file picker, advertises a 200 MB limit, and overwrites one `delivery_link` and `delivery_notes` pair on the project.
- The `project-deliveries` bucket has a 500 MB per-object limit, no active upload flow, incomplete client access, and no cleanup job despite seven-day deletion copy.
- Delivery email exists, but the required in-app delivery notification and 48-hour and 24-hour review reminders do not.
- Messages are grouped by participant pair, so multiple projects between the same client and creator can share one inbox thread.
- Two revisions are recognized in part of Project Board, but package defaults, package editing, seed data, calculators, public copy, and contracts still allow varying counts.
- The current paid-revision action does not collect $50, create an entitlement, or unlock a request.
- Active review behavior and user-facing language still use 72 hours in multiple surfaces.
- The browser mutates local project status after a deadline, but no scheduled server process completes the review.
- The final 50% is not collected in advance, so automatic release cannot occur until Stripe successfully charges the client.

The security audit also verified that broad self-update policies allow users to change columns trusted by payment and verification logic. Git history contains a deleted environment file with Stripe test credentials, a webhook secret, and a Supabase anonymous key. The current source tree and frontend bundle do not expose secret keys.

A prior live check encountered a Supabase REST HTTP 522 and browser network/CORS failures while Supabase reported an API incident. Because CreatorBridge has no production users, an empty directory is expected; a timed-out API request is not. Remote health and migration alignment must be rechecked before deployment rather than assuming that incident remains active or resolved.

## Chosen Architecture and Rejected Alternatives

### Durable project records instead of patching the project row

CreatorBridge will add immutable delivery, delivery-item, revision-request, and revision-purchase records. The existing single delivery link may remain only as a temporary compatibility read during migration.

Patching more fields onto the project row was rejected because it cannot preserve submission history, distinguish ordinary chat links from formal delivery, safely restart review after resubmission, or provide an auditable approval record. Embedding or rebuilding Frame.io was rejected for this release because it adds provider dependency and review complexity that the required download-and-review workflow does not need.

### Dedicated paid-revision commerce instead of change orders

Additional revisions will use a dedicated purchase and entitlement flow. Reusing change orders was rejected because a fixed-price revision should not require a new scope document, two signatures, and a split retainer. A generic add-on storefront was rejected because no other add-on type is currently required.

### Server guards and trusted commands instead of browser enforcement

Sensitive profile and listing fields will be protected by database guards and changed only through trusted functions. Hiding form controls was rejected because direct API calls would still bypass it. Splitting every protected column into new private tables is stronger in isolation but would create a broad, high-risk migration across mature code. Launch hardening will therefore use explicit column guards, narrow grants where practical, and trusted service/admin commands. A later schema-separation project may further reduce the public-table surface.

### Automatic final-payment attempt instead of false automatic release

The initial payment flow will obtain explicit consent and a reusable Stripe payment method for the final project balance. Approval or five-day no-response will cause a scheduled server process to attempt the final charge. If Stripe requires customer authentication or the charge fails, the project enters `final_payment_attention`; it does not claim the creator was paid. Keeping final payment purely manual was rejected because it contradicts the promised automatic completion flow. Pre-collecting and holding the entire project total was rejected because it would materially alter the approved 50/50 payment design.

## Workstream 1: Launch Security and Authorization

### Protected data

A new migration will prevent ordinary authenticated updates to system-managed fields. The exact guarded set will be derived from current schema use and must include at least:

- Creator fee and history inputs such as `completed_projects` and `next_project_fee_pct`.
- Client fee-waiver and referral-reward state such as `first_booking_fee_waived` and `next_booking_fee_waived`.
- Creator trust state such as `verified`, verification status, review status, approval state, and suspension state.
- Stripe Connect identifiers, onboarding state, payout-readiness state, and payment-derived project counters.
- Administrative role, moderation, duplicate-account, identity-review, and other privileged trust fields.

Ordinary users may continue updating legitimate self-service profile and package fields. Service-role webhooks and narrowly scoped security-definer RPCs may change protected fields only after verifying their event, actor, and expected prior state. All RPC execution grants will be reviewed so `PUBLIC` and `anon` cannot invoke privileged transitions.

Payment functions will continue to derive totals, fee tiers, waivers, creator identifiers, and entitlements from trusted database rows. Browser-provided amounts and fee percentages are advisory input at most and never authoritative.

### Administrative routing

Administrative pages will use a dedicated `AdminRequired` route guard that verifies current server-derived admin authorization before rendering the admin shell. Page-level RPC authorization remains defense in depth. A client-role authentication wrapper alone is not sufficient.

### Repository credentials

The exposed historical Stripe test keys and webhook secret will be rotated. The Supabase anonymous key will be reviewed because it is designed to be public but should still be replaced if the associated project or policy posture warrants it. Live keys must never be committed.

Removing secrets from public Git history requires a coordinated history rewrite and force push or making the repository private. That operation is intentionally separated from code implementation because it disrupts existing clones and cannot be safely inferred from a general fix request. A runbook will identify the commits and files without reproducing secret values, create a backup reference, perform a verified history rewrite after explicit approval, force-push the rewritten refs, and instruct all clone owners to re-clone.

### Distributed rate limiting

The current process-memory rate limiter will be replaced on payment, identity, messaging, support, AI, and notification trust surfaces with a database-backed or otherwise shared provider-backed limit. Limits will use a privacy-conscious hash of the relevant user, IP, and action key, enforce expiry, and fail closed for high-risk payment and identity commands. Low-risk informational functions may fail with a controlled service-unavailable response when the limiter is unavailable.

## Workstream 2: Revision Policy and Commerce

### Canonical rule

The platform constants are:

- Included revisions per project: `2`.
- Additional revision client price: `5000` cents.
- Additional revisions available: unlimited purchases, one entitlement per successful purchase.
- Client booking fee on an additional revision: `0` cents.
- Creator platform fee: the creator's current trusted tier, deducted within the $50 charge.

The client therefore pays exactly $50. At the current 10%, 8%, and 6% creator tiers, the creator portion is $45, $46, or $47 and the CreatorBridge portion is $5, $4, or $3. Credits and waiver fields do not reduce the fixed revision price unless a later approved business rule explicitly adds that behavior.

### Package and contract normalization

Package creation and editing will no longer expose a revision-count field. All package reads and writes normalize included revisions to two. A database constraint and server-side write path enforce the rule. Existing package and QA rows are migrated to two. Calculators, seed data, public package cards, generated contracts, change orders, legal/help text, chatbot answers, notification copy, and email templates all use “two included revisions.” “Unlimited revisions” and conflicting 1, 3, 5, or 10 revision language is removed from active product surfaces.

Existing signed contracts remain immutable. For projects already covered by a signed agreement, its signed snapshot governs unless both parties execute an applicable change order. Because there are no production users, the launch migration is expected to affect only QA or seed records.

### Data model

`project_revision_purchases` stores the project, client, creator, $50 gross amount, creator fee rate and amount snapshot, creator net amount, Stripe PaymentIntent, idempotency key, payment status, entitlement status, consumed request identifier, and timestamps.

`project_revision_requests` stores the project, requesting client, source type (`included` or `paid`), included ordinal or paid-purchase identifier, client instructions, delivery version being reviewed, status, and timestamps.

A server command creates the Stripe PaymentIntent from the trusted project and creator records. The Stripe webhook records success idempotently and grants exactly one entitlement. A separate transactional RPC locks the project and relevant entitlement, verifies the active review state and client identity, consumes either the next included revision or the oldest paid entitlement, creates the request, pauses review, and moves the project to revision state. Retried requests return the original result and cannot consume twice.

The UI shows “2 of 2 included revisions remaining” initially. After included revisions are exhausted, the request action is locked and explains the $50 all-in price. A successful purchase unlocks one request; the client may purchase another before or after using an entitlement, and unused paid entitlements remain attached to that project only.

Paid revisions do not modify the signed project scope, delivery quantity, usage rights, or deadline beyond the revision cycle. Material scope changes still use the existing signed change-order system.

## Workstream 3: Final Delivery and Review

### Project-scoped conversation

Every active project receives or resolves to one project conversation. The inbox groups project conversations by project identifier rather than participant pair. The same client and creator may therefore have separate threads for separate projects. Non-project conversations may continue using their existing conversation identity.

Formal deliveries appear as pinned system cards in the project conversation. A normal chat message may contain a permitted Drive or Dropbox link, but it does not create a delivery, notify the payment workflow, or start review. The creator must use the “Submit final deliverables” action.

### Delivery records

`project_deliveries` is append-only and stores the project, monotonically increasing version, submitting creator, message, submission timestamp, review start, review deadline, reminder timestamps, review status, approval source, approval timestamp, superseded timestamp, dispute state, and completion metadata.

`project_delivery_items` stores each direct file or external link, its display name, media type, byte size when known, storage bucket/path or normalized external URL, checksum when available, upload completion state, and sort order.

Supported direct uploads are finished photo, video, audio, archive, and common document deliverables appropriate to the signed project. Executables and unsafe content types are rejected. “Raw files” are excluded by product policy; the interface states that CreatorBridge stores final deliverables only. If a signed change order explicitly requires source material, it must be delivered through an approved external storage link in the first release rather than silently expanding CreatorBridge storage policy.

### Upload and access

Direct delivery uploads use Supabase resumable upload support and a private bucket. The combined completed file size for one delivery version may not exceed 5 GB, and no individual file may exceed that same limit. Size is validated before upload where available and again server-side before the delivery can be finalized. External links do not count toward the limit.

Storage paths are server-issued and scoped to the project and delivery version. Only the project client, project creator, and an authorized administrator handling support or a dispute may receive short-lived signed download URLs. Storage policies do not rely solely on the uploader's ownership. Incomplete multipart or resumable uploads are cleaned after a short expiry.

Bunny Stream continues to handle creator profile introduction videos and related profile media only. It is not a project-delivery store.

### Submission and immutable versioning

The creator may combine direct files and external links in one draft. The server finalizes a delivery only after at least one valid completed item exists. Finalization is idempotent, creates the immutable version, pins the conversation card, changes the project to review state, records the server deadline, and enqueues notifications.

A delivery cannot be edited after submission. Corrections and revision responses create a new version. The previous version remains visible to both parties as superseded history until its retention window permits deletion.

### Five-day review state machine

The review period is five calendar days, represented as 120 hours from the server submission timestamp. The deadline is stored in UTC and displayed in the viewer's local time.

During active review, the client may:

- Approve the delivery.
- Request an available included or paid revision.
- Open a dispute through the existing protected dispute path.
- Download or follow the delivered items.

A revision request or dispute atomically pauses review and records the remaining time for audit, but a creator's valid resubmission begins a new full five-day review rather than resuming the old remainder. The new version supersedes the prior version. A withdrawn or rejected dispute does not silently complete a project; the server resumes or restarts review according to the dispute resolution record.

A scheduled server processor finds due reviews, claims each transition idempotently, and records auto-approval due to no response. Frontend page loads may refresh displayed state but never cause approval or payment transitions.

### Notifications

Delivery submission, revision request, paid-revision purchase success or failure, resubmission, approval, auto-approval, dispute, final-payment success, and final-payment attention create in-app notifications. Transactional emails are sent for the same high-value events. SMS is not included in this release.

For each active delivery, the scheduled processor sends at most one reminder near 48 hours remaining and one near 24 hours remaining. Reminder state is stored on the delivery so retries cannot duplicate messages. Email-provider failure is logged and retried without rolling back the underlying project event.

### Retention

Directly uploaded delivery files remain available throughout active review, revision, and dispute states. After client approval or no-response approval, the client receives seven additional calendar days to download direct files. Both parties see the exact deletion date. Reminder notifications are sent before deletion. A legal hold, active dispute, payment-attention state, or authorized support hold suspends deletion.

A scheduled cleanup process deletes eligible Storage objects idempotently and records the result without erasing delivery metadata, filenames, sizes, hashes, approvals, or audit history. External links are never deleted by CreatorBridge and may expire according to the external provider's settings.

## Workstream 4: Final Payment and Completion

### Saved final-payment method

The retainer checkout will request explicit consent to use the selected payment method for the later final balance and configure Stripe to make that method reusable for the project customer. The database stores Stripe identifiers, consent evidence, and the trusted final amount but never card details.

The existing 50/50 project math remains unchanged. The normal 5% client booking fee, when applicable, remains attached to the final project payment under the existing approved rule. The fixed $50 revision purchase is separate and carries no additional client fee.

### Approval-triggered charge

Client approval or server auto-approval enqueues an idempotent final-payment command. The command reloads the signed project price, active change orders, trusted fees, credits, and waiver state; creates or reuses the final PaymentIntent; and attempts the off-session charge.

Stripe webhook confirmation is the only event that marks final payment successful and permits creator payout/completion accounting. The project does not display “Payment Released” before confirmation.

If authentication is required, the client receives an in-app and email action to complete payment on-session. A decline or missing method moves the project to `final_payment_attention`, keeps delivery metadata and direct files available, notifies the client and appropriate operations view, and permits a safe retry. It does not reverse approval or grant a false payout.

Creator payout routing continues through the existing Stripe Connect and ledger patterns. Webhooks remain signature-verified and idempotent, and all transferred amounts are derived server-side.

## Workstream 5: Public and Operational Cleanup

The launch program also includes every lower audit item:

- Replace fabricated `/network` posts, chat previews, fallback people, and other fictional activity with truthful empty states and onboarding actions.
- Add and verify the sitemap referenced by `robots.txt`, containing only intended public canonical routes.
- Remove email addresses and other unnecessary personal data from production email logs. Retain provider identifiers and redacted diagnostic context.
- Replace seven scattered support-email placeholders with one shared configuration. Until an approved support mailbox changes it, the current known CreatorBridge support destination remains the fallback rather than inventing an unverified address.
- Introduce route-level lazy loading and sensible chunk boundaries for large admin, video, contract, and project surfaces, then verify that chunk warnings and navigation behavior improve without hiding runtime errors.
- Keep the known Marcus Reed QA listing only while it is needed for acceptance tests, then remove it through an explicit prelaunch cleanup step and verify that public pages contain no QA identity.
- Preserve working US-wide positioning, dark mode, brand colors, approved fees, fee tiers, 50/50 project math, cancellation rules, and existing language checks.

## Error Handling and Recovery

- A failed upload remains a draft item and cannot be submitted as a delivery.
- A partial upload can resume; an abandoned upload expires without creating a review record.
- An invalid or inaccessible external URL receives a clear correction message. CreatorBridge validates URL structure and provider safety but does not promise that an external provider will keep the link alive.
- Duplicate delivery-finalization requests return the original delivery version.
- Duplicate Stripe webhooks and scheduled-review jobs are harmless.
- A revision request cannot consume more than one entitlement, and a paid entitlement cannot be used across projects.
- Notification failure never changes payment, approval, or delivery truth.
- Supabase, Stripe, Resend, or Storage unavailability produces an explicit retryable state; the browser does not invent a successful result.
- Cleanup failure leaves metadata marked for retry and does not hide files that still exist.
- Authorization failures disclose no cross-project metadata.

## Testing and Acceptance

Implementation follows test-driven development for business rules, database commands, and payment state transitions. Acceptance requires all of the following:

1. Ordinary users cannot change protected payment, waiver, verification, payout, moderation, or admin fields through direct table updates.
2. Trusted webhooks and authorized server commands can perform each legitimate protected transition.
3. A non-admin cannot render or query administrative pages; an admin can.
4. Every active package surface and newly generated agreement reports exactly two included revisions.
5. The first and second valid revision requests consume included revisions; the third is locked without a paid entitlement.
6. A client is charged exactly $50 for an added revision, no client booking fee is added, and the creator/platform split uses the trusted tier snapshot.
7. One successful purchase grants one entitlement; retries and duplicate webhooks do not grant more.
8. Paid revisions can be purchased repeatedly and each entitlement is consumed at most once.
9. Two projects involving the same parties have separate project conversations and delivery histories.
10. A normal pasted link does not start review; formal submission does.
11. Direct files and external links can appear in one delivery, direct files are private, and unrelated users cannot access them.
12. A delivery above 5 GB combined is rejected before finalization; external-link size is not counted.
13. Submission creates an immutable version, in-app notification, email, pinned project card, and server five-day deadline.
14. The 48-hour and 24-hour reminders occur at most once each.
15. Included or paid revision requests pause review; a valid resubmission creates a new version and fresh five-day deadline.
16. A dispute prevents auto-approval, final charging, and file cleanup until resolved.
17. No-response approval occurs through the scheduled server process without a browser visit.
18. Approval attempts the trusted final amount. Only a verified Stripe webhook marks final payment paid and creator funds released.
19. A failed or authentication-required final charge enters payment attention, not a paid state, and gives the client a recovery action.
20. Direct files remain through active work and for seven days after approval, holds suspend deletion, and cleanup retains audit metadata.
21. `/network` and creator discovery show truthful empty states when there are no users.
22. Sitemap, support address, redacted logs, lazy route loading, and QA-record cleanup pass targeted checks.
23. Current build, unit tests, platform audit, contract, change-order, messaging, video-call, creator-readiness, collaboration, dependency, and language checks continue to pass.
24. New browser automation covers client, creator, admin, unauthorized, empty, upload failure, external-link, included revision, paid revision, dispute, auto-approval, payment-attention, success, mobile, and desktop paths.
25. Stripe test mode, Resend test delivery, Supabase RLS, private signed downloads, scheduled jobs, and remote migration alignment are verified against the configured providers before production deployment.

## Rollout Sequence

The work is delivered in dependency order:

1. Recheck Supabase health, remote migration alignment, Stripe test configuration, and the dirty worktree; do not confuse an empty platform with an API failure.
2. Add protected-column guards, privileged command paths, admin routing, and security regression tests.
3. Normalize two included revisions across database, packages, contracts, copy, and tests.
4. Add paid-revision records, Stripe flow, webhook fulfillment, entitlement consumption, and notifications.
5. Add project-scoped conversations, immutable delivery/version records, private resumable uploads, external link items, and the formal submission card.
6. Add the five-day review processor, reminders, revision/dispute transitions, retention holds, and cleanup job.
7. Add saved-method consent, automated final-payment attempts, payment-attention recovery, and accurate payout language.
8. Remove fabricated public content, centralize support configuration, redact logs, add sitemap, improve chunking, and remove QA data at the release gate.
9. Run automated, browser, database, Storage, email, Stripe, mobile, and production-readiness verification.
10. Rotate historical test credentials. Rewrite Git history or make the repository private only under an explicitly approved operations runbook.

Each database phase uses additive migrations and rollback-aware state changes. Deployment stops if remote schema alignment is unknown, provider test mode is misconfigured, trust-surface tests fail, or a live write cannot be safely isolated and cleaned up.

## Explicitly Deferred

- Frame.io embedding or a CreatorBridge-native timeline annotation editor.
- SMS delivery and revision notifications.
- Storage of raw camera files, source project files, or long-term archives.
- Self-service price reductions or refunds outside the existing dispute/support flow.
- A generic project add-on storefront.
- Replacing the approved 50/50 payment structure with full pre-collection.
- Rewriting already signed agreements.

These items are not required for the approved launch delivery and revision outcome.
