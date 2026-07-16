// ATTORNEY REVIEW REQUIRED before launch (all-party consent law, retention promise).
// These strings MUST stay byte-identical to src/lib/callLegal.js. create-call-token
// rejects any consent submission whose text does not match CALL_CONSENT_TEXT, so a
// drift between the two files fails loudly instead of recording the wrong wording.

export const CALL_CONSENT_TEXT =
  'I understand and agree that this video call will be recorded and transcribed, that both project parties can view and download the recording and transcript, and that an editable written summary will be kept as the project record. I consent to the recording on behalf of myself.';

export const CALL_RETENTION_TEXT =
  'The raw recording and transcript are kept for 120 days after the final payment releases and are then permanently deleted. The written call summary stays with the project record.';
