function safeErrorCode(value, fallback) {
  const code = String(value || '').trim();
  return /^[a-z0-9_]{1,120}$/i.test(code) ? code : fallback;
}

export function ageOnDate(dob, date = new Date()) {
  const year = Number(dob?.year);
  const month = Number(dob?.month);
  const day = Number(dob?.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const currentYear = date.getUTCFullYear();
  const currentMonth = date.getUTCMonth() + 1;
  const currentDay = date.getUTCDate();
  let age = currentYear - year;
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function baseOutcome() {
  return {
    status: 'unverified',
    adult_verified: null,
    document_status: null,
    selfie_status: null,
    provider_error_code: null,
    risk_label: null,
    review_reason: null,
    verified_at: null,
    restricted_at: null,
  };
}

export function reduceIdentityOutcome({
  eventType,
  session,
  report,
  attemptCount,
  now = new Date(),
}) {
  const outcome = baseOutcome();
  const attempts = Math.max(1, Number(attemptCount || 1));

  if (eventType === 'identity.verification_session.verified') {
    const documentStatus = report?.document?.status === 'verified' ? 'verified' : 'unverified';
    const selfieStatus = report?.selfie?.status === 'verified' ? 'verified' : 'unverified';
    const dob = session?.verified_outputs?.dob || report?.document?.dob || null;
    const age = ageOnDate(dob, now);
    outcome.document_status = documentStatus;
    outcome.selfie_status = selfieStatus;
    outcome.adult_verified = age == null ? null : age >= 18;

    if (age != null && age < 18) {
      return {
        ...outcome,
        status: 'rejected',
        provider_error_code: 'UNDER_18',
        risk_label: 'account_inconsistency',
        review_reason: 'CreatorBridge is available only to adults age 18 or older.',
      };
    }
    if (age == null || documentStatus !== 'verified' || selfieStatus !== 'verified') {
      return {
        ...outcome,
        status: 'manual_review',
        provider_error_code: age == null ? 'DOB_UNAVAILABLE' : 'CHECK_RESULT_INCOMPLETE',
        risk_label: 'provider_review',
        review_reason: 'Provider result requires secure review.',
      };
    }
    return {
      ...outcome,
      status: 'verified',
      adult_verified: true,
      risk_label: 'clear',
      verified_at: now.toISOString(),
    };
  }

  if (eventType === 'identity.verification_session.requires_input') {
    return {
      ...outcome,
      status: attempts >= 3 ? 'manual_review' : 'retry_required',
      provider_error_code: safeErrorCode(session?.last_error?.code, 'verification_failed'),
      risk_label: attempts >= 3 ? 'provider_review' : null,
      review_reason: attempts >= 3
        ? 'Repeated verification failures require secure review.'
        : 'Secure verification retry required.',
    };
  }

  if (eventType === 'identity.verification_session.canceled') {
    return {
      ...outcome,
      status: attempts >= 3 ? 'manual_review' : 'retry_required',
      provider_error_code: 'SESSION_CANCELED',
      risk_label: attempts >= 3 ? 'provider_review' : null,
      review_reason: attempts >= 3
        ? 'Repeated canceled verification attempts require secure review.'
        : 'Secure verification retry required.',
    };
  }

  if (eventType === 'identity.verification_session.redacted') {
    return {
      ...outcome,
      status: 'unverified',
      provider_error_code: 'SESSION_REDACTED',
      review_reason: 'Verification was redacted. A new consented check is required.',
    };
  }

  throw new Error('Unsupported identity verification event.');
}
