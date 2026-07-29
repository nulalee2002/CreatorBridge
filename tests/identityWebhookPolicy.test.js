import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ageOnDate,
  reduceIdentityOutcome,
} from '../supabase/functions/_shared/identityWebhookPolicy.js';

const adultSession = {
  id: 'vs_adult',
  status: 'verified',
  last_error: null,
  verified_outputs: {
    dob: { year: 1990, month: 7, day: 29 },
    first_name: 'Sensitive',
    last_name: 'Person',
    address: { line1: 'Never persist this' },
  },
};

const verifiedReport = {
  id: 'vr_sensitive',
  document: {
    status: 'verified',
    files: ['file_government_id'],
    dob: { year: 1990, month: 7, day: 29 },
  },
  selfie: {
    status: 'verified',
    selfie: 'file_selfie',
    document: 'file_government_id',
  },
};

test('calculates age at the exact adult boundary', () => {
  assert.equal(ageOnDate({ year: 2008, month: 7, day: 29 }, new Date('2026-07-29T12:00:00Z')), 18);
  assert.equal(ageOnDate({ year: 2008, month: 7, day: 30 }, new Date('2026-07-29T12:00:00Z')), 17);
});

test('reduces a verified adult result to the approved allowlist', () => {
  const outcome = reduceIdentityOutcome({
    eventType: 'identity.verification_session.verified',
    session: adultSession,
    report: verifiedReport,
    attemptCount: 1,
    now: new Date('2026-07-29T12:00:00Z'),
  });

  assert.deepEqual(outcome, {
    status: 'verified',
    adult_verified: true,
    document_status: 'verified',
    selfie_status: 'verified',
    provider_error_code: null,
    risk_label: 'clear',
    review_reason: null,
    verified_at: '2026-07-29T12:00:00.000Z',
    restricted_at: null,
  });
  assert.equal(JSON.stringify(outcome).includes('Sensitive'), false);
  assert.equal(JSON.stringify(outcome).includes('file_government_id'), false);
  assert.equal(JSON.stringify(outcome).includes('file_selfie'), false);
});

test('rejects a verified provider result when the person is under 18', () => {
  const outcome = reduceIdentityOutcome({
    eventType: 'identity.verification_session.verified',
    session: {
      ...adultSession,
      verified_outputs: { dob: { year: 2010, month: 1, day: 1 } },
    },
    report: verifiedReport,
    attemptCount: 1,
    now: new Date('2026-07-29T12:00:00Z'),
  });
  assert.equal(outcome.status, 'rejected');
  assert.equal(outcome.adult_verified, false);
  assert.equal(outcome.provider_error_code, 'UNDER_18');
  assert.equal(outcome.verified_at, null);
});

test('routes correctable failures to retry and repeated failures to review', () => {
  const failedSession = {
    id: 'vs_failed',
    status: 'requires_input',
    last_error: { code: 'document_expired', reason: 'Sensitive provider prose' },
  };
  const retry = reduceIdentityOutcome({
    eventType: 'identity.verification_session.requires_input',
    session: failedSession,
    report: null,
    attemptCount: 1,
    now: new Date('2026-07-29T12:00:00Z'),
  });
  assert.equal(retry.status, 'retry_required');
  assert.equal(retry.provider_error_code, 'document_expired');
  assert.equal(retry.review_reason, 'Secure verification retry required.');

  const review = reduceIdentityOutcome({
    eventType: 'identity.verification_session.requires_input',
    session: failedSession,
    report: null,
    attemptCount: 3,
    now: new Date('2026-07-29T12:00:00Z'),
  });
  assert.equal(review.status, 'manual_review');
  assert.equal(review.risk_label, 'provider_review');
});
