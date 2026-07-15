# Video Calls (Zoom) — Running Decisions and Requirements Notes
Date started: 2026-06-30. Status: brainstorming, not yet a Codex spec.
Purpose: capture every decision, verified fact, open question, and requirement for
creator-to-client video calls so nothing is lost before we spec it for Codex.

## 1. Locked decisions
- Provider: Zoom. Google Meet was rejected because it lacks the same recording and
  transcript integration path.
- Gating: a call can only happen AFTER the client books the creator and pays the retainer.
  Both parties are told this upfront. This is an anti-abuse and cost control: no paid call
  minutes are spent on people who are not booking.
- Recording: yes, record the call audio (Zoom cloud recording), and generate a transcript.
- Ownership of the summary: the CREATOR is responsible for reviewing and correcting the
  summary and keeping it as their own business record. The platform provides the call, the
  recording, and an auto-draft summary, but does not certify the summary.
- Consent: both parties acknowledge a recording-consent notice before joining, every call.
- Communication ladder unchanged: browse, then filtered DMs pre-booking, then after the
  retainer is paid the call unlocks. Messaging pre-booking stays DM-only with the contact
  filter.

## 2. Verified facts (checked, not assumed)
Zoom Video SDK (developers.zoom.us):
- Auth is a server-signed JWT using the Video SDK secret. Sessions are room-based, so there
  are no per-host licenses and calls scale by usage, not seats.
- Cloud recording is enabled per session by setting cloud_recording_option in the JWT.
- Native transcript: set cloud_recording_transcript_option to get a VTT time-coded transcript
  in the recording result. No separate transcription vendor required.
- Web SDK uses WebRTC + WebAssembly (v2.1.0+), runs in desktop AND mobile browsers, up to
  1080p. No native app needed.

Pricing (published rates, confirm with Zoom sales before committing):
- Video SDK about $0.0035 per participant-minute, first 10,000 participant-minutes/month
  free, Build Platform credits start around $100/month past the free tier.
- Cloud recording about $4 per 1,000 minutes.
- Worked example: a 30-min, 2-person recorded call is about $0.33. The free tier covers
  roughly 160 such calls per month. About 500 recorded calls/month is roughly $130/month.
- License path (Zoom Workplace Business about $18.33/user/mo annually) is cheaper only at
  tiny volume and hits a one-live-meeting-per-host concurrency wall, so it does not scale.

Consent law (verified):
- 12 all-party consent states in 2026: CA, CT, DE, FL, IL, MD, MA, MT, NH, OR, PA, WA.
- Interstate rule: if any party is in an all-party state, get everyone's consent. Because
  CreatorBridge is US-wide, treat every call as all-party and capture consent both sides,
  every call.

Existing platform pieces to reuse (verified in code):
- Availability: src/components/AvailabilityCalendar.jsx + availability table; Google
  freeBusy sync is read-only (scope calendar.readonly) and only imports busy times.
- Notifications center (exists) for scheduling and reminders.
- Anti-poaching: src/utils/messageFilter.js filters contact info in DMs; client phone
  verification gate exists.
- Project status flow (projects table): retainer_paid, in_progress, revision, delivered,
  approved. The call gate keys off status being retainer_paid or later.
- Secret handling: all secrets live server-side in edge functions, never in the client
  bundle. The Video SDK secret must follow this.
- Storage: private Supabase buckets with signed URLs, plus Bunny for video, both available.

## 3. What else we need to make this work (requirements)
Zoom setup
- A Zoom Build Platform subscription and a Video SDK app to get the SDK Key and Secret.
- A server-side edge function that signs the session JWT with the Video SDK secret and sets
  the recording and transcript flags. Secret never leaves the server.
- A Zoom webhook endpoint (signature-verified, like stripe-webhook) to receive the
  recording-completed event and the transcript (VTT) file location.

Scheduling
- "Schedule a call" action in the project workspace, visible only when status is retainer
  paid or later.
- Read the creator's availability, handle time zones (store UTC, show local), propose and
  confirm a time, allow reschedule and cancel.
- No-show handling: grace window, mark no-show, notify, do not consume a summary slot.

Consent and legal
- A pre-join consent screen both parties must acknowledge, capturing name, role, timestamp,
  IP, and user agent (mirror the legal_acceptances pattern). Store per participant per call.
- Policy decision: recording is required to use the call feature. If a party declines
  consent, no call happens and they use messaging instead.
- Attorney review of the consent wording and the retention promise before launch.
- Retention: decide how long the recording and transcript are kept and who can access them.

Recording and summary pipeline
- Enable cloud recording + transcript in the session JWT.
- On the recording-completed webhook, either keep the files in Zoom cloud or copy them to a
  private CreatorBridge bucket for walled-garden control and party-scoped signed access.
- Generate a draft summary from the VTT transcript via an AI step and post it into the
  project thread as "pending creator confirmation." The creator edits and confirms; it is
  their record. The platform does not warrant it.

Identity masking
- Sessions use masked display names (first name only), no emails exchanged, no personal Zoom
  accounts. Consistent with the contact-protection model.

Data model (new)
- project_calls: id, project_id, creator_id, client_id, scheduled_at, status
  (scheduled / completed / no_show / cancelled), zoom_session_name, recording_ref,
  transcript_ref, created_at.
- call_consents: id, call_id, user_id, role, consent_text, ip_address, user_agent,
  consented_at. Unique per (call_id, user_id).
- call_summaries: id, call_id, project_id, draft_text, final_text, status
  (draft / confirmed), confirmed_by, confirmed_at. (Or post the summary as a thread message
  with a confirm state.)

Security and RLS
- project_calls, call_consents, call_summaries, and any stored recording or transcript are
  party-scoped, readable only by the two parties and admin.
- Recording and transcript access via short-lived signed URLs only, never public.
- Video SDK secret and JWT signing are server-only.

Notifications
- Reuse the notification center: call scheduled, reminders (for example 24 hours and 1 hour
  before), join link, and summary ready.

UX and platform behavior
- Set the expectation in two places: creator profile or pre-booking DM ("video calls unlock
  after you book") and the checkout page.
- Call lives in the project workspace, embedded via the Video SDK so it never leaves
  CreatorBridge (on brand, walled garden).
- Mobile browser support is covered by the web SDK; verify iOS Safari in QA.

Cost controls
- Optional per-call length cap and per-project call limit to bound Zoom minutes.
- Track monthly participant-minutes against the free tier.

Admin and disputes
- Admin visibility into calls; the confirmed summary can be referenced in the dispute record
  alongside the contract and deliverables.

## 4. Open questions to decide before speccing
1. Recording storage: keep in Zoom cloud (simplest) or copy to a private CreatorBridge
   bucket (more control, better retention and walled garden)? And what retention window?
2. If a party declines the recording consent, block the call entirely (recommended, since
   recording is required) or allow an unrecorded call?
3. Does the client also get access to the recording and summary, or is it creator-only?
   The creator owns accuracy, but the client is a party to the call; decide their access.
4. Who can schedule and initiate: creator, client, or both?
5. Call length cap and per-project call limit, if any.
6. Reschedule, cancel, and no-show rules and any penalties.

## 5. Risk notes
- Consent and retention promises must be honored technically, since you are making a claim
  (audio recorded, summary is the creator's record) you then have to enforce.
- Zoom pricing and SDK terms change and may be negotiable; confirm before committing.
- Anti-poaching risk at call time is low because the retainer is already in escrow and the
  contract is countersigned, but keep the anti-circumvention terms and strike policy.

## 6. Recommended answers to the open questions (2026-06-30)
These are the working decisions. Items marked ATTORNEY need legal sign-off on wording only,
not on the shape.

1. Storage and retention: on the recording-completed webhook, copy the recording and
   transcript into a private CreatorBridge bucket and delete the Zoom-cloud copy. Retain the
   raw recording and transcript for 120 days after the final payment releases (covers the
   chargeback and dispute window), then auto-delete, keeping only the creator-confirmed text
   summary as the durable record. Use a scheduled cleanup job (same pattern as
   cleanup-support-screenshots) to enforce deletion.
2. Declined consent: block the call and route to messaging. Recording is required. State at
   scheduling that calls are recorded so declines are rare.
3. Visibility and the shared summary (corrected by Lee 2026-06-30): both parties have access
   to the recording file AND the summary text. The auto-draft summary is posted into the
   project thread as a shared "Call summary" visible to both from the start, labeled draft
   pending review. Both parties can edit or suggest corrections; the creator is the
   accountable owner responsible for keeping it accurate on file for both. The summary is NOT
   creator-only at any point; the client is never locked out. Both parties can also access the
   raw recording of a call they were on.
   SAFEGUARD: every edit is versioned and attributed (who edited, when), and a lightweight
   "both agree this is accurate" acknowledgment timestamps and marks the agreed version. This
   protects both sides because the text may become dispute evidence and must not be silently
   rewritten. Data model note: call_summaries needs an edit-history and last-edited-by, and
   allows edits by both parties, not just the creator.
   ATTORNEY: bless the exact access and consent wording, not the shape.
4. Scheduling: either party can initiate, constrained to the creator's published
   availability; the creator can reschedule or decline. Client typically picks an open slot.
5. Caps: 60-minute cap per call with an end-of-call warning; 3 calls included per project
   (kickoff, mid, review), additional calls by request rather than a hard block.
6. Reschedule / cancel / no-show: reschedule up to 12 hours before with no penalty, inside
   12 hours is a logged late reschedule; either party may cancel a call without affecting the
   booking; 10-minute no-show grace, then mark and log, repeated creator no-shows feed the
   reliability signal. Reminders at 24 hours, 1 hour, and at start. No monetary penalties,
   since obligations live in the contract and escrow, not the call.

Proactive additions:
- Draft the consent sentence now for the attorney to redline (ATTORNEY).
- Build the retention auto-delete on day one, because the 120-day deletion is a promise that
  must be technically enforced and provable.

## 6b. Dispute evidence tie-in (cross-feature)
Disputes are arguments about what was agreed versus what was delivered. Today the only record
of "agreed" is the loose brief; the `disputes` table has no structured evidence field. The
contract, the deliverables and proofing history, and the confirmed call summaries together
become the agreed-scope evidence. On dispute open, auto-assemble an evidence bundle for the
admin: the countersigned contract and its deliverables and revisions, the deliverable assets
with per-asset approve or revision decisions and timestamps, the confirmed call summaries with
edit history (who agreed to what change, when), and the message thread. This turns disputes
from he-said-she-said into signed scope versus delivered work, makes frivolous disputes easy
to reject, and informs the percentage split (deliverables show work completed). Implementation
is light: a `dispute_evidence` link table or a dispute view aggregating by project, plus an
admin resolution surface that ties into the existing `release-payment` function so the admin
can release, refund, or split with reasoning recorded. Note this hook in the contract and
deliverables specs too.

## 7. Next step
When these answers are confirmed, turn this into a Codex build spec like the contract one:
data model, the retainer gate, the Video SDK JWT and webhook flow, the consent capture, the
recording-to-summary pipeline with creator confirmation, retention auto-delete, RLS, and
where it renders in the project workspace. Do not deploy; open a PR for review.
