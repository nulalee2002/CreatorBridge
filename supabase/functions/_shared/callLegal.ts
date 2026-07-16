// Centralized consent and retention wording for video calls. Edit here.
// These strings MUST stay byte-identical to src/lib/callLegal.js.
// create-call-token rejects any consent submission whose text does not match
// CALL_CONSENT_TEXT, so a drift between the two files fails loudly instead of
// recording the wrong wording.

export const CALL_CONSENT_HEADLINE = 'Before we begin: this call is recorded, audio only.';

export const CALL_CONSENT_MUTUAL = 'Both of you need to agree, or the call will not start.';

export const CALL_CONSENT_WHY =
  'Why we record it: the audio and a short written summary are saved to your project so there is an accurate record of what you both agreed to. It keeps things fair for everyone, and if a question or dispute ever comes up, we can look back at what was actually said. The written summary is also posted to your project chat so you both have it.';

export const CALL_CONSENT_PRIVACY =
  "Only the audio is saved, never video. The recording stays private to the two of you and CreatorBridge, and it is deleted automatically 120 days after your project's final payment.";

export const CALL_CONSENT_AFFIRMATION = 'I understand this call is recorded and I agree to it.';

export const CALL_NAME_LABEL = 'Your full name:';

// The full consent record stored with each party's consent row and validated
// server side in create-call-token.
export const CALL_CONSENT_TEXT = [
  CALL_CONSENT_HEADLINE,
  CALL_CONSENT_MUTUAL,
  CALL_CONSENT_WHY,
  CALL_CONSENT_PRIVACY,
  CALL_CONSENT_AFFIRMATION,
].join('\n');

export const CALL_RETENTION_TEXT =
  "The audio recording and transcript are deleted automatically 120 days after your project's final payment. The written call summary stays with the project record.";
