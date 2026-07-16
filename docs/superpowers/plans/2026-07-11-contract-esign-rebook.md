# Contract, E-Signature, and Rebooking Implementation Plan

**Goal:** Generate a private production agreement from an accepted proposal, collect two party-scoped electronic signatures, gate the retainer on countersigning, and let past clients create an editable rebooking draft.

**Source of truth:** `docs/2026-06-30-codex-contract-esign-rebook-spec.md` and the approved contract mockup. The implementation keeps the mockup's design while using the platform's current payment, cancellation, fee, and language rules.

**Safety boundary:** Build and verify on `feature/contract-esign-rebook`. Do not deploy functions or apply migrations. Keep the attorney-review notice visible in the contract UI and PDF.

## Phase 1: Data and security

- [x] Add contract, signature, and saved-signature tables with checks, indexes, timestamps, private buckets, and RLS.
- [x] Add a package reference to proposals so accepted terms never guess deliverables, turnaround, or revisions.
- [x] Add idempotent contract-generation and rebooking RPCs with explicit grants.
- [x] Extend signed storage access for contract parties and saved-signature owners.
- [ ] Add database verification for third-party denial, valid status transitions, and legacy payment compatibility.

## Phase 2: Terms and PDF generation

- [x] Add pure canonical term assembly and hashing utilities with Node unit tests.
- [x] Add the print-safe PDF renderer with the real CreatorBridge logo, money ledger, signatures, and audit certificate.
- [x] Add an authenticated, rate-limited generation function that renders and stores the initial PDF after acceptance.
- [x] Update proposal acceptance to prepare the contract and expose a recoverable retry state if PDF preparation fails.
- [x] Render the generated PDF to images and inspect every page for clipping, missing assets, and incorrect language.

## Phase 3: Signing experience

- [x] Build the high-DPI Pointer Events signature pad with Draw, Type, and Saved modes, Undo, Clear, and transparent PNG output.
- [x] Build the approved contract view and responsive signing modal with scroll gate, legal name, consent, and attorney-review notice.
- [x] Add the authenticated sign-contract function with party checks, stable-hash validation, idempotency, audit metadata, saved signatures, status advancement, PDF regeneration, and notifications.
- [ ] Verify touch, mouse, typed, and saved signature paths at desktop and mobile dimensions.

## Phase 4: Payment and rebooking

- [x] Gate only contract-backed retainers on `countersigned`; preserve legacy projects and final payments.
- [x] Show contract status and signing actions in project and checkout surfaces.
- [x] Add rebooking from completed projects, past-client creator profiles, project history, and saved creators.
- [x] Create editable rebooking drafts that preserve the prior creator, package, and brief while requiring fresh acceptance and signatures.

## Phase 5: Attack, verify, and publish for review

- [x] Add focused verification scripts for terms, hashing, RLS declarations, private storage, payment gating, and rebooking invariants.
- [x] Run unit tests, platform language checks, the platform audit, the launch sweep where local credentials permit it, and `npm run build`.
- [x] Test the major client and creator paths in a real browser at desktop and mobile dimensions and inspect console errors.
- [x] Scan changed code, comments, UI copy, and generated document copy for forbidden Unicode dashes, `marketplace`, `escrow`, and notarization claims.
- [ ] Review the complete diff, commit the intended files, push the feature branch, and open a pull request without deploying.
