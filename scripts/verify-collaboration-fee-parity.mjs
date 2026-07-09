// Guards against drift between the frontend collaboration fee math
// (src/config/collaborationFees.js) and the backend money-authoritative copy
// (supabase/functions/_shared/collaborationFees.js). Run: npm run verify:collaboration-fee-parity
import * as frontend from '../src/config/collaborationFees.js';
import * as backend from '../supabase/functions/_shared/collaborationFees.js';

const CONSTANTS = [
  'COLLABORATION_MINIMUM_CENTS',
  'COLLABORATION_MINIMUM_PLATFORM_FEE_CENTS',
  'ACH_PROCESSING_RATE',
  'ACH_PROCESSING_CAP_CENTS',
];

const failures = [];

for (const key of CONSTANTS) {
  if (frontend[key] !== backend[key]) {
    failures.push(`constant ${key}: frontend=${frontend[key]} backend=${backend[key]}`);
  }
}

// Sample the fee function across tier thresholds, the platform-fee floor, and the
// ACH processing cap so any formula change on one side is caught.
const amounts = [25000, 30000, 62500, 100000, 250000, 1000000];
const projectCounts = [0, 9, 10, 24, 25, 49, 50, 100];

for (const amount of amounts) {
  for (const count of projectCounts) {
    const f = frontend.calculateCollaborationFees(amount, count);
    const b = backend.calculateCollaborationFees(amount, count);
    if (JSON.stringify(f) !== JSON.stringify(b)) {
      failures.push(`calculateCollaborationFees(${amount}, ${count}): frontend=${JSON.stringify(f)} backend=${JSON.stringify(b)}`);
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: collaboration fee math has drifted between frontend and backend:');
  for (const line of failures) console.error('  - ' + line);
  process.exit(1);
}

console.log(`OK: collaboration fee parity verified (${CONSTANTS.length} constants, ${amounts.length * projectCounts.length} fee scenarios).`);
