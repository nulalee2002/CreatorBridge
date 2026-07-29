import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChangeOrderTerms,
  canonicalizeChangeOrderTerms,
  splitChangeOrderAmount,
  changeOrderHasProjectEffect,
} from '../src/utils/changeOrderTerms.js';

const source = {
  originalContractId: 'contract-1',
  originalDocumentNumber: 'CB-2026-ABC123',
  sequenceNumber: 1,
  documentNumber: 'CB-CO-2026-ABC123-01',
  projectId: 'project-1',
  reason: 'Add a second filming day.',
  beforeTerms: { shoot_days: 1, delivery_date: '2026-09-01' },
  afterTerms: { shoot_days: 2, delivery_date: '2026-09-08' },
  responsibilities: ['Creator schedules the additional crew day.'],
  priceDeltaCents: 10001,
  generatedAt: '2026-07-29T12:00:00.000Z',
};

test('positive additions split cents without losing a cent', () => {
  assert.deepEqual(splitChangeOrderAmount(10001), {
    retainerCents: 5001,
    finalCents: 5000,
  });
});

test('only active change orders affect project scope', () => {
  for (const status of ['draft', 'proposed', 'client_signed', 'creator_signed', 'countersigned', 'awaiting_additional_retainer', 'declined', 'void', 'superseded']) {
    assert.equal(changeOrderHasProjectEffect(status), false);
  }
  assert.equal(changeOrderHasProjectEffect('active'), true);
});

test('price decreases are routed to support', () => {
  assert.throws(() => buildChangeOrderTerms({ ...source, priceDeltaCents: -1 }), /support/i);
});

test('canonical terms are deterministic and retain exact before and after values', () => {
  const terms = buildChangeOrderTerms(source);
  assert.equal(terms.pricing.price_delta_cents, 10001);
  assert.equal(terms.pricing.added_retainer_cents, 5001);
  assert.equal(terms.pricing.added_final_cents, 5000);
  assert.deepEqual(terms.changes.before, source.beforeTerms);
  assert.deepEqual(terms.changes.after, source.afterTerms);
  assert.equal(
    canonicalizeChangeOrderTerms(terms),
    canonicalizeChangeOrderTerms({ pricing: terms.pricing, ...terms }),
  );
});
