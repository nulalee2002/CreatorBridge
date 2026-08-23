import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DELIVERY_DIRECT_LIMIT_BYTES,
  DOWNLOAD_RETENTION_DAYS,
  INCLUDED_REVISIONS,
  PAID_REVISION_PRICE_CENTS,
  REVIEW_WINDOW_HOURS,
  calculatePaidRevisionSplit,
  creatorFeePctForCompletedProjects,
} from '../src/config/projectCompletion.js';

test('locks the approved project completion constants', () => {
  assert.equal(INCLUDED_REVISIONS, 2);
  assert.equal(PAID_REVISION_PRICE_CENTS, 5000);
  assert.equal(DELIVERY_DIRECT_LIMIT_BYTES, 5_000_000_000);
  assert.equal(REVIEW_WINDOW_HOURS, 120);
  assert.equal(DOWNLOAD_RETENTION_DAYS, 7);
});

test('derives creator fee tiers from trusted completed project counts', () => {
  assert.equal(creatorFeePctForCompletedProjects(0), 10);
  assert.equal(creatorFeePctForCompletedProjects(9), 10);
  assert.equal(creatorFeePctForCompletedProjects(10), 8);
  assert.equal(creatorFeePctForCompletedProjects(24), 8);
  assert.equal(creatorFeePctForCompletedProjects(25), 6);
});

test('keeps the paid revision client charge fixed and deducts creator fees inside it', () => {
  assert.deepEqual(calculatePaidRevisionSplit(0), {
    clientChargeCents: 5000,
    clientFeeCents: 0,
    creatorFeePct: 10,
    creatorFeeCents: 500,
    creatorNetCents: 4500,
    platformRevenueCents: 500,
  });
  assert.equal(calculatePaidRevisionSplit(10).creatorNetCents, 4600);
  assert.equal(calculatePaidRevisionSplit(25).creatorNetCents, 4700);
});
