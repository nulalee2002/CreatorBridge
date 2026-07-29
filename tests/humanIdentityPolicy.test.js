import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityAllowsTrustedAction,
  phoneAllowsContact,
  nextIdentityState,
} from '../src/utils/humanIdentityPolicy.js';

test('only a verified identity unlocks trusted actions', () => {
  const blockedStatuses = [
    'unverified',
    'consent_required',
    'pending',
    'retry_required',
    'manual_review',
    'duplicate_restricted',
    'rejected',
    'reverification_required',
    '',
    null,
    undefined,
  ];

  for (const status of blockedStatuses) {
    assert.equal(identityAllowsTrustedAction(status), false, `${status} must remain blocked`);
  }
  assert.equal(identityAllowsTrustedAction('verified'), true);
});

test('phone possession is required before creator contact', () => {
  assert.equal(phoneAllowsContact({ phoneVerified: false }), false);
  assert.equal(phoneAllowsContact({ phoneVerified: true }), true);
  assert.equal(phoneAllowsContact({}), false);
  assert.equal(phoneAllowsContact(null), false);
});

test('verified identity persists until a defined risk trigger occurs', () => {
  assert.equal(nextIdentityState('verified', 'normal_return'), 'verified');
  assert.equal(nextIdentityState('verified', 'phone_changed'), 'verified');
  assert.equal(nextIdentityState('verified', 'suspicious_recovery'), 'reverification_required');
  assert.equal(nextIdentityState('verified', 'provider_requested'), 'reverification_required');
  assert.equal(nextIdentityState('pending', 'normal_return'), 'pending');
});
