import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneE164,
  normalizeVerificationCode,
} from '../supabase/functions/_shared/phoneVerification.js';

test('normalizes US and explicit international phone numbers to E.164', () => {
  assert.equal(normalizePhoneE164('(602) 555-0100'), '+16025550100');
  assert.equal(normalizePhoneE164('+44 20 7946 0958'), '+442079460958');
});

test('rejects invalid phone numbers', () => {
  for (const value of ['', '123', '+0123456789', 'not-a-number']) {
    assert.throws(() => normalizePhoneE164(value), /valid phone number/i);
  }
});

test('accepts numeric verification codes only', () => {
  assert.equal(normalizeVerificationCode(' 123456 '), '123456');
  assert.throws(() => normalizeVerificationCode('12 34'), /verification code/i);
  assert.throws(() => normalizeVerificationCode('abcdef'), /verification code/i);
});
