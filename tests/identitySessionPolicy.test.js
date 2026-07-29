import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY_CONSENT_VERSION,
  buildIdentitySessionParams,
  identityReturnPath,
  validateIdentityPurpose,
} from '../supabase/functions/_shared/identityPolicy.js';

test('builds a live-capture document and selfie verification session', () => {
  const params = buildIdentitySessionParams({
    userId: '11111111-1111-4111-8111-111111111111',
    purpose: 'creator_application',
    siteUrl: 'https://creatorbridge.studio/',
  });

  assert.equal(params.type, 'document');
  assert.equal(params.client_reference_id, '11111111-1111-4111-8111-111111111111');
  assert.deepEqual(params.options, {
    document: {
      require_live_capture: true,
      require_matching_selfie: true,
    },
  });
  assert.equal(
    params.return_url,
    'https://creatorbridge.studio/verification/identity/return?purpose=creator_application',
  );
  assert.deepEqual(params.metadata, {
    user_id: '11111111-1111-4111-8111-111111111111',
    purpose: 'creator_application',
  });
});

test('does not place identity details in Stripe metadata', () => {
  const params = buildIdentitySessionParams({
    userId: '22222222-2222-4222-8222-222222222222',
    purpose: 'first_contract',
    siteUrl: 'https://creatorbridge.studio',
  });
  const metadata = JSON.stringify(params.metadata);
  assert.equal(/email|phone|name|birth|document|selfie/i.test(metadata), false);
});

test('accepts only approved verification purposes', () => {
  assert.equal(validateIdentityPurpose('creator_application'), 'creator_application');
  assert.equal(validateIdentityPurpose('first_contract'), 'first_contract');
  assert.equal(validateIdentityPurpose('reverification'), 'reverification');
  assert.throws(() => validateIdentityPurpose('admin_override'), /purpose/i);
});

test('uses a versioned dedicated consent contract', () => {
  assert.match(IDENTITY_CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(identityReturnPath('first_contract'), '/projects');
  assert.equal(identityReturnPath('creator_application'), '/register');
});
