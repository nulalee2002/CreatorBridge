# Creator Collaboration and Platform Intelligence Design

Date: June 22, 2026
Status: Approved design; implementation plan pending user review

## Purpose

CreatorBridge will support a production supply chain in which a verified creator can both offer services and hire another verified creator. The original video-production or photography creator remains the prime contractor and the only party communicating with the outside client. Post-production and other invited creators operate as protected subcontractors.

CreatorBridge will also introduce a permanent Platform Intelligence subsystem. This is not temporary beta instrumentation. It is the governed source of truth for platform behavior, conversion, financial performance, safety, retention, and workflow outcomes. Its definitions, privacy boundaries, retention rules, scheduled reports, and AI export contract are foundational product infrastructure.

## Product Principles

CreatorBridge uses one verified identity per person. A creator does not create a second client account to hire another creator. The same authenticated identity can switch between offering services and hiring services while preserving one verification history, one message identity, and one audit trail.

The prime contractor owns the outside-client relationship, scope, price, and final delivery obligation. Subcontractors communicate with the prime contractor, not the outside client. A subcontractor's identity, rate, messages, production workspace, and internal delivery are private unless the prime contractor deliberately changes the engagement model in a future client-approved collaboration feature.

The platform follows controlled exposure rather than pretending off-platform leakage can be eliminated. Discovery, scope, payment, approvals, disputes, reviews, and transaction evidence remain inside CreatorBridge. Large working files may use approved external providers only after the subcontract is funded. CreatorBridge makes staying on-platform safer and easier than leaving, but does not claim it can inspect or control private external workspaces.

Platform Intelligence records actions and outcomes, not private content. CreatorBridge will not use direct-message bodies, private-message contents, creative files, or external workspace contents for product analytics or AI analysis.

## Creator Collaboration Model

### Identity and modes

The current single `profiles.role` presentation model will be replaced or supplemented by capabilities. A verified creator may enter a hiring mode without changing or duplicating their account. Navigation and dashboards must expose both work offered and work commissioned.

Authorization must never rely on user-editable authentication metadata. Hiring, listing ownership, project participation, payment authority, and admin access must be determined from trusted database records and server-side checks.

### Project relationships

Every collaboration belongs to a persisted project and records the outside client, prime contractor, and zero or more subcontractors as distinct roles. The prime contractor is responsible for subcontract scope, delivery acceptance, change requests, and payment. Subcontractors receive only the project context and files necessary for their assignment.

The subcontract price is funded from the prime contractor's agreed project revenue. It does not alter the outside client's total. If additional outside-client money is required, the prime contractor must obtain an approved change order before funding the subcontract.

Subcontractor invitations, acceptance, decline, removal, scope changes, and completion are immutable audit events. Removing a subcontractor never deletes the historical project record.

### Booking, fees, and payment

Creator collaboration has no 5% buyer platform fee. The subcontractor pays their earned creator fee of 10%, 8%, or 6%, subject to the existing minimum platform fee of $5 after credits. Internal collaborations do not advance public loyalty or reputation tiers during the initial policy period.

The minimum collaboration amount remains $250. Smaller tasks are bundled into professional packages. Every rejected attempt below the floor records the proposed amount, service category, workflow location, and abandonment outcome without creating a booking.

Creator-to-creator collaboration payments are ACH-only during the initial release. The hiring prime contractor pays the disclosed ACH processing cost. The subcontractor does not begin work until the server records settlement. Failed payments, returns, refunds, and disputes are handled by explicit collaboration terms and authoritative Stripe webhook events.

The initial payment structure follows the protected 50/50 workflow unless the implementation plan establishes a safer ACH-specific settlement sequence. The platform must never describe funds as legally regulated escrow unless counsel confirms that terminology is accurate for the implemented Stripe flow.

After approximately 20 completed collaborations, CreatorBridge reviews completed amounts, attempted sub-floor amounts, abandonment points, processing costs, support load, disputes, and qualitative survey responses before considering a separate $100-$150 collaboration minimum.

### Reputation and anti-gaming

Internal reviews display as `Verified Creator Collaboration`. They do not change public-client ratings, completed-project loyalty counts, or creator tiers during the initial policy period.

Reciprocity, velocity, shared payment signals available through trusted Stripe data, and repeated low-value patterns may trigger manual review. Missing repeat bookings are analytics signals only and can never independently justify a warning, suspension, or accusation of circumvention.

### Repeat collaboration

The platform will provide a low-friction rehire path that can reuse the prior collaborator, service category, scope structure, workspace provider, and payment setup while requiring a new confirmed price and scope. The value proposition for staying is protected payment, documented revisions, delivery evidence, dispute support, and reduced administrative work.

## Project File Workspaces

### Two-workspace boundary

Each project supports two logically separate private workspaces. The Client Delivery Workspace connects the outside client and prime contractor. The Production Team Workspace connects the prime contractor and authorized subcontractors. Subcontractors do not gain client-workspace access by default, and outside clients do not gain team-workspace access.

### Approved external providers

The initial provider allowlist is Google Drive, Dropbox, Frame.io, Blackmagic Cloud, and MASV. Providers are recommended by workflow suitability, not by a false claim that any provider prevents contact sharing. Only HTTPS links from approved hostnames are accepted. URL shorteners and unknown redirect domains are rejected.

The actual workspace URL is private and becomes available only after an active funded booking. CreatorBridge stores the provider, normalized URL, project, workspace type, submitter, creation time, replacement history, revocation state, and access-related support events. CreatorBridge does not crawl or analyze workspace contents.

The submitting participant remains responsible for provider permissions, backups, copyright, retention, malware safety, and account availability. Provider validation confirms the hostname and URL structure, not the safety or contents of the workspace.

### Storage responsibilities

Supabase remains the control plane for identity, permissions, project metadata, audit history, contracts, small reference files, and delivery evidence. Bunny Stream remains the playback layer for creator introductions, portfolio videos, and watermarked video review copies. Neither service is treated as permanent storage for camera originals, RAW photo collections, layered project files, or large production archives.

Native large-file storage may be added later after secure direct-upload, lifecycle, cost-control, and retention behavior are verified. Supabase Edge Functions must not proxy large media bodies.

### Delivery evidence

A final subcontract delivery records a server timestamp, provider link, submitting participant, delivery note, version, filenames or manifest, file sizes when supplied, and an immutable status transition. Video delivery includes a watermarked Bunny review copy when practical. Photography delivery includes private low-resolution previews or contact sheets when practical. Checksums may anchor exact files without requiring CreatorBridge to retain the source media.

The prime contractor accepts the delivery or requests revisions inside CreatorBridge. Acceptance, rather than the mere existence of a link, authorizes release. A timed release may use the recorded delivery anchor and preview when the prime contractor becomes unresponsive, according to the governing project policy.

## Platform Intelligence Architecture

### Permanent event ledger

CreatorBridge will create an append-oriented, versioned event ledger with an extensible typed event name and versioned payload. Every event records its event version, occurred time, ingestion time, authority class, actor reference when permitted, session reference when permitted, entity type and ID, platform surface, and an allowlisted metadata payload.

Event payloads are validated against a registry. Unknown keys, message bodies, free-form creative text, file contents, payment credentials, and external workspace contents are rejected. The definition registry documents what each event and property means, its source, authority, privacy class, retention class, and the first version in which it is valid.

### Authority classes

Server-authoritative events are the source of truth for signups, verification, creator approval, project creation, quote submission, application acceptance, bookings, subcontract invitations and acceptance, payment initiation and settlement, refunds, disputes, delivery, approval, release, support status, violations, and account deletion.

Browser-directional events capture ephemeral behavior such as page and profile views, search and filter use, form starts, step progression, below-floor attempts, validation failures, and abandonment. Directional events may be lost to closed tabs, network failure, or client blocking and must never be used as financial or contractual truth.

### Platform-wide coverage

The initial taxonomy covers authentication and onboarding; creator application and review; search, matching, and profile discovery; quotes and project briefs; applications and booking conversion; creator collaboration; ACH payment lifecycle; messaging safety outcomes without message contents; Network participation; file-workspace lifecycle; delivery and revisions; reviews; disputes; support; referrals; retention and rehire; and administrative actions.

Existing authoritative tables remain the legal and financial source of truth. The event ledger references those records and supports analysis; it does not replace transaction, payment-event, project, dispute, support, or audit tables.

### Metric definition layer

Metrics are versioned data products, not ad hoc dashboard calculations. The registry defines at minimum active creator, active client, approved creator, external GMV, internal collaboration GMV, completed external project, completed collaboration, quote conversion, booking conversion, abandonment, below-floor attempt, successful workspace handoff, workspace failure, delivery cycle time, revision rate, dispute rate, repeat hire, creator retention, client retention, platform revenue, processing cost, and contribution after direct payment costs.

When a definition changes, the new version has an explicit effective boundary. Historical reports retain the definition version used so trends do not silently mix incompatible calculations.

### Surveys and qualitative evidence

Each completed collaboration offers both participants a three-question survey: whether the workflow was easier than arranging the work independently, whether the $250 minimum changed the scope, and whether file access worked. Responses are optional, linked to the collaboration for authorized analysis, and excluded from public reviews unless the respondent separately submits a review.

### Admin analytics and reports

Admin-only views and RPCs expose governed metrics without granting broad production-table access. The Admin Analytics area will distinguish external demand from internal collaboration, authoritative counts from directional funnel estimates, and gross transaction volume from net-new outside money.

The reporting scaffold is part of the initial system. A scheduler generates a weekly operational report, a monthly performance report, and a quarterly strategic report. Initial reports may be simple, but schedules, definitions, archive records, generation status, access control, and historical comparison are permanent infrastructure.

Reports are archived in an admin-only table with period boundaries, definition versions, generation status, source freshness, metric payload, narrative status, and export references. Failed or stale reports show an explicit warning and never silently reuse old data.

The default operating schedule is Monday at 9:00 AM America/Phoenix for weekly reports, the first day of each month at 9:00 AM America/Phoenix for monthly reports, and the first day of each calendar quarter at 9:00 AM America/Phoenix for quarterly reports. The implementation must use timezone-aware scheduling and document daylight-saving behavior.

### AI-ready analysis interface

Claude, Codex, future employees, and other approved consumers read the same sanitized data product. They do not require unrestricted production access.

The export contract supports JSON and CSV generated from approved views. It excludes direct identifiers, message contents, files, workspace contents, payment credentials, addresses, and unnecessary free text. It includes metric definitions, definition versions, report period, cohort-suppression notices, authority labels, data-freshness status, and provenance.

Exports are short-lived, revocable, admin-only artifacts with automatic expiration. They are regenerated rather than treated as permanent archives. AI analysis output is advisory; policy and enforcement decisions remain human-owned.

## Privacy, Retention, and Deletion

### Analytics boundary

Platform Intelligence collects actions, outcomes, categories, timings, and operational or financial metadata. It does not collect, read, or analyze direct-message bodies, private-message contents, creative files, or external workspace contents.

Automated message filtering may inspect a message at send time solely to enforce safety and contact-sharing rules. Analytics and violation records store the resulting action and pattern category, not the message body. The public privacy policy must state this distinction plainly.

### Retention classes

Identifiable raw behavioral events are retained for 13 months. After that period, eligible events are pseudonymized and may remain in detailed form through 24 months. Truly aggregated, non-identifiable business metrics may be retained indefinitely. Financial, tax, contractual, payment, dispute, and legally required safety records follow their separately documented retention obligations.

Pseudonymization must be genuine. The re-identification mapping or key is stored separately from analytical data, encrypted, and accessible only through narrowly authorized server operations. It is not a predictable or unsalted user hash.

Indefinite aggregates must be non-identifiable. Reports and exports suppress or combine small cohorts using a documented threshold. The initial threshold is five distinct actors; legal and privacy review may require a higher threshold for sensitive dimensions.

### Deletion propagation

Account deletion removes or irreversibly pseudonymizes eligible behavioral identifiers while preserving anonymous aggregates. Deletion propagates to report drill-downs, unexpired exports, caches, and regeneration indexes. Financial or legal records retained under another obligation are isolated from product analytics and remain only for that obligation.

AI exports contain no direct identifiers and expire automatically. If an eligible user deletion occurs while an export remains active, the export is revoked and regenerated. CreatorBridge does not promise deletion from a third-party AI provider unless the provider contract and configuration support it; instead, the system minimizes this risk by exporting only scoped, de-identified information and by documenting approved AI handling requirements.

### Legal and policy gates

Before launch, qualified privacy counsel must review the 13-month, 24-month, and indefinite aggregate retention choices against applicable US state privacy requirements, deletion rights, notice obligations, and the actual jurisdictions in which CreatorBridge operates.

The privacy policy, Terms, admin documentation, and data inventory must use the same definitions. Material changes to collection or retention require policy review and user notice where applicable.

## Security and Access Control

Platform Intelligence tables and report archives use row-level security and explicit grants. Raw events are not directly readable by ordinary authenticated users. Admin access depends on trusted server-side admin authorization, not editable user metadata.

Financial and contractual events are written by trusted database functions, Stripe webhooks, or protected Edge Functions. Browser event ingestion uses an allowlisted schema, rate limits, payload-size limits, origin validation, and server-derived identity where available. The service role and provider secrets never enter client code.

Admin actions, export generation, export download, report regeneration, retention jobs, pseudonymization, and deletion propagation are themselves audited.

## Reliability and Error Handling

Authoritative business operations must not depend on analytics ingestion succeeding. The source transaction commits first; event recording is transactional where practical or retried from an outbox where cross-service work is required. A failed analytics write never causes a user to be charged twice or a project state to diverge.

Browser instrumentation fails silently from the user's perspective but records client diagnostics when possible. Duplicate events use idempotency keys. Scheduler jobs use locks and period keys so retries cannot create duplicate reports.

Every report states source freshness, missing-source warnings, definition version, and whether a metric is authoritative or directional.

## Verification Requirements

Automated verification must prove RLS isolation, event payload rejection, message-body exclusion, server-authoritative event creation, browser-event rate limiting, idempotency, small-cohort suppression, retention transitions, pseudonym-key separation, deletion propagation, export expiration and revocation, report scheduler idempotency, stale-data warnings, and admin-only access.

Collaboration verification must cover dual-mode identity, prime-only client communication, subcontractor visibility boundaries, no buyer platform fee, earned subcontractor fee with $5 floor, $250 minimum, sub-floor abandonment logging, ACH settlement gating, workspace access separation, approved-domain validation, delivery evidence, review labeling, tier isolation, and repeat-hire behavior.

Browser verification must cover desktop and mobile flows for creator hiring mode, subcontract invitation, ACH status, both workspaces, delivery acceptance, the three-question survey, Admin Analytics, report archive, and privacy-policy disclosure.

## Delivery Sequence

The implementation plan will divide this design into independently verifiable phases. The required dependency order is trusted identity and project-role model; event ledger, definition registry, and privacy controls; collaboration booking and ACH payments; workspace and delivery evidence; reputation and anti-gaming; admin views and AI exports; retention and deletion jobs; report scheduler and archive; policy updates; then full browser and live-service verification.

Instrumentation for an interaction ships before or with that interaction, never afterward. No collaboration feature is considered launch-ready if its ephemeral abandonment and failure events are absent.

## Decisions Reserved for Later Evidence

The $250 collaboration minimum remains until the defined evidence review. Native large-file hosting remains deferred until secure direct upload, lifecycle, and cost controls are validated. Client-visible collaborative teams remain outside the initial model. Public reputation treatment for internal collaborations remains separated until anti-gaming and external-demand effects are understood.

These are deliberate product boundaries, not missing implementation details.
