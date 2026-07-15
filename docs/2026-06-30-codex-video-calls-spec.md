# Codex Build Spec — Post-Booking Video Calls (Zoom Video SDK)
Date: 2026-06-30. Planning handoff for Codex. Claude wrote this spec; Codex builds it.
Companion decisions doc: docs/2026-06-30-video-calls-decisions-notes.md (read it first).
Repo: content-pricing-calc (React 18 + Vite, Supabase Postgres + RLS + edge functions,
Stripe Connect, Bunny + Supabase Storage).

Do NOT deploy and do NOT apply migrations to production. Build a feature branch, open a PR.
Attorney review is required for the recording-consent wording, the retention promise, and the
recording-access wording before this ships. Do not claim notarization or legal certification.

## 0. Goal
After a client books a creator and pays the retainer, let the two of them hold a recorded
video call inside CreatorBridge. The call is transcribed, an AI draft summary is posted into
the project thread as a shared record both parties can see and edit, the creator is the
accountable owner of its accuracy, and the raw recording plus transcript are retained for a
bounded window and then auto-deleted. Calls exist only for booked, paid projects.

## 1. Verified basis (do not re-derive)
- Zoom Video SDK: server-signed JWT (Video SDK secret), room/session based, no per-host
  licenses. Cloud recording enabled by cloud_recording_option in the JWT. Native transcript
  (VTT) via cloud_recording_transcript_option. Web SDK (WebRTC + WebAssembly, v2.1.0+) runs
  in desktop and mobile browsers up to 1080p, no native app.
- Cost: about $0.0035 per participant-minute, first 10,000 participant-minutes/month free,
  cloud recording about $4 per 1,000 minutes. Volume is naturally bounded because calls
  require a paid booking.
- Consent law: 12 all-party consent states in 2026 (CA, CT, DE, FL, IL, MD, MA, MT, NH, OR,
  PA, WA); interstate rule means treat every call as all-party. Capture consent from both
  parties, every call.
- Reuse: availability calendar + availability table; notification center; project status
  flow (retainer_paid, in_progress, revision, delivered, approved); server-only secrets in
  edge functions; private Supabase Storage buckets with signed URLs; the scheduled
  cleanup-support-screenshots job pattern for retention deletion.

## 2. Design language
Match the platform: Cormorant Garamond display, Inter body, clay, forest, oxblood, ivory,
stone on espresso, liquid-glass panels, btn-gold and btn-ghost, the .cb-modal pattern,
lucide icons, dark mode only. No em dashes or en dashes anywhere. The in-call surface is
embedded (Video SDK web) so the call never leaves CreatorBridge.

## 3. Decisions to implement (from the decisions doc)
- Gate: "Schedule a call" appears only when projects.status is retainer_paid or later, and a
  countersigned contract exists (contracts precede the retainer). Set expectation copy on the
  creator profile / pre-booking DM ("video calls unlock after you book") and at checkout.
- Recording: required. If either party declines the consent, the call does not start; route
  them to messaging.
- Storage and retention: on the recording-completed webhook, copy the recording and
  transcript into a private CreatorBridge bucket and delete the Zoom-cloud copy. Retain the
  raw recording and transcript for 120 days after the final payment releases, then auto-delete
  via a scheduled job. Keep the confirmed summary text indefinitely.
- Shared summary: post the AI draft into the project thread as a shared "Call summary" both
  parties see from the start (labeled draft pending review). Both parties can edit; the
  creator is the accountable owner. Never creator-only. Every edit is versioned and
  attributed; a "both agree this is accurate" acknowledgment timestamps the agreed version.
- Access: both parties can view and download the recording of a call they were on, and see
  and edit the summary. Attorney blesses the exact wording.
- Scheduling: either party may initiate, constrained to the creator's published availability;
  the creator can reschedule or decline.
- Caps: 60-minute per-call cap with an end-of-call warning; 3 calls included per project,
  additional by request.
- Reschedule / cancel / no-show: reschedule up to 12 hours before with no penalty, inside 12
  hours is a logged late reschedule; either party may cancel without affecting the booking;
  10-minute no-show grace then mark and log; repeated creator no-shows feed the reliability
  signal. Reminders at 24 hours, 1 hour, and at start. No monetary penalties.

## 4. Data model (new tables, migration with RLS)
- project_calls: id, project_id, creator_id, client_id, scheduled_at timestamptz,
  duration_minutes int default 60, status text check in
  ('scheduled','in_progress','completed','no_show','cancelled'),
  zoom_session_name text unique, initiated_by uuid, recording_ref text, transcript_ref text,
  recording_expires_at timestamptz, created_at, updated_at.
- call_consents: id, call_id fk, user_id, role text check in ('creator','client'),
  consent_text text, ip_address text, user_agent text, consented_at timestamptz.
  Unique (call_id, user_id). A call may not start until both rows exist.
- call_summaries: id, call_id fk, project_id, body text, status text check in
  ('draft','edited','agreed'), created_at, updated_at, last_edited_by uuid, agreed_at,
  agreed_by_creator bool default false, agreed_by_client bool default false.
- call_summary_revisions: id, summary_id fk, editor_user_id, body_snapshot text, created_at.
  (Append a snapshot on every edit for the attributed history.)
- Optional cross-feature: dispute_evidence link table (dispute_id, artifact_type in
  ('contract','deliverable','call_summary','message'), artifact_id) for the dispute bundle.

Storage: private buckets call-recordings and call-transcripts. Access only via
create-storage-signed-url (extend allowed buckets, party-scoped).

## 5. Zoom integration
- A Video SDK app (Zoom App Marketplace) provides SDK Key and Secret; store the Secret as an
  edge-function env secret only, never in the client bundle.
- Edge function create-call-token: authenticated; verifies the caller is the creator or
  client on that project_call; signs the session JWT with the Video SDK secret; sets
  cloud_recording_option and cloud_recording_transcript_option so the session records and
  transcribes; returns the JWT and session name to the client SDK. Rate limited.
- Edge function zoom-webhook: signature-verified (like stripe-webhook). Handles the
  recording-completed event: downloads the recording and VTT transcript, uploads them to the
  private buckets, sets project_calls.recording_ref and transcript_ref and
  recording_expires_at (final_released_at + 120 days), deletes the Zoom-cloud copy, then
  triggers summary generation.
- Edge function summarize-call: takes the VTT transcript, generates a structured draft
  summary (agreed scope, decisions, action items, dates), inserts call_summaries(status
  'draft'), and posts it into the project thread. Reuse the platform AI pattern.

## 6. Consent, recording, summary flow
1. Both parties open the call screen and must acknowledge the recording-consent notice
   (checkbox + name), which writes call_consents (name, ip, user_agent, timestamp). The
   Join button is disabled until both have consented.
2. The embedded Video SDK session starts recording and transcribing automatically.
3. On end (or the 60-minute cap with a warning), Zoom processes the recording and fires the
   webhook. zoom-webhook stores the files and summarize-call posts the draft summary.
4. The shared "Call summary" appears in the thread, editable by both, versioned and
   attributed. Either party can propose edits; the creator finalizes. A "both agree this is
   accurate" action marks status 'agreed' and stamps agreed_at.
5. A scheduled job (cleanup pattern) deletes recordings and transcripts past
   recording_expires_at, keeping the summary text.

## 7. Security and RLS
- project_calls, call_consents, call_summaries, call_summary_revisions, and the recording and
  transcript buckets are readable only by the two parties and admin.
- All sensitive writes go through authenticated edge functions or SECURITY DEFINER RPCs, not
  direct client table writes. Follow the hardened-grants pattern.
- Video SDK secret and JWT signing are server-only. Recording and transcript access via
  short-lived signed URLs, never public.

## 8. Screens
- Project workspace: "Schedule a call" (gated), a call card showing status and join, the
  consent screen, the embedded call, and the shared editable Call summary with version
  history and the agree action.
- Expectation copy on the creator profile / pre-booking DM and at checkout.
- Notifications: scheduled, reminders (24h, 1h, at start), summary ready.

## 9. Acceptance criteria
1. A call cannot be scheduled unless the project is retainer paid or later with a
   countersigned contract.
2. Both parties must consent before the call starts; a declined consent blocks the call and
   points to messaging; consent rows are recorded with name, ip, timestamp.
3. A call on an iPhone browser and on a desktop browser both connect, record, and transcribe.
4. After the call, a draft summary appears in the thread, both parties can edit it, edits are
   versioned and attributed, and the agree action marks it agreed.
5. Both parties can view and download the recording via a signed URL; third parties cannot.
6. Recordings and transcripts auto-delete 120 days after final release; the summary persists.
7. Caps enforced: 60-minute call, 3 calls per project with a request path for more.
8. All UI uses the existing brand tokens, dark mode, no em or en dashes. RLS blocks any third
   party from calls, consents, summaries, recordings, or transcripts.

## 10. Non-goals and legal
- First-party recording and consent; attorney review required for consent and retention
  wording under state all-party consent law before production.
- No AI generation of people. AI is used only to summarize the real transcript.
- The platform does not certify the summary; the creator owns its accuracy, both parties can
  correct it.

## 11. File and endpoint checklist for Codex
New: migration (project_calls, call_consents, call_summaries, call_summary_revisions,
optional dispute_evidence, buckets, RLS, RPCs); edge functions create-call-token,
zoom-webhook, summarize-call; scheduled retention-cleanup job; components
ScheduleCallModal.jsx, CallConsent.jsx, CallRoom.jsx (Video SDK embed), CallSummary.jsx.
Changed: project workspace (ProjectBoard.jsx / CreatorDashboard.jsx / client area) to surface
scheduling, the call, and the summary; create-storage-signed-url (new private buckets);
creator profile and CheckoutPage.jsx expectation copy; notifications.
Reuse: availability calendar, notification center, _shared/rateLimit.ts, the cleanup job
pattern, the .cb-modal and btn-gold/btn-ghost/liquid-glass styles.
