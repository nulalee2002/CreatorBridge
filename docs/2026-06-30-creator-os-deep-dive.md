# CreatorBridge as a Creator OS — Deep Dive and Build Plan
Date: 2026-06-30
Goal: make CreatorBridge the place creators run their business and do not leave.

This is grounded in the actual codebase and database, not assumptions. Evidence is cited
by table and file. Comparables referenced: Fiverr Pro (vetted marketplace + project
management) and Pixieset (delivery + creator business suite).

---

## Part A. What is ALREADY built (evidence)

Identity and trust
- Manual creator review + verification, creator tiers (Launch/Proven/Elite/Signature):
  `creator_listings`, `src/config/tiers.js`, admin review RPCs.
- Client trust signals: `src/components/ClientReputationBadge.jsx`,
  `ClientVerification.jsx`, client phone verification gate
  (`client-phone-*` edge functions, migration `require_client_phone_verification_for_briefs`).
- Legal acceptance (static): `legal_acceptances` (user_id, document_type, document_version,
  accepted_at, ip_address); `src/pages/CreatorAgreement.jsx`, Terms/Privacy modals.

Discovery, packages, matching
- `creator_listings`, `creator_services` (rates, subtypes), and crucially `packages`
  already carry `deliverables`, `turnaround_days`, `revisions`, `tier`, `price`.
- Smart Match + Fast Match: `src/utils/matchingAlgorithm.js`, `FastMatch.jsx`,
  `MatchResultsPage.jsx`. Project Board + applications: `projects`, `project_applications`.

Money (this is mature)
- Full 50/50 escrow in `transactions`: retainer/final amounts, `retainer_status`,
  `final_status`, `retainer_payment_intent`/`final_payment_intent`,
  `retainer_transfer_id`/`final_transfer_id`, `retainer_released_at`/`final_released_at`,
  creator/client fee fields, credits, fraud fields (booking_ip, payment_fingerprint).
- Edge functions: `create-payment-intent` (server-side trusted amounts, auth + ownership
  checks), `release-payment` (client or admin release), `stripe-webhook` (signature
  verified). Margin/minimum-budget protection. Referral/client-invite credit ledger.
- Creator-to-creator collaboration with its own settled ledger: `creator_collaborations`,
  `collaboration_payments`.

The delivery loop as it exists today
- `projects` carries the loop already: `status`, `delivered_at`, `approved_at`,
  `delivery_link`, `delivery_notes`, `revision_count`, plus 72-hour auto-approve
  (`autoApproved` in `ProjectBoard.jsx`).
- Flow today: retainer paid -> in_progress -> creator sets status "delivered" and pastes a
  `delivery_link` (external URL) + notes -> client approves (`approved_at`) or 72h
  auto-approve -> `release-payment` releases the final transfer. Revisions tracked by
  `revision_count`.

Media infrastructure (already present, just pointed at portfolios)
- Video: `src/utils/bunnyStream.js` — Bunny TUS upload, video refs, thumbnails, up to 1GB
  portfolio video / 750MB intro. Used by `portfolio_items.bunny_video_id`.
- Files/images: Supabase Storage abstraction `storage://bucket/path`
  (`src/utils/storage.js`), signed-URL edge function `create-storage-signed-url`, existing
  `creator-portfolio` bucket. `portfolio_items` has `media_type`, `image_url`,
  `bunny_video_id`.
- PDF generation utility already exists: `src/utils/pdf.js` (jsPDF).

Comms, availability, ops
- Messaging with contact-info filtering (anti-poaching): `messages`, `messageFilter.js`.
  Notifications center, support tickets, Bridge chatbot. Availability calendar
  (`availability`, `AvailabilityCalendar.jsx`) + `GoogleCalendarConnect.jsx`.

Takeaway: CreatorBridge already owns identity, matching, packages, escrow, and the media
upload pipeline. The loop from delivery to approval to release exists. The missing pieces
are the surfaces on top of that plumbing.

---

## Part B. The gap to "run your whole business here"

1. Deliverables are a link, not assets. Delivery = one external `delivery_link`. There is
   no native photo+video delivery, no per-asset review, no proofing/selects, no persistent
   content library. The upload infra exists (Bunny + Storage) but only powers portfolios
   and intro videos, not project deliverables. Files vanish (link rot / 7-day note).
2. No contract from the brief. Only static ToS/agreement acceptance in `legal_acceptances`.
   There is no per-project generated contract, no signature capture on scope. (You believed
   this existed; the evidence says it does not yet.)
3. No formal quotes or invoices as documents. `quote_requests` are inquiries; `transactions`
   are internal ledgers. No client-facing estimate or paid receipt/invoice PDF.
4. Secondary: no one-click rebook/repeat order, no team/agency accounts, no in-context
   upsell of extra deliverables/edits/license.

Items 1 and 2 are the two you flagged and are the core of "creators run their business here."

---

## Part C. Build Plan 1 — Deliverables Workspace + Proofing + Content Library
Not a "photo gallery." A mixed-media deliverables workspace that handles photos, video, and
files together, because CreatorBridge delivers all three.

### New tables
- `project_deliveries` — one row per delivery round.
  Columns: id, project_id (fk projects), creator_id (fk creator_listings), round_no int,
  status text check in ('draft','submitted','changes_requested','approved'),
  cover_message text, submitted_at timestamptz, decided_at timestamptz, created_at,
  updated_at.
- `deliverable_assets` — the actual files in a delivery.
  Columns: id, delivery_id (fk project_deliveries), project_id, owner_user_id,
  kind text check in ('image','video','file'),
  storage_ref text (for image/file: `storage://project-deliverables/...`),
  bunny_video_id text (for video), filename, mime, size_bytes bigint,
  width int, height int, duration_seconds numeric, thumbnail_ref text,
  is_final boolean default false, display_order int, created_at.
- `asset_selections` — client proofing decisions, per asset.
  Columns: id, asset_id (fk deliverable_assets), client_id, decision text check in
  ('favorite','approved','revision'), note text, created_at.
  Unique (asset_id, client_id).
- Optional `client_saved_assets` — cross-project favorites for the library
  (client_id, asset_id, saved_at). The content library itself is a QUERY, not a table:
  all `deliverable_assets` whose delivery is approved, for a given client, grouped by
  project/creator. No new heavy storage.

Reuse existing: `projects.delivered_at/approved_at/revision_count` stay authoritative;
add `projects.current_delivery_id` (nullable fk) for convenience.

### Storage
- New PRIVATE Supabase bucket `project-deliverables` for images/files. Videos continue via
  Bunny (reuse `bunnyStream.js` TUS). Downloads always via `create-storage-signed-url`
  (extend it to allow this bucket, but private: signed URL only, gated by ownership).
- Proof vs final: show web-res / optionally watermarked previews before approval; unlock
  original-resolution download only after the final payment is released. This protects
  creators (walled-garden, anti-poaching aligned) and gives the release teeth.

### RLS (via SECURITY DEFINER RPCs + policies, matching current patterns)
- Creator (delivery owner): insert/update/delete assets while delivery is draft.
- Client (project owner): read proof-res once delivery status = submitted; write
  `asset_selections`; read original-res only after `final_released_at` is set.
- Admin: full. Everyone else: denied.

### Screens
- Creator "Deliver work" (on the project): drag-drop upload (images -> Storage, video ->
  Bunny via existing TUS), reorder, add a cover message, Submit Delivery. On resubmit after
  changes, new `round_no`.
- Client "Review delivery": responsive grid + lightbox (photo viewer + video player),
  per-asset Favorite / Approve / Request change with a note, and a single Approve Delivery
  or Request Changes action. Shows revisions remaining from `packages.revisions`.
- Content Library (client): every approved asset across all projects, filter by
  project/creator/type, re-downloadable anytime via signed URL. This replaces the
  disappearing `delivery_link` and is the retention hook.

### How it hooks the 50/50 release (concrete)
- Submit Delivery: sets `projects.status='delivered'`, `delivered_at=now()`, creates
  `project_deliveries(status='submitted')`, sets `current_delivery_id`. Keep the optional
  `delivery_link` as a fallback field. Notifies client.
- Approve Delivery: sets `approved_at=now()`, delivery.status='approved', flips assets
  `is_final=true`, unlocks original-res in the library, and calls the SAME existing final
  release path (`release-payment` / final transfer). 72h auto-approve continues to work and
  now also unlocks the library.
- Request Changes: delivery.status='changes_requested', `projects.status='revision'`,
  increment `revision_count`. If `revision_count` exceeds `packages.revisions`, route to a
  paid change request (new small charge via `create-payment-intent`) before the creator
  redelivers. This finally enforces the revision limits packages already declare.

Net: the proofing surface becomes the approval action that triggers release, replacing a
bare status toggle. The money code barely changes; the UX and retention change a lot.

---

## Part D. Build Plan 2 — Contracts generated from the brief + e-sign
This is the thing you liked in Pixieset and thought already existed.

### New table
- `contracts` — one per project.
  Columns: id, project_id, client_id, creator_id, template_version,
  terms jsonb (scope, deliverables[], revisions, timeline, usage/license, price breakdown,
  cancellation tier, shoot dates, locations), pdf_ref text (`storage://contracts/...`),
  status text check in ('draft','sent','client_signed','creator_signed','countersigned',
  'void'), client_signed_at, creator_signed_at, client_sig_ip, creator_sig_ip, created_at,
  updated_at.

### Generation (brief -> contract)
- Trigger point already exists: `accept_project_application`. On acceptance, assemble the
  contract `terms` from: the brief (`projects` title/description/timeline/location/budget),
  the accepted proposal (`project_applications.proposed_rate`), the chosen
  `packages` (deliverables/turnaround/revisions), and the platform standard clauses (reuse
  the language in `CreatorAgreement.jsx` / Terms + the codified fee, cancellation, and
  dispute rules). Render to PDF with the existing `src/utils/pdf.js`, store in a private
  `contracts` bucket.

### E-sign (first-party, lightweight)
- Typed or drawn signature capture for both client and creator; store signature + IP +
  timestamp, mirroring the `legal_acceptances` pattern (ip_address, accepted_at). This is
  not DocuSign; it is a first-party scope agreement. Requires attorney review for
  enforceability and ESIGN/UETA compliance before you rely on it (flagged, not assumed).

### Hook to payment
- Make a countersigned contract a precondition for the retainer: gate `create-payment-intent`
  for a project on `contracts.status='countersigned'`. Now the sequence is brief -> match ->
  accept -> auto-generated contract -> both sign -> retainer -> work -> deliver in the
  workspace -> approve -> release. Trust and paperwork live entirely inside CreatorBridge.

---

## Part E. Sequencing and rationale
1. Deliverables workspace + proofing + content library. Highest retention lever, reuses
   Storage + Bunny + the existing release loop, and makes the client library the reason to
   come back. Build first.
2. Contracts-from-brief + e-sign, gating the retainer. Second; it is the "run my business"
   signal creators asked for and reuses `accept_project_application` + `pdf.js`.
3. Then: quotes/estimates as documents, one-click rebook/repeat order, team/agency accounts,
   in-library upsell of extra edits/formats/license.

## Part F. Cautions
- Build a mixed-media deliverables workspace, not a photo-only gallery (your point).
- Keep deliverables private, signed, and original-res gated behind release. It protects
  creators and matches the walled-garden, anti-poaching brand.
- Contracts and e-sign need attorney review before they are load-bearing.
- Any AI stays on real footage (repurposing, captions, reframes), never generating people,
  per the verified-humans brand.

---

## Appendix. One-line evidence index
- Escrow/release: `transactions`, `supabase/functions/create-payment-intent`,
  `release-payment`, `stripe-webhook`.
- Delivery loop today: `projects.delivery_link/delivered_at/approved_at/revision_count`,
  `src/pages/ProjectBoard.jsx`.
- Media upload: `src/utils/bunnyStream.js`, `src/utils/storage.js`,
  `supabase/functions/create-storage-signed-url`, `portfolio_items`.
- Packages define deliverables/revisions: `packages`.
- Contract inputs: `projects`, `project_applications`, `packages`,
  `src/pages/CreatorAgreement.jsx`, `legal_acceptances`, `src/utils/pdf.js`.
