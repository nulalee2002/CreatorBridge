# CreatorBridge Creator Protection & Scope Control

Updated: 2026-06-01

Status: Product rules and implementation audit. No migrations have been approved from this document yet.

## Core Decision

CreatorBridge should protect creators from vague briefs, scope creep, unclear pricing, and unreliable client behavior at the platform level.

The existing payment structure stays intact:

- Client pays the first 50% at booking.
- Final 50% is released after delivery is approved or auto-release rules apply.
- Change orders must not replace or weaken the 50/50 escrow model.
- Off-platform payment or scope changes are not allowed for clients and creators introduced through CreatorBridge.

## Platform Rule

Every project should move through three protected stages:

1. Clear brief before creator commitment.
2. Locked scope at booking.
3. Logged approval for anything outside the original scope.

This prevents the platform from becoming a loose message board where creators still have to defend themselves manually.

## Change Order Policy

Change orders should route through CreatorBridge, not off-platform.

The first version should be a scope-control and paper-trail feature. It should let a creator document that a client is asking for work outside the accepted brief or booked package.

A change order should include:

- Project id.
- Creator id.
- Client id.
- Original scope reference.
- Requested extra work.
- Added deliverables.
- Added revision rounds, if any.
- Added cost, if any.
- Client approval or decline.
- Timestamped status history.

Change orders do not require a new payment structure. If a paid change order is later added, it should run through the existing platform payment rails as an additional project add-on. The core booking split remains 50/50.

## Client-Assisted Briefing

CreatorBridge should actively help clients complete better briefs instead of only giving them a blank text box.

The brief flow should ask guided questions before submission:

- What primary pillar is this project in?
- Which specialty inside that pillar fits best?
- What exactly needs to be delivered?
- How many final files, edits, selects, cuts, or formats are expected?
- Where will the work be used?
- What deadline matters most?
- Is the work on-site, remote, or either?
- What city/state applies if on-site?
- What is the realistic budget range?
- Are there reference examples?

Reference examples should support links first. Uploads can come later. The first safe implementation can accept 2-3 URLs to examples the client likes, because links are easier to store and verify than file uploads.

The brief assistant should be framed as helpful guidance, not punishment. The goal is to help clients become better buyers and help creators quote with fewer clarification messages.

## Brief Quality Rule

Brief quality scoring should not launch until structured brief fields exist.

Once the guided brief flow exists, the score can factor in:

- Two or more reference links.
- Specific deliverable details.
- Reasonable budget range width.
- Usage rights selected.
- Deadline selected.
- Location requirements selected.
- Prior completed projects and dispute history.

Low-quality briefs should not be blocked in the first version. They should be nudged back to the client with a message like:

"Creators are more likely to respond when your brief includes clear deliverables and reference examples. Add more detail before posting?"

Blocking can be considered later if low-quality briefs become a serious marketplace problem.

## Scope-Locked Packages

Packages should become scope-locked offers. A booked package should store a snapshot at the time of booking so later package edits do not rewrite the agreement.

Package fields should eventually include:

- Included deliverables.
- Excluded deliverables.
- Revision count.
- Turnaround time.
- Add-ons.
- Usage rights.
- Source/raw file policy.

At booking, the client should acknowledge:

"I understand what this package includes and what is not included. Work outside this scope requires a CreatorBridge change order."

## Flat-Fee Pricing Rule

CreatorBridge should stay flat-fee-first for client-facing pricing.

The calculator may use hours internally to help creators estimate fair pricing, but client-facing quotes should show:

- Deliverables.
- Package or project price.
- Usage rights.
- Revisions.
- Add-ons.

Hourly math should stay as a creator-side sanity check, not the main client-facing price structure.

## Client Trust Profile Rule

CreatorBridge can collect trust signals now, but should be careful about showing a full trust profile before enough booking history exists.

Early safe signals:

- Payment method verified.
- Member since.
- Projects posted.
- Projects completed.
- Dispute count, internal/admin-first.

Later creator-facing signals:

- Completion rate.
- Average approval time.
- Creator cancellations.
- Verified client badge.
- Trusted buyer badge.

Terms and onboarding must tell clients that relevant booking history may be visible to creators for trust and marketplace safety.

## Current Platform Audit

| Area | Current State | Gap | Safe Next Step |
| --- | --- | --- | --- |
| Project brief posting | `ProjectBoard` has title, description, primary pillar/service, duration, budget, deadline, location, and minimum description length. | It is still a single modal, not a guided wizard. No reference links. | Add reference link fields and clearer guided helper copy before building a full wizard. |
| Quote request flow | `RequestQuoteModal` asks structured questions: pillar, project type, date, time, venue, hours, deliverables, budget, and location preference. | No explicit reference example links. No brief quality score. | Add optional/reference URL fields, then make them required once the UX is ready. |
| Packages | `packages` table has deliverables, turnaround days, and revisions. Package builder exists. | No exclusions, add-ons, usage rights, raw/source policy, or booking snapshot. | Document package rules in UI first, then add nullable package fields and snapshot storage later. |
| Revisions | Project lifecycle tracks `revision_count`. Dispute policy and support bot mention 2 included revisions and paid third revision. | No formal change-order table for outside-scope requests. | Add change order documentation now. Build a logged change-order flow after package snapshots are ready. |
| Rate calculator | Calculator already frames output around a recommended quote and package-style pricing. | Need final audit that client-facing quote/PDF never leads with hourly rates. | Keep flat-fee-first rule in docs and verify calculator/quote PDF before launch. |
| Client trust | `client_profiles` already has payment method, completed project count, ratings, cancellation rate, reviews, and fast match count fields. | Trust profile is not fully surfaced to creators and legal language needs to disclose visibility. | Start with payment verified + member since + completed projects. Keep dispute/cancellation details admin-first until data matures. |
| Legal docs | Creator Agreement and Dispute Policy already mention revisions, scope creep, approval window, and auto-release. | Terms need stronger language for scope locks, change orders, and trust visibility. | Update legal pages after the product rules are approved, before migrations. |

## Implementation Order

1. Add this roadmap to launch readiness tracking.
2. Add reference links and client guidance copy to brief/quote flows.
3. Audit calculator and quote PDF for flat-fee-first display.
4. Add package UI language for inclusions, exclusions, revisions, and change-order requirement.
5. Add nullable package/snapshot/change-order database fields after UI copy is approved.
6. Build change-order logging.
7. Build guided brief wizard.
8. Add brief quality scoring.
9. Surface client trust signals gradually.

## Non-Negotiables

- Do not change the 50/50 payment structure.
- Do not encourage off-platform scope or payment changes.
- Do not block clients from posting low-quality briefs until the guided wizard is live.
- Do not expose harsh trust scores to clients or creators. Show component signals, not a public punishment score.
- Do not enforce new required database fields before the UI can collect them.
