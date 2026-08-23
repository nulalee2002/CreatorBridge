import test from 'node:test';
import assert from 'node:assert/strict';

import { createQaCleanupTracker } from '../scripts/lib/qaCleanup.mjs';
import { buildQaCreatorListingPayload } from '../scripts/lib/qaFixtures.mjs';

test('runs every cleanup step and reports returned and thrown errors together', async () => {
  const tracker = createQaCleanupTracker('network QA cleanup');
  const completed = [];

  await tracker.check('delete post', async () => {
    completed.push('post');
    return { error: { message: 'foreign key blocked delete' } };
  });
  await tracker.check('restore listing', async () => {
    completed.push('listing');
    throw new Error('restore failed');
  });
  await tracker.check('sign out', async () => {
    completed.push('sign-out');
    return { error: null };
  });

  assert.deepEqual(completed, ['post', 'listing', 'sign-out']);
  assert.throws(
    () => tracker.assertComplete(),
    /network QA cleanup failed:[\s\S]*delete post: foreign key blocked delete[\s\S]*restore listing: restore failed/,
  );
});

test('returns successful cleanup results and completes without throwing', async () => {
  const tracker = createQaCleanupTracker('booking QA cleanup');
  const result = await tracker.check('delete project', Promise.resolve({ data: [{ id: 'project-1' }], error: null }));

  assert.deepEqual(result.data, [{ id: 'project-1' }]);
  assert.doesNotThrow(() => tracker.assertComplete());
  assert.equal(tracker.failures.length, 0);
});

test('launch QA records use an unmistakable non-person identity', () => {
  const fixture = buildQaCreatorListingPayload({
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'qa@example.invalid',
    now: '2026-08-22T00:00:00.000Z',
  });
  assert.equal(fixture.name, 'CreatorBridge QA Creator');
  assert.match(fixture.bio, /QA profile/i);
});
