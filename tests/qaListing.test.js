import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionQaListing } from '../scripts/lib/qaListing.mjs';

test('listing provisioning rejects an account other than configured QA before database access', async () => {
  const previous = process.env.CREATORBRIDGE_QA_CREATOR_EMAIL;
  process.env.CREATORBRIDGE_QA_CREATOR_EMAIL = 'qa@example.invalid';
  try {
    await assert.rejects(provisionQaListing({ from() { throw new Error('database must not be accessed'); } }, { id: 'other', email: 'other@example.invalid' }), /configured QA creator/);
  } finally {
    if (previous === undefined) delete process.env.CREATORBRIDGE_QA_CREATOR_EMAIL;
    else process.env.CREATORBRIDGE_QA_CREATOR_EMAIL = previous;
  }
});

test('an existing QA listing is reused and never deleted by fixture cleanup', async () => {
  const previous = process.env.CREATORBRIDGE_QA_CREATOR_EMAIL;
  process.env.CREATORBRIDGE_QA_CREATOR_EMAIL = 'qa@example.invalid';
  try {
    const existing = { id: 'existing', stripe_account_id: null };
    const query = { select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle() { return { data: existing, error: null }; } };
    const fixture = await provisionQaListing({ from() { return query; } }, { id: 'qa', email: 'qa@example.invalid' });
    assert.equal(fixture.listing, existing);
    await fixture.cleanup();
  } finally {
    if (previous === undefined) delete process.env.CREATORBRIDGE_QA_CREATOR_EMAIL;
    else process.env.CREATORBRIDGE_QA_CREATOR_EMAIL = previous;
  }
});
