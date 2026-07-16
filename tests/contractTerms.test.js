import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleContractTerms,
  canonicalizeContractTerms,
  hashContractTerms,
} from '../src/utils/contractTerms.js';

const source = {
  contractId: '11111111-1111-4111-8111-111111111111',
  generatedAt: '2026-07-11T20:00:00.000Z',
  client: { userId: 'client-1', name: 'Sofia Present', company: 'Aritzia' },
  creator: { userId: 'creator-1', listingId: 'listing-1', name: 'Marcus Reed', businessName: 'LensCraft Studios' },
  project: {
    id: 'project-1',
    title: 'Resort 2026 Brand Film',
    description: 'A 60 to 90 second brand film.',
    serviceId: 'video_production',
    location: 'Miami, FL',
    timeline: '18 to 19 July 2026',
    projectDuration: '2 days',
  },
  package: {
    id: 'package-1',
    name: 'Campaign Film',
    deliverables: ['1x brand film', '3x vertical social cutdowns'],
    turnaroundDays: 10,
    revisions: 2,
  },
  pricing: { total: 3400, creatorFeePct: 10, clientFeePct: 5 },
};

test('assembles exact package and 50/50 pricing terms', () => {
  const terms = assembleContractTerms(source);
  assert.deepEqual(terms.deliverables, source.package.deliverables);
  assert.equal(terms.pricing.total, 3400);
  assert.equal(terms.pricing.retainer, 1700);
  assert.equal(terms.pricing.final, 1700);
  assert.equal(terms.pricing.creator_fee, 340);
  assert.equal(terms.pricing.client_fee, 170);
  assert.equal(terms.pricing.creator_net, 3060);
  assert.equal(terms.revisions, 2);
});

test('rejects sources without a package or deliverables', () => {
  assert.throws(() => assembleContractTerms({ ...source, package: null }), /package/i);
  assert.throws(
    () => assembleContractTerms({ ...source, package: { ...source.package, deliverables: [] } }),
    /deliverable/i,
  );
});

test('canonical form and hash are stable across object key order', async () => {
  const terms = assembleContractTerms(source);
  const reordered = { pricing: terms.pricing, ...terms };
  assert.equal(canonicalizeContractTerms(terms), canonicalizeContractTerms(reordered));
  assert.equal(await hashContractTerms(terms), await hashContractTerms(reordered));
  assert.match(await hashContractTerms(terms), /^[0-9a-f]{64}$/);
});

test('generated contract language avoids prohibited claims and Unicode dashes', () => {
  const copy = canonicalizeContractTerms(assembleContractTerms(source));
  assert.equal(/[\u2013\u2014]/u.test(copy), false);
  assert.equal(/\bescrow\b/i.test(copy), false);
  assert.equal(/\bmarketplace\b/i.test(copy), false);
  assert.equal(/notari[sz]/i.test(copy), false);
  assert.match(copy, /attorney_review_required/);
});
