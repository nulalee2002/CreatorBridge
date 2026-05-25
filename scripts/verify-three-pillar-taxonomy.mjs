// scripts/verify-three-pillar-taxonomy.mjs
// Verifies the 3-pillar taxonomy is fully wired up.
// Run AFTER both the migration and the backfill have completed.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Run with:
//   node scripts/verify-three-pillar-taxonomy.mjs

import { createClient } from '@supabase/supabase-js';
import { PILLAR_IDS, isValidSubNicheForPillar } from '../src/data/taxonomy.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[verify] Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const checks = [];
let failed = 0;

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failed++;
}

async function main() {
  const { data: listings, error } = await supabase
    .from('creator_listings')
    .select('id, primary_pillar, sub_niches');
  if (error) throw error;

  const missingPillar = listings.filter(l => !l.primary_pillar);
  check('All listings have primary_pillar', missingPillar.length === 0,
    missingPillar.length > 0 ? `${missingPillar.length} missing` : '');

  const invalidPillar = listings.filter(l => l.primary_pillar && !PILLAR_IDS.includes(l.primary_pillar));
  check('All primary_pillar values are valid', invalidPillar.length === 0,
    invalidPillar.length > 0 ? `${invalidPillar.length} invalid` : '');

  const missingSubs = listings.filter(l => !l.sub_niches || l.sub_niches.length === 0);
  check('All listings have at least 1 sub-niche', missingSubs.length === 0,
    missingSubs.length > 0 ? `${missingSubs.length} missing` : '');

  const tooManySubs = listings.filter(l => l.sub_niches && l.sub_niches.length > 3);
  check('No listing has more than 3 sub-niches', tooManySubs.length === 0,
    tooManySubs.length > 0 ? `${tooManySubs.length} exceed 3` : '');

  const mismatchedSubs = listings.filter(l =>
    l.sub_niches && l.sub_niches.some(sn => !isValidSubNicheForPillar(sn, l.primary_pillar))
  );
  check('All sub-niches belong to their primary pillar', mismatchedSubs.length === 0,
    mismatchedSubs.length > 0 ? `${mismatchedSubs.length} mismatched` : '');

  console.log('=== Three-Pillar Taxonomy Verification ===');
  for (const c of checks) {
    const status = c.ok ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  }
  console.log('');
  console.log(`${failed === 0 ? 'ALL CHECKS PASSED' : 'CHECKS FAILED'}: ${checks.length - failed}/${checks.length}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
