// ATTORNEY REVIEW REQUIRED before launch (all-party consent law, retention promise).
// Canonical consent and retention wording for video calls, kept in one place.
// MUST stay byte-identical to supabase/functions/_shared/callLegal.ts:
// create-call-token rejects consent submissions whose text does not match,
// so drift between the two files fails loudly instead of recording the
// wrong wording.

export const CALL_CONSENT_TEXT =
  'I understand and agree that this video call will be recorded and transcribed, that both project parties can view and download the recording and transcript, and that an editable written summary will be kept as the project record. I consent to the recording on behalf of myself.';

export const CALL_RETENTION_TEXT =
  'The raw recording and transcript are kept for 120 days after the final payment releases and are then permanently deleted. The written call summary stays with the project record.';

export const CALL_EXPECTATION_TEXT =
  'Video calls unlock after you book. Once the agreement is signed and the retainer is paid, you can schedule recorded video calls inside CreatorBridge.';
