# Codex Build Spec — Contract Generation, E-Signature, and Rebooking
Date: 2026-06-30
Author: planning handoff for Codex. Claude wrote this spec; Codex builds it.
Repo: content-pricing-calc (CreatorBridge). Stack: React 18 + Vite, Supabase (Postgres +
RLS + edge functions), Stripe Connect, jsPDF (`src/utils/pdf.js`), Bunny + Supabase Storage.

Do NOT ship to production without: (1) an entertainment attorney review of clause language
and the e-sign flow for ESIGN / UETA enforceability, and (2) Lee's explicit go. Build in the
repo for review first.

---

## 0. Goal
Generate a production agreement automatically from the accepted brief between a client and a
creator, let both parties sign it inside the platform on any device, gate the retainer on a
countersigned contract, and make rebooking a creator a one or two tap action that reuses the
prior terms and the saved signature.

## 1. Design language (build on-brand, not generic)
Use the existing system. Do not introduce new colors, fonts, or component styles.
- Fonts: headings `font-display` ("Cormorant Garamond", serif); body `font-body` (Inter).
- Palette (CSS vars in `src/index.css`): clay `--clay #9C4A33` / Tailwind `gold-*` (primary
  action), forest `--forest` / `forest-*` (trust, success, verified), oxblood `--oxblood` /
  `oxblood-*` (premium, warnings-not-error), ivory `--ivory #F2E8D6` (text), stone
  `--stone`/`--stone-muted` (secondary/dim text), background espresso `#0E0B09`, panels
  `--glass`. Dark mode only.
- Components to reuse: `liquid-glass` panels, `btn-gold` (primary) and `btn-ghost`
  (secondary) buttons, `.cb-modal` overlay pattern (see `src/components/TermsModal.jsx` for
  the canonical modal: fixed overlay, Escape-to-close, `font-display` section headings,
  `text-charcoal-300` body), `eyebrow` labels, `tag-forest`/`tag-oxblood` status chips,
  lucide-react icons.
- Hard rule: NO em dashes or en dashes ( — – ) anywhere in UI copy, generated documents, or
  code comments. Use commas or rewrite. This is enforced platform-wide.
- Use the real transparent CreatorBridge lockup
  (`/images/brand/creatorbridge-platform-logo-transparent.png`) in the header of both the
  on-screen contract and the PDF. Never a text placeholder for the logo.

### 1.1 Contract visual treatment (luxe, high-end)
The on-screen contract view and signing panel must match the approved mockup
`docs/2026-06-30-contract-mockup.html`. Build to that, not to a plain document.
- Present the agreement as an engraved certificate: a fine gold double-rule inner frame
  inset from the panel edge, a soft warm page vignette, and a faint oversized CB monogram
  watermark (about 5 percent opacity) behind the text.
- Header: the real logo lockup on the left, a small-caps document number and issue date on
  the right, a hairline gold rule beneath.
- Title: large centered Cormorant "Production Agreement" with a diamond-and-hairline
  ornament and a one-line parties statement.
- Sections numbered with Roman numerals in clay beside small-caps labels, generous spacing.
- Money as an elegant ledger: hairline rows, right-aligned Cormorant tabular figures, the
  creator-net line accented with a forest left border.
- Execution block: an "In witness whereof" line, engraved signature lines, the signed party
  in a fine script face (Pinyon Script or similar), the pending party italicized, and a
  rotated CB monogram wax-seal stamp reading "Verified".
- Gold is a restrained metallic accent only (hairlines, frame, seal), never a fill or a new
  brand color. Clay stays the action color, forest stays trust, ivory and stone stay text.
- Signing panel: underlined minimal tabs (Draw, Type, Saved), a signature pad with a gold
  baseline and inner shadow, a Cormorant name field, a gold "Sign and seal" CTA.
- The downloadable PDF is a cleaner, flatter cousin of this on-screen view: same structure,
  logo, ledger, and seal, but without the vignette, metallic sheen, or watermark, so it
  prints well and stays legal-document plain. The plain PDF sample is
  `docs/2026-06-30-sample-generated-contract.pdf`.

## 2. Data model (new)
Add via a Supabase migration (timestamped `supabase/migrations/`). RLS on every table.

### 2.1 `contracts`
- id uuid pk default gen_random_uuid()
- project_id uuid not null references projects(id) on delete cascade
- client_id uuid not null            -- profiles(id)
- creator_id uuid not null           -- creator_listings(id)
- creator_user_id uuid not null      -- profiles(id) of the creator
- template_version text not null default 'v1'
- terms jsonb not null               -- structured snapshot, see 3.2
- content_hash text not null         -- sha256 of the rendered terms, tamper-evidence
- pdf_ref text                       -- storage://contracts/<id>/agreement.pdf (private)
- status text not null default 'draft'
    check (status in ('draft','sent','client_signed','creator_signed','countersigned','void'))
- client_signed_at timestamptz, creator_signed_at timestamptz, countersigned_at timestamptz
- created_at timestamptz default now(), updated_at timestamptz default now()
- unique (project_id)

### 2.2 `contract_signatures`  (one row per party per contract)
- id uuid pk
- contract_id uuid not null references contracts(id) on delete cascade
- signer_user_id uuid not null
- signer_role text not null check (signer_role in ('client','creator'))
- signer_name text not null          -- typed legal name at signing
- method text not null check (method in ('drawn','typed','saved'))
- signature_image_ref text           -- storage://signatures/<id>.png (transparent PNG)
- consent_text text not null         -- exact checkbox text they agreed to
- signed_content_hash text not null  -- must equal contracts.content_hash at sign time
- ip_address text, user_agent text
- signed_at timestamptz default now()
- unique (contract_id, signer_role)

### 2.3 `saved_signatures` (reusable / "embedded" signature per user)
- id uuid pk
- user_id uuid not null
- label text                         -- e.g. "My signature"
- method text check (method in ('drawn','typed'))
- signature_image_ref text not null  -- storage://signatures/saved/<id>.png
- is_default boolean default true
- created_at timestamptz default now()
This is what powers one-tap signing on rebooks.

### 2.4 Storage
- New PRIVATE bucket `contracts` (PDFs) and `signatures` (PNGs). Signed-URL access only,
  via the existing `create-storage-signed-url` edge function (extend its allowed buckets;
  keep them private, owner/party-gated). Never public.

## 3. Contract generation
### 3.1 Trigger
Hook the existing `accept_project_application(p_project_id, p_application_id)` RPC. On
acceptance, after the application is marked accepted, create the `contracts` row in `draft`,
assemble `terms` (3.2), compute `content_hash`, render the PDF (3.3), set status `sent`, and
notify both parties (reuse notifications).

### 3.2 Term assembly (map brief -> clauses). Pure function, unit tested.
Source every value from existing data, nothing invented:
- Parties: client profile + creator listing/profile.
- Project: `projects.title, description, service_id (pillar), location, timeline,
  project_duration`.
- Deliverables, turnaround, revisions, tier: the accepted `packages` row.
- Amount: `project_applications.proposed_rate` (fallback project budget). Fees from platform
  rules: creator 10/8/6 by tier (`create-payment-intent` logic is the source of truth),
  client 5 percent. Compute retainer/final = 50/50.
- Cancellation, dispute window (72h), usage/IP, communication: platform standard clauses,
  reuse the language already in `TermsModal.jsx` and `CreatorAgreement.jsx`.
- Cancellation tier: default standard; if per-package cancellation tiers are added later,
  read from the package.
Output `terms` jsonb: { parties, project, deliverables[], timeline, shoot_dates, location,
pricing{total,retainer,final,creator_fee_pct,client_fee_pct,creator_net}, revisions,
usage, cancellation, disputes, generated_at }.

### 3.3 Rendering
- Render with the existing jsPDF utility (`src/utils/pdf.js`) OR a dedicated
  `src/utils/contractPdf.js` that mirrors the sample layout. Sections: title + logo, 1
  Parties, 2 Scope, 3 Deliverables and timeline, 4 Fees and protected payment (50/50 table,
  forest header), 5 Cancellation, 6 Usage and ownership, 7 Disputes, 8 Signatures (filled
  after signing), plus a final audit page (see 4.5). Store to `contracts` bucket, set
  `pdf_ref`. Regenerate the PDF after each signature so the signature images are embedded.

## 4. E-signature (the signing experience)
Must work on a phone with a finger, on a PC with mouse or trackpad, and offer a saved
signature for reuse. One component, three input modes, plus reuse.

### 4.1 Component: `src/components/SignaturePad.jsx`
- HTML5 `<canvas>` using the Pointer Events API (`pointerdown/move/up`), which unifies finger
  (touch), stylus (pen), and mouse in one code path, so the same pad works on iPhone, iPad,
  Android, and desktop. Handle high-DPI (scale canvas by `devicePixelRatio`), smooth strokes
  (quadratic curve smoothing), and `touch-action: none` on the canvas so drawing does not
  scroll the page.
- Three tabs, styled with the existing tab/`filter-chip` pattern:
  1. Draw: sign with finger or mouse. Clear and Undo buttons (`btn-ghost`). Stroke color
     ivory on a dark pad for contrast, exported as dark ink on transparent for the PDF.
  2. Type: type legal name, rendered in a signature-style font; pick from 2 to 3 script
     fonts. Produces the same PNG output.
  3. Saved: if the user has a `saved_signatures` row, show it with a one-tap "Use this"
     (`btn-gold`). This is the fast path for rebooking.
- Output: a transparent-background PNG data URL at 2x resolution. Also expose the chosen
  method ('drawn' | 'typed' | 'saved').
- Optional "Save this signature for next time" checkbox that writes `saved_signatures`.
- Responsive: on mobile render as a full-screen bottom sheet (bigger drawing area, thumb
  reachable actions); on desktop render inside the `.cb-modal` pattern.

### 4.2 Signing screen: `src/components/ContractSignModal.jsx`
- Shows the rendered contract (embed the PDF via signed URL, or render the HTML terms with a
  "Download PDF" `btn-ghost`). Scroll-to-bottom gate before the sign action enables (common
  e-sign UX and helpful for enforceability).
- Legal name input (prefilled from profile, editable), a required consent checkbox with exact
  text stored to `contract_signatures.consent_text`, for example: "By signing, I agree this
  electronic signature is legally binding and I have authority to enter this agreement."
- The SignaturePad. Primary action `btn-gold` "Sign agreement", disabled until name + consent
  + a signature exist.

### 4.3 Submit flow (edge function `sign-contract`)
- New edge function `supabase/functions/sign-contract`. Auth required; verify the caller is
  the client or the creator on that contract. Rate limited (reuse `_shared/rateLimit.ts`).
- Steps: upload signature PNG to `signatures` bucket; insert `contract_signatures` with
  method, name, consent_text, `signed_content_hash` (must equal current
  `contracts.content_hash`, reject if the contract changed), ip_address (from x-forwarded-for,
  validated like other functions), user_agent; advance `contracts.status`
  (client_signed / creator_signed, then countersigned when both present); regenerate the PDF
  with both signatures embedded; notify the other party.
- Idempotent per (contract_id, signer_role).

### 4.4 Countersign
Both parties must sign. Order allowed either way. When both `contract_signatures` exist, set
status `countersigned`, stamp `countersigned_at`, finalize the PDF.

### 4.5 Audit page (tamper-evidence, appended to the PDF)
List for each signer: name, role, method, signed_at, IP, user agent, and the
`signed_content_hash`. State the document hash. This is the "certificate of completion"
pattern and is what makes the e-sign defensible. Keep language factual, no notarization
claims.

## 5. Payment gate
Gate the retainer: in `create-payment-intent`, for a project that has a contract, reject the
retainer intent unless `contracts.status = 'countersigned'` (error copy: "Both parties need
to sign the agreement before the retainer can be paid."). Final payment path unchanged. If a
project predates contracts (legacy), allow it (feature-flag by presence of a contracts row).

## 6. Rebooking (Pixieset-style repeat), tie-in
Goal: a client rebooks a creator they liked in one or two taps, and signing is instant via
the saved signature.
- Entry points: a "Rebook" `btn-gold` on a completed project card, on the creator's profile
  for past clients, and in the client's project history.
- Action: `rebook_project(p_prior_project_id)` RPC creates a NEW project pre-filled from the
  prior brief (title, pillar, deliverables, location, budget) and the same creator as
  `accepted_creator_id` pending their confirmation, so the client does not re-search or
  re-brief. Client can edit before submitting.
- On the creator accepting, a fresh `contracts` row generates as in section 3 (new project,
  new contract, current dates and amounts). At signing, both parties see the "Saved" tab, so
  a repeat booking is sign-in-one-tap for both. This is the retention loop: easy rebook plus
  instant re-sign.
- Also add a lightweight "Saved creators" list (reuse `favorites`) surfaced in the client
  area with a Rebook button per creator.

## 7. Security and RLS
- `contracts`, `contract_signatures`, `saved_signatures`: readable only by the two parties
  (and admin). Writes go through the SECURITY DEFINER RPCs / `sign-contract` function, not
  direct table writes from the client. Follow the platform pattern (see the hardened function
  grants migration and how admin RPCs check `is_platform_admin()`).
- Signature and contract buckets private; access via signed URLs scoped to a party.
- Store IP and user agent for signatures only (consistent with `legal_acceptances` and the
  booking audit fields already present).

## 8. Acceptance criteria
1. Accepting a proposal auto-creates a `sent` contract with a correct 50/50 money table and
   the right fee percentages for the creator's tier.
2. A client on an iPhone can draw a signature with a finger and sign; a client on a PC can
   draw with a mouse or type a name and sign. Both produce a valid embedded signature in the
   PDF.
3. A returning client can sign a rebooked contract with one tap using a saved signature.
4. The retainer cannot be charged until status is `countersigned`; the error copy is shown.
5. The final PDF embeds both signatures and an audit page with name, timestamp, IP, and the
   content hash; the hash matches what each party signed.
6. All new UI uses the existing tokens and components, dark mode, no em or en dashes.
7. RLS: a third user cannot read either party's contract, signatures, or saved signatures.

## 9. Non-goals and caveats
- Not DocuSign-grade certificate authority; this is first-party e-sign. Attorney review
  required for ESIGN / UETA before production reliance. Do not claim notarization.
- No AI generation of people or imagery anywhere in this feature.
- Clause language in the sample is a draft; final wording comes from the attorney pass.

## 10. File and endpoint checklist for Codex
New:
- migration: `contracts`, `contract_signatures`, `saved_signatures`, buckets, RLS, RPCs
  (`generate_contract_for_project`, `rebook_project`), gate helper.
- edge function: `supabase/functions/sign-contract`.
- `src/utils/contractTerms.js` (pure term assembly + hash), `src/utils/contractPdf.js`.
- `src/components/SignaturePad.jsx`, `src/components/ContractSignModal.jsx`,
  `src/components/ContractView.jsx`, `src/components/RebookButton.jsx`.
Changed:
- `accept_project_application` (generate contract on accept).
- `create-payment-intent` (retainer gate on countersigned).
- Project/booking screens (`ProjectBoard.jsx`, `CheckoutPage.jsx`, `CreatorDashboard.jsx`,
  client project area) to surface contract status, the sign action, and Rebook.
- `create-storage-signed-url` (allow the new private buckets, party-scoped).
Reuse: `src/utils/pdf.js`, notifications, `_shared/rateLimit.ts`, `favorites`, `.cb-modal`
pattern, `btn-gold`/`btn-ghost`/`liquid-glass`.
