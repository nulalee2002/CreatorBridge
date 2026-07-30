import test from 'node:test';
import assert from 'node:assert/strict';

test('accepts Supabase UUIDs and rejects malformed route identifiers', async () => {
  let isSupabaseUuid;

  try {
    ({ isSupabaseUuid } = await import('../src/utils/ids.js'));
  } catch {
    // The assertion below provides a focused red state until the shared guard exists.
  }

  assert.equal(typeof isSupabaseUuid, 'function', 'shared Supabase UUID guard is missing');
  assert.equal(isSupabaseUuid('cb6d55fe-0c3d-444b-95fc-31f652e59b99'), true);
  assert.equal(isSupabaseUuid('not-a-valid-id'), false);
  assert.equal(isSupabaseUuid(''), false);
  assert.equal(isSupabaseUuid(null), false);
});
