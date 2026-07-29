export const IDENTITY_CONSENT_VERSION = '2026-07-29';

export const IDENTITY_CONSENT_COPY = Object.freeze({
  title: 'Identity and live-selfie consent',
  summary: 'CreatorBridge uses Stripe Identity to confirm that protected project participants are real adults and to prevent duplicate creator portfolios.',
  processing: 'Stripe will collect and process a government-issued ID and a live selfie. The check covers document authenticity, age, liveness, whether the selfie matches the ID, and available duplicate-account risk signals.',
  retention: 'CreatorBridge receives the verification status and limited risk results. CreatorBridge does not store your ID image, selfie image, facial template, or biometric embedding.',
  affirmation: 'I consent to Stripe processing my government-issued ID and live selfie for CreatorBridge identity verification.',
});

const PURPOSES = new Set(['creator_application', 'first_contract', 'reverification']);

export function validateIdentityPurpose(value) {
  const purpose = String(value || '').trim();
  if (!PURPOSES.has(purpose)) {
    throw new Error('Choose a supported identity verification purpose.');
  }
  return purpose;
}

export function identityReturnPath(purpose) {
  return validateIdentityPurpose(purpose) === 'creator_application' ? '/register' : '/projects';
}

export function buildIdentitySessionParams({ userId, purpose, siteUrl }) {
  const normalizedPurpose = validateIdentityPurpose(purpose);
  const normalizedUserId = String(userId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedUserId)) {
    throw new Error('Authenticated user ID is required.');
  }
  const baseUrl = String(siteUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('CreatorBridge site URL is required.');

  return {
    type: 'document',
    client_reference_id: normalizedUserId,
    metadata: {
      user_id: normalizedUserId,
      purpose: normalizedPurpose,
    },
    options: {
      document: {
        require_live_capture: true,
        require_matching_selfie: true,
      },
    },
    return_url: `${baseUrl}/verification/identity/return?purpose=${encodeURIComponent(normalizedPurpose)}`,
  };
}
