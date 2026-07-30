import test from 'node:test';
import assert from 'node:assert/strict';

test('builds a creator QA listing payload accepted by the current schema', async () => {
  let buildQaCreatorListingPayload;

  try {
    ({ buildQaCreatorListingPayload } = await import('../scripts/lib/qaFixtures.mjs'));
  } catch {
    // The assertion below provides a focused red state until the fixture builder exists.
  }

  assert.equal(
    typeof buildQaCreatorListingPayload,
    'function',
    'QA creator fixture payload builder is missing',
  );

  const payload = buildQaCreatorListingPayload({
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'qa-creator@example.invalid',
    now: '2026-07-29T00:00:00.000Z',
  });

  assert.equal(payload.user_id, '00000000-0000-0000-0000-000000000001');
  assert.equal(payload.email, 'qa-creator@example.invalid');
  assert.equal(payload.review_status, 'approved');
  assert.equal(payload.verification_status, 'verified');
  assert.deepEqual(
    Object.keys(payload).filter((key) => ['website', 'instagram', 'youtube', 'vimeo', 'linkedin'].includes(key)),
    [],
    'QA fixtures must not send removed external-contact columns to creator_listings',
  );
});

test('builds walled-garden portfolio QA items with hosted media', async () => {
  let buildQaCreatorPortfolioItems;

  try {
    ({ buildQaCreatorPortfolioItems } = await import('../scripts/lib/qaFixtures.mjs'));
  } catch {
    // The assertion below provides a focused red state until the fixture builder exists.
  }

  assert.equal(
    typeof buildQaCreatorPortfolioItems,
    'function',
    'QA creator portfolio fixture builder is missing',
  );

  const items = buildQaCreatorPortfolioItems('00000000-0000-0000-0000-000000000002');

  assert.equal(items.length, 3);
  assert.ok(items.every((item) => item.listing_id === '00000000-0000-0000-0000-000000000002'));
  assert.ok(items.every((item) => item.media_type === 'video'));
  assert.ok(items.every((item) => item.bunny_video_id));
  assert.ok(items.every((item) => !item.link && !item.image_url));
});
