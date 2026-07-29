# CreatorBridge Human Identity and Duplicate Prevention Design

**Date:** 2026-07-29  
**Status:** Approved product design  
**Scope:** Creator and client identity, phone verification, duplicate-account prevention, administrative review, and server-side access gates.

## Outcome

CreatorBridge will enforce one verified human identity per account and no more than one creator portfolio per verified person. A verified creator may use the same account to hire or collaborate with other approved creators. A client who later applies as a creator must use the existing account and complete the creator requirements there rather than opening another login.

CreatorBridge will use Stripe Identity for government-ID verification, live-selfie liveness and likeness checks, and available duplicate-person signals. Twilio Verify will confirm control of a usable phone number for both clients and creators. Stripe Connect remains the separate creator payout onboarding system.

There are no real production users to migrate. Existing QA records may be reset or recreated as part of testing, and no grandfathering path is required.

## Current State

- Supabase Auth creates one `profiles` row per login.
- `creator_listings_one_per_user_idx` permits one creator listing per authenticated user, but another login can bypass that constraint.
- `client_profiles.user_id` is unique, but another login can create another client profile.
- Clients have Twilio Verify functions and a phone gate for project briefs.
- Creators do not have an equivalent dedicated Twilio verification flow.
- Creator payout onboarding uses Stripe Connect. Standalone Stripe Identity is not implemented.
- Creator approval currently treats completed Stripe Connect onboarding as the identity step.

## Chosen Approach

CreatorBridge will add a provider-backed human identity layer shared by both roles. Stripe will process the sensitive verification media. Supabase will store platform status, consent, provider references, risk decisions, and audit records.

This approach was chosen over:

1. **Account-only uniqueness:** Fast, but a second email bypasses it.
2. **CreatorBridge-hosted facial recognition:** Strong control, but unacceptable biometric-storage, privacy, security, and accuracy burden.
3. **Provider-backed identity plus platform enforcement:** Chosen. Stripe processes identity media, while CreatorBridge enforces one-account and one-portfolio rules at every trusted action.

## Identity Model

Identity belongs to a human, not to a company name or account role. Different verified employees may work for the same company and may share business details, but each person must use a separate verified account. Shared company names, addresses, or business payment methods are risk context and never sufficient by themselves to declare a duplicate.

A single verified account may hold client capabilities, creator capabilities, or both. Creator collaboration continues to permit a verified creator to hire only another approved, verified creator through the existing collaboration workflow.

All platform users must be at least 18 years old. Self-attestation remains part of account acceptance, and Stripe-verified date of birth becomes authoritative before creator application submission or client contract signing.

## Data Boundaries

CreatorBridge must never store these materials in Supabase:

- Government-ID images.
- Selfie images or video.
- Facial templates, FaceMaps, FaceVectors, or embeddings.
- Raw biometric comparison data.

Stripe receives and processes those materials. CreatorBridge stores only:

- Provider and verification-session identifier.
- CreatorBridge user identifier.
- Verification purpose and role context.
- Status and timestamps.
- Twilio phone-verification status and timestamp.
- Limited Stripe risk labels required for platform decisions.
- Consent document version and acceptance timestamp.
- Reverification reason, when applicable.
- Administrative review status, decision, reason, reviewer, and timestamp.
- Linkage to the original account when a duplicate account is restricted.

Sensitive provider payloads must be reduced to an allowlist before persistence. Raw Stripe webhook bodies must not be copied into identity tables or general application logs.

## Status Model

The shared identity state will distinguish:

- `unverified`: no completed identity check.
- `consent_required`: Stripe Identity cannot begin until the dedicated consent is accepted.
- `pending`: verification is in progress.
- `verified`: identity, age, liveness, and required checks passed.
- `retry_required`: a correctable capture or document problem occurred.
- `manual_review`: automated verification or a duplicate signal requires review.
- `duplicate_restricted`: this human is already linked to another CreatorBridge account.
- `rejected`: verification failed for a documented non-duplicate reason.
- `reverification_required`: a previously verified user must complete a new check before trusted actions resume.

Status transitions occur only through authenticated Edge Functions, verified Stripe webhooks, or locked administrative RPCs. Client-side state cannot mark identity or phone verification complete.

## Creator Flow

1. The creator creates an account and confirms their email.
2. The creator may build and save an application and portfolio as a draft.
3. Before final submission, the creator completes Twilio phone verification.
4. The creator sees and accepts the dedicated biometric-processing notice.
5. An authenticated Edge Function creates a Stripe Identity document-and-selfie verification session.
6. A verified Stripe webhook records the allowlisted outcome.
7. Duplicate or elevated-risk results enter manual review. A clear result marks the human identity verified.
8. Only a phone-verified, identity-verified adult may submit a creator application.
9. Stripe Connect payout onboarding remains a separate approval requirement.
10. Administrative approval continues to require a complete portfolio, package, intro video, payout readiness, identity verification, and all existing readiness checks.

Twilio and Stripe Identity are required before application submission so administration does not spend time reviewing fake or unverifiable applications. Stripe Connect may be completed after submission but before approval.

## Client Flow

1. Anyone may browse public profiles and prepare an unsent project draft.
2. A signed-in client confirms email and completes Twilio phone verification before posting a brief, requesting a quote, or sending the first direct message to a creator.
3. A client may accept a proposal and review the generated contract while full identity verification is pending.
4. Before signing the first contract, the client accepts the dedicated biometric-processing notice and completes Stripe Identity.
5. An unverified client cannot sign, fund the retainer, schedule or join a project call, approve a change order, or complete another trusted project action.
6. A successful identity result is reused for later projects unless a defined reverification trigger occurs.

This timing protects creators from disposable contact accounts while avoiding government-ID friction for visitors who are only browsing or planning.

## Duplicate Handling

If Stripe or CreatorBridge identifies that a registration belongs to a human already linked to another account:

- The newer account becomes `duplicate_restricted`.
- It cannot submit a creator application, create a portfolio, sign a contract, fund a project, approve a change order, or join a project call.
- The user is directed to recover the original account or contact support.
- CreatorBridge may restore access to the original account or move verified access after documented review.
- Project, payment, contract, or disciplinary history is never silently discarded during recovery.
- No administrative action may result in two approved creator portfolios for the same verified human.

Duplicate detection is a risk decision, not a permanent automatic ban. An automated match receives human review before a final adverse decision. Shared company information alone is never treated as proof of duplicate identity.

## Failed Verification and Manual Review

Correctable failures receive a limited number of retries with clear guidance. Repeated failures enter manual review and the trusted-action gates remain closed.

Manual reviewers use Stripe's secure verification and review tools. Users must never email IDs or upload them to ordinary CreatorBridge storage. Review actions are:

- Request another secure attempt.
- Clear a documented false positive.
- Confirm and link a duplicate account to the original identity.
- Reject the verification with a documented reason.
- Restore the original account after recovery checks.

Every administrative decision requires a written reason, reviewer identifier, and timestamp. Administrators may not directly edit a database flag to bypass verification or authorize a second creator portfolio.

## Consent and Privacy Notice

Biometric-processing consent must be a separate screen immediately before opening Stripe Identity. It cannot be buried in general Terms.

The notice explains:

- Stripe will process a government ID and live selfie.
- The checks include age, document authenticity, liveness, likeness, and available duplicate-account signals.
- Why CreatorBridge requires the checks.
- What Stripe processes and what CreatorBridge retains.
- How to request support, review, and deletion information.
- The applicable privacy-policy and retention links.

CreatorBridge records the exact consent version and timestamp before a verification session is created. Withdrawing required verification makes the account unverified for future trusted actions; it does not erase contract, payment, safety, or dispute records that CreatorBridge must lawfully retain.

## Reverification

Successful identity verification does not expire on a yearly schedule. Reverification occurs only after a defined trigger:

- Legal identity information changes.
- Stripe requests another check.
- Suspicious account recovery.
- Serious fraud or duplicate signal.
- Return after a qualifying suspension.
- Material inconsistency between the verified person and later account activity.

A phone-number change requires a new Twilio verification but does not automatically require another government-ID check.

## Server-Side Gates

Verification must be enforced in the server-side functions or RPCs that perform trusted actions. UI buttons may explain a lock, but they are not the security boundary.

At minimum, enforce:

- Creator application submission: creator phone and identity verified.
- Creator approval: identity verified, Stripe Connect ready, and existing profile-readiness rules satisfied.
- Client project contact actions: client phone verified.
- Contract signing: both signers' human identity verified.
- Retainer and additional payment creation: client identity verified and creator remains verified and approved.
- Project-call scheduling and token generation: both parties verified, countersigned agreement, and required payment state.
- Change-order signing and activation: both parties verified.
- Creator collaboration acceptance and funding: both creator identities verified and approved.

Suspension, duplicate restriction, or reverification-required status closes the relevant gates immediately without rewriting historical records.

## Administration

Add an Identity Review surface that shows:

- User and role/capability context.
- Stripe verification reference and reduced status.
- Twilio status.
- Duplicate or risk reason.
- Linked original account, if any.
- Attempt history and timestamps.
- Existing CreatorBridge account, project, contract, and enforcement context.
- Available documented review actions.

The surface must not fetch or display raw biometric material from Supabase. If a reviewer needs provider evidence, they use Stripe's secured provider surface.

## User Experience

Verification states must be explained in plain language:

- Why the check is required.
- What action it unlocks.
- Whether the person can retry or needs review.
- How to recover an existing account.
- Where to request help.

No public badge may claim background checking or guarantee trustworthiness. Approved language is limited to identity and likeness verification appropriate to the checks actually completed.

## Error Handling

- Stripe session creation is idempotent for a pending purpose.
- Webhook processing is signature-verified and idempotent by Stripe event identifier.
- A browser closing mid-verification leaves the account pending and offers resume/retry.
- Provider downtime does not create a bypass; drafts remain saved and trusted actions remain locked.
- Twilio failures preserve the entered application or project draft.
- Conflicting duplicate signals enter review instead of automatically merging accounts.

## Testing and Acceptance

Automated tests and live sandbox checks must demonstrate:

1. A second email cannot obtain a second creator portfolio for the same verified person.
2. One authenticated user cannot create multiple creator listings.
3. Different verified employees at the same company are not treated as duplicates.
4. A creator can save a draft without verification but cannot submit it.
5. An unverified client can browse and draft but cannot contact a creator.
6. A phone-verified client can post/contact but cannot sign the first contract without Stripe Identity.
7. Unverified parties cannot create payments, schedule calls, obtain call tokens, or activate change orders through direct API calls.
8. Verified status survives normal future bookings without arbitrary expiration.
9. A phone change resets only phone verification.
10. Duplicate and failed results enter the correct restriction or review states.
11. Cross-user RLS prevents identity-status and review-history disclosure.
12. No raw ID, selfie, face template, or unfiltered provider payload is persisted.
13. Administrative decisions require reasons and are auditable.
14. Recovery restores one account without approving a duplicate creator portfolio.

## Deferred

- CreatorBridge-hosted facial recognition.
- Public trust scores.
- Shared company logins.
- Automated organization administration.
- Annual forced reverification.
- Any claim that identity verification is a background check.

