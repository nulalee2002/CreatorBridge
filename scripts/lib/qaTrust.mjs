import { createQaCleanupTracker } from './qaCleanup.mjs';

const QA_CONSENT_VERSION = 'creatorbridge-automated-qa-v1';

export async function provisionQaTrust(admin, userId) {
  const { data: originalPhone, error: phoneReadError } = await admin
    .from('account_phone_verifications')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (phoneReadError) throw phoneReadError;

  const { error: phoneUpsertError } = await admin.from('account_phone_verifications').upsert({
    user_id: userId,
    phone_e164: originalPhone?.phone_e164 || '+16025550100',
    status: 'verified',
    verified_at: originalPhone?.verified_at || new Date().toISOString(),
    provider: 'twilio',
    provider_service_reference: 'automated_qa',
    last_sent_at: originalPhone?.last_sent_at || null,
    attempt_count: originalPhone?.attempt_count || 0,
    created_at: originalPhone?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (phoneUpsertError) throw phoneUpsertError;

  const { data: latestIdentity, error: identityReadError } = await admin
    .from('identity_verifications')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (identityReadError) throw identityReadError;

  let createdConsentId = null;
  let createdVerificationId = null;
  if (latestIdentity?.status !== 'verified') {
    const { data: existingConsent, error: consentReadError } = await admin
      .from('identity_consents')
      .select('id')
      .eq('user_id', userId)
      .eq('consent_version', QA_CONSENT_VERSION)
      .eq('purpose', 'first_contract')
      .maybeSingle();
    if (consentReadError) throw consentReadError;

    let consentId = existingConsent?.id;
    if (!consentId) {
      const { data: consent, error: consentError } = await admin
        .from('identity_consents')
        .insert({
          user_id: userId,
          consent_version: QA_CONSENT_VERSION,
          purpose: 'first_contract',
          user_agent: 'CreatorBridge automated QA',
        })
        .select('id')
        .single();
      if (consentError) throw consentError;
      consentId = consent.id;
      createdConsentId = consent.id;
    }

    const { data: verification, error: verificationError } = await admin
      .from('identity_verifications')
      .insert({
        user_id: userId,
        consent_id: consentId,
        provider_session_id: `vs_qa_${crypto.randomUUID()}`,
        purpose: 'first_contract',
        status: 'verified',
        adult_verified: true,
        document_status: 'verified',
        selfie_status: 'verified',
        risk_label: 'clear',
        attempt_count: 1,
        verified_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (verificationError) throw verificationError;
    createdVerificationId = verification.id;
  }

  return async function restoreQaTrust() {
    const cleanup = createQaCleanupTracker(`QA trust restore for ${userId}`);
    if (createdVerificationId) {
      await cleanup.check('delete identity verification',
        admin.from('identity_verifications').delete().eq('id', createdVerificationId));
    }
    if (createdConsentId) {
      await cleanup.check('delete identity consent',
        admin.from('identity_consents').delete().eq('id', createdConsentId));
    }
    if (originalPhone) {
      await cleanup.check('restore phone verification',
        admin.from('account_phone_verifications').upsert(originalPhone, { onConflict: 'user_id' }));
    } else {
      await cleanup.check('delete temporary phone verification',
        admin.from('account_phone_verifications').delete().eq('user_id', userId));
    }
    cleanup.assertComplete();
  };
}
