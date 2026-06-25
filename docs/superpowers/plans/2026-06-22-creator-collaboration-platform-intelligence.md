# Creator Collaboration and Platform Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build secure creator-to-creator subcontracting and a permanent, privacy-bounded Platform Intelligence system before public collaboration launch.

**Architecture:** Supabase remains the trusted control plane. Capability and project-participant records replace role assumptions for authorization; server events form the authoritative intelligence ledger while allowlisted browser events capture directional funnels. Collaboration payments, private external workspaces, delivery anchors, reputation isolation, governed analytics views, retention jobs, and scheduled reports build on that foundation.

**Tech Stack:** React 18, React Router, Supabase Postgres/Auth/RLS/Edge Functions/Cron, Stripe Connect and ACH, Bunny Stream, Node verification scripts, Vite.

## Global Constraints

One verified identity can offer services and hire collaborators. Editable auth metadata is never authorization. The outside client communicates only with the prime contractor. Creator collaboration has no 5% buyer platform fee; the subcontractor pays the earned 10%, 8%, or 6% fee with a $5 minimum. The collaboration floor is $250. Collaboration payment is ACH-only and work cannot begin before settlement. Internal reviews do not affect public ratings, loyalty, or tiers. Analytics never contains DM bodies, private-message contents, creative files, or external workspace contents. Identifiable behavioral events retain for 13 months, pseudonymized detail through 24 months, and non-identifiable aggregates indefinitely, subject to legal review. Public collaboration does not launch until the complete intelligence governance foundation passes verification.

---

### Task 1: Trusted capabilities and project participants

**Files:**

- Create with `supabase migration new creator_capabilities_project_roles`: the CLI-emitted migration file
- Create: `scripts/verify-creator-collaboration-foundation.mjs`
- Modify: `package.json`
- Modify: `scripts/audit-platform.mjs`

**Interfaces:**

- Produces `public.account_capabilities(user_id uuid, capability text, granted_at timestamptz, granted_by uuid)`.
- Produces `public.project_participants(project_id uuid, user_id uuid, participant_role text, creator_listing_id uuid, status text, joined_at timestamptz)`.
- Produces `public.has_account_capability(uuid, text) returns boolean` and `public.is_project_participant(uuid, uuid, text[]) returns boolean` in the private schema where authorization helpers are not Data API exposed.
- Preserves `profiles.role` temporarily for display and backward compatibility.

- [x] **Step 1: Write the failing foundation verifier**

Create a verifier that reads all migrations and asserts capability constraints for `client`, `creator`, and `admin`; participant roles for `outside_client`, `prime_contractor`, and `subcontractor`; unique participant membership; RLS; private authorization helpers; and no use of `raw_user_meta_data` in authorization policies.

- [x] **Step 2: Run the verifier and confirm failure**

Run `node scripts/verify-creator-collaboration-foundation.mjs`. Expected: nonzero exit with missing capability and participant contracts.

- [x] **Step 3: Generate and implement the migration**

Run `supabase migration new creator_capabilities_project_roles`. In the emitted file, create both tables, constraints, indexes, private-schema helper functions, explicit grants, RLS policies, and a backfill that grants `creator` capability to users owning creator listings and `client` capability to existing project owners or client profiles. Never remove an existing role during backfill.

- [x] **Step 4: Verify static contracts and existing audit**

Run `node scripts/verify-creator-collaboration-foundation.mjs && npm run audit:platform`. Expected: all checks pass.

- [x] **Step 5: Apply and verify live isolation**

Run `supabase db push`, then extend the verifier to authenticate QA client and creator accounts and prove ordinary users cannot grant capabilities, cannot insert another user's participant row, and cannot read unrelated private project participation.

- [x] **Step 6: Commit**

Commit the migration, verifier, package script, and audit changes with `Add trusted creator collaboration roles`.

### Task 2: Permanent Platform Intelligence ledger and definitions

**Files:**

- Create with `supabase migration new platform_intelligence_ledger`: the CLI-emitted migration file
- Create: `src/lib/platformIntelligence.js`
- Create: `scripts/verify-platform-intelligence.mjs`
- Modify: `package.json`
- Modify: server functions that already own authoritative state transitions

**Interfaces:**

- Produces append-only `platform_events`, `platform_event_definitions`, and an event outbox/retry contract.
- Produces server RPC `record_directional_platform_event(p_event_name text, p_event_version integer, p_entity_type text, p_entity_id uuid, p_surface text, p_properties jsonb)` with strict allowlists.
- Produces browser helper `recordDirectionalEvent({ name, version, entityType, entityId, surface, properties })`.

- [x] **Step 1: Write failing privacy and authority tests**

Assert rejection of keys named `message`, `body`, `content`, `file`, `workspace_contents`, email, phone, address, payment token, and arbitrary free text. Assert event authority values `server_authoritative` and `browser_directional`.

- [x] **Step 2: Run and confirm failure**

Run `node scripts/verify-platform-intelligence.mjs`. Expected: missing ledger, registry, and privacy enforcement.

- [x] **Step 3: Create the ledger migration**

Create definition and event tables with event UUID, idempotency key, name, version, authority, actor, session, entity, surface, occurred/ingested timestamps, privacy class, retention class, and validated JSON properties. Enable RLS, revoke ordinary reads, and restrict writes to the directional RPC or trusted service operations.

- [x] **Step 4: Seed versioned definitions**

Seed the approved platform-wide taxonomy for authentication, onboarding, discovery, quotes, projects, applications, bookings, collaboration, payments, messaging-safety outcomes, Network, workspaces, delivery, reviews, disputes, support, referrals, retention, rehire, and admin actions.

- [x] **Step 5: Add the safe browser helper**

Implement a non-blocking helper that sends only allowlisted structured properties, never throws into the user workflow, and attaches no user identity from caller input.

- [x] **Step 6: Add authoritative outbox writes**

Update trusted project, payment, dispute, support, and admin state transitions to record events transactionally or through an idempotent outbox. A failed analytics delivery must not roll back or repeat payment behavior.

- [x] **Step 7: Verify and commit**

Run the intelligence verifier, platform audit, build, and live RLS checks. Commit as `Add governed platform intelligence ledger`.

### Task 3: Creator hiring UX and collaboration lifecycle

**Files:**

- Create: `src/components/creator/HireCollaboratorButton.jsx`
- Create: `src/components/collaboration/CollaborationComposer.jsx`
- Create: `src/components/collaboration/CreatorCollaborationIntro.jsx`
- Create: `src/pages/CreatorHiringDashboard.jsx`
- Modify: `src/pages/CreatorProfilePage.jsx`
- Modify: `src/pages/CreatorDashboard.jsx`
- Modify: `src/components/CreatorDirectory.jsx`
- Modify: `src/App.jsx`
- Create with `supabase migration new creator_collaboration_lifecycle`: the CLI-emitted migration file
- Create: `scripts/verify-creator-collaboration-lifecycle.mjs`

**Interfaces:**

- Produces profile CTA `Hire as a Collaborator` for verified creators viewing another creator.
- Produces contextual CTA `Add to This Project` when an eligible active project is selected.
- Produces a deliberate four-surface discovery contract across dashboard, creator search, profiles, and active projects.
- Produces `creator_collaborations` lifecycle with invited, accepted, funding_pending, funded, in_progress, delivered, revision, approved, disputed, completed, declined, and cancelled states.

- [ ] **Step 1: Write failing lifecycle tests**

Test self-hire rejection, unapproved-creator rejection, prime ownership, $250 floor, outside-client isolation, participant creation, legal transitions, and sub-floor directional logging.

- [ ] **Step 2: Implement database lifecycle and RLS**

Create collaboration records and trusted transition RPCs. Only the prime may invite, fund, request revisions, approve, or cancel; only the invited creator may accept or decline; both may read their collaboration; the outside client cannot read it.

- [ ] **Step 3: Implement discovery and profile CTAs**

Render `Request a Quote` for outside clients, `Hire as a Collaborator` for verified creators viewing another eligible creator, `Add to This Project` in active-project context, and no hire CTA on one's own profile. Do not use `Let's subcontract`. Preserve project context so the prime can enter only scope, price, deadline, and workspace. Add permanent `Build Your Team` discovery to the creator dashboard with Post Production, software, specialty, turnaround, location requirements, and collaboration-availability filters. Add `Find Your Finishing Team` positioning to Post Production discovery and `Open to Creator Collaborations` badges to opted-in eligible profiles.

- [ ] **Step 4: Implement composer and instrumentation**

Present exactly two paths: attach the creator to an existing eligible project or create a standalone creator collaboration. Collect structured scope, price, deadline, service, workspace, and provider intent. Before sending an invitation, disclose the $250 minimum, ACH requirement, processing cost, private team workspace, and that the outside client will not see the subcontractor. Record starts, validation errors, sub-floor attempts, invitations, and abandonment.

- [ ] **Step 5: Implement first-visit creator guidance**

Show a short, dismissible introduction the first time a verified creator enters the dashboard after launch. Explain that the same account can offer services and hire collaborators, point to `Build Your Team`, and persist completion so the guide does not interrupt later visits.

- [ ] **Step 6: Verify desktop/mobile and commit**

Run static, live RLS, and browser flows. Commit as `Add creator hiring and collaboration lifecycle`.

### Task 4: ACH collaboration payments and fee isolation

**Files:**

- Create: `src/config/collaborationFees.js`
- Create: `supabase/functions/create-collaboration-payment/index.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Modify: `src/pages/CheckoutPage.jsx` or create a focused collaboration checkout page
- Create with `supabase migration new collaboration_payment_ledger`: the CLI-emitted migration file
- Create: `scripts/verify-collaboration-payments.mjs`

**Interfaces:**

- Prime buyer fee is zero.
- Subcontractor fee uses trusted completed external projects only and enforces a $5 minimum.
- Prime pays disclosed ACH cost; card payment methods are rejected for collaboration PaymentIntents.
- `funded` requires authoritative settlement, not browser success.

- [x] **Step 1: Write failing fee and payment tests**

Cover 10/8/6 percent tiers, $5 floor, zero buyer fee, $250 minimum, ACH-only methods, processing-cost disclosure, failed/returned ACH, idempotent webhooks, and no internal tier advancement.

- [x] **Step 2: Implement trusted server calculations**

Never accept fee percentages or settlement state from the browser. Store base amount, ACH processing cost, platform fee, subcontractor net, payment status, Stripe IDs, and idempotency keys.

- [x] **Step 3: Implement checkout and settlement UI**

Show project amount, ACH cost, subcontractor fee treatment, settlement delay, and `Do not begin work until funded`. Disable collaboration workspaces until settled.

- [x] **Step 4: Verify live Stripe test mode and commit**

Test success, pending, failure, return, duplicate webhook, refund, and cancellation. Commit as `Add protected ACH collaboration payments`.

### Task 5: Private workspaces and delivery anchors

**Files:**

- Create with `supabase migration new collaboration_workspaces_deliveries`: the CLI-emitted migration file
- Create: `src/components/collaboration/ProjectWorkspaces.jsx`
- Create: `src/components/collaboration/DeliveryAnchorForm.jsx`
- Modify: `src/pages/ProjectBoard.jsx`
- Create: `scripts/verify-collaboration-workspaces.mjs`

**Interfaces:**

- Workspace types are `client_delivery` and `production_team`.
- Approved providers are Drive, Dropbox, Frame.io, Blackmagic Cloud, and MASV.
- Produces immutable replacement/revocation history and delivery manifests with optional Bunny or private preview references.

- [ ] **Step 1: Write failing domain, visibility, and delivery tests**

Test payment-first access, hostname allowlist, redirect/shortener rejection, client/team isolation, link replacement history, revocation, delivery versioning, revision, acceptance, and timed-release evidence.

- [ ] **Step 2: Implement schema and trusted URL normalization**

Store normalized provider metadata and audit history without crawling contents. Provider secrets and user credentials are never stored.

- [ ] **Step 3: Implement the two workspace interfaces**

Show each participant only their authorized workspace. Include provider guidance and explicit creator responsibility for permissions, backups, copyright, and retention.

- [ ] **Step 4: Implement delivery anchors and commit**

Record timestamp, submitter, version, note, filenames, sizes, checksums, and preview references. Verify and commit as `Add private collaboration workspaces and delivery evidence`.

### Task 6: Collaboration reputation, rehire, and agreements

**Files:**

- Create with `supabase migration new collaboration_reviews_rehire`: the CLI-emitted migration file
- Modify: review display components and creator dashboard
- Modify: `src/pages/TermsPage.jsx`
- Modify: `src/pages/CreatorAgreement.jsx`
- Create: `scripts/verify-collaboration-reputation.mjs`

- [ ] **Step 1: Write failing reputation-isolation tests**

Prove collaboration reviews are labeled, excluded from public rating and loyalty counts, self-review is blocked, and missing repeat bookings never trigger enforcement.

- [ ] **Step 2: Implement review and rehire contracts**

Create separate collaboration review records and a rehire operation that copies structure but never silently copies price or scope approval.

- [ ] **Step 3: Add legally gated policy language**

Add the counsel-reviewed non-circumvention clause and perform a platform-wide `escrow` terminology inventory. Do not replace wording until counsel supplies the approved term.

- [ ] **Step 4: Verify and commit**

Commit as `Separate collaboration reputation and rehire`.

### Task 7: Governed metrics, retention, deletion, and AI exports

**Files:**

- Create with `supabase migration new platform_intelligence_governance`: the CLI-emitted migration file
- Create: `supabase/functions/export-platform-intelligence/index.ts`
- Create: `supabase/functions/retain-platform-intelligence/index.ts`
- Create: `supabase/functions/delete-platform-intelligence-subject/index.ts`
- Create: `scripts/verify-platform-intelligence-governance.mjs`

- [ ] **Step 1: Write failing metric-version and privacy tests**

Cover definition version boundaries, authority labels, small-cohort suppression below five actors, separate pseudonym mapping, export TTL/revocation, 13/24-month transitions, account deletion propagation, and legal-record isolation.

- [ ] **Step 2: Implement governed views and metric registry**

Define external/internal GMV, conversions, abandonment, collaboration completion, workspace failures, delivery time, disputes, repeat hire, retention, processing costs, and contribution margin.

- [ ] **Step 3: Implement retention and deletion jobs**

Use a separate encrypted pseudonym mapping accessible only to narrowly authorized functions. Revoke active exports and invalidate caches when deletion occurs.

- [ ] **Step 4: Implement sanitized JSON/CSV export**

Exports include provenance, period, versions, authority, freshness, and suppression notices while excluding direct identifiers and private content.

- [ ] **Step 5: Verify and commit**

Commit as `Add platform intelligence governance and exports`.

### Task 8: Admin analytics, surveys, reports, and recurring analysis

**Files:**

- Create with `supabase migration new platform_intelligence_reports`: the CLI-emitted migration file
- Modify: `src/pages/AdminAnalytics.jsx`
- Create: `src/components/analytics/CollaborationSurvey.jsx`
- Create: `supabase/functions/generate-platform-report/index.ts`
- Create: `scripts/verify-platform-intelligence-reports.mjs`

- [ ] **Step 1: Write failing report tests**

Cover weekly, monthly, and quarterly period keys; timezone-aware schedules; idempotent generation; archive access; stale-source warnings; empty/small-cohort training reports; and three-question survey storage.

- [ ] **Step 2: Implement report archive and scheduler**

Generate Monday 9:00 AM America/Phoenix weekly reports, first-day monthly reports, and first-day quarterly reports. Report generation must be lock-safe and retryable.

- [ ] **Step 3: Implement Admin Analytics views**

Separate external demand from internal collaboration, authoritative facts from directional funnels, and gross volume from net-new external money and contribution after processing.

- [ ] **Step 4: Implement survey and AI report handoff**

Store the approved three answers, provide governed export access, and configure the recurring Codex analysis only after the export endpoint passes live verification.

- [ ] **Step 5: Verify and commit**

Commit as `Add scheduled platform intelligence reporting`.

### Task 9: Public-launch gate and full regression

**Files:**

- Modify: `scripts/verify-launch-sweep.mjs`
- Modify: privacy/terms surfaces with counsel-approved retention disclosure
- Create: `scripts/verify-collaboration-launch.mjs`

- [ ] **Step 1: Add every collaboration and intelligence verifier to the launch sweep**

- [ ] **Step 2: Run build, audit, static, live Supabase, Stripe test-mode, desktop, and mobile verification**

- [ ] **Step 3: Confirm no public feature flag enables collaboration before all governance gates pass**

- [ ] **Step 4: Publish policies, deploy functions and migrations, push code, and repeat production browser verification**

- [ ] **Step 5: Create the recurring Codex report automation against the governed export and commit the launch record**
