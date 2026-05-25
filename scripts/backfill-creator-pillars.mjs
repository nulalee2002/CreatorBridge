// scripts/backfill-creator-pillars.mjs
// Maps existing creator_services rows to creator_listings.primary_pillar + sub_niches.
// Run AFTER 20260524140000_three_pillar_taxonomy.sql is applied.
// Idempotent: skips listings that already have primary_pillar set.
//
// Required env vars:
//   SUPABASE_URL                  (from your project settings)
//   SUPABASE_SERVICE_ROLE_KEY     (from project settings > API > service_role)
//
// Run with:
//   node scripts/backfill-creator-pillars.mjs

import { createClient } from '@supabase/supabase-js';
import { LEGACY_SERVICE_TO_PILLAR, MAX_SUB_NICHES } from '../src/data/taxonomy.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[backfill] Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('[backfill] Loading creator listings...');
  const { data: listings, error: lerr } = await supabase
    .from('creator_listings')
    .select('id, user_id, primary_pillar');
  if (lerr) throw lerr;
  console.log(`[backfill] Found ${listings.length} listings.`);

  let updated = 0, skipped = 0, failed = 0;

  for (const listing of listings) {
    if (listing.primary_pillar) {
      skipped++;
      continue;
    }

    const { data: services, error: serr } = await supabase
      .from('creator_services')
      .select('service_id')
      .eq('listing_id', listing.id);

    if (serr) {
      console.warn(`[backfill] listing ${listing.id}: ${serr.message}`);
      failed++;
      continue;
    }

    if (!services || services.length === 0) {
      console.warn(`[backfill] listing ${listing.id}: no services, defaulting to video_production / vp_brand_films`);
      const { error: derr } = await supabase
        .from('creator_listings')
        .update({ primary_pillar: 'video_production', sub_niches: ['vp_brand_films'] })
        .eq('id', listing.id);
      if (derr) { failed++; continue; }
      updated++;
      continue;
    }

    const firstService = services[0].service_id;
    const firstMapping = LEGACY_SERVICE_TO_PILLAR[firstService];
    if (!firstMapping) {
      console.warn(`[backfill] listing ${listing.id}: unknown service "${firstService}"`);
      failed++;
      continue;
    }

    const pillar = firstMapping.pillar;
    const subNiches = new Set([firstMapping.sub_niche]);
    for (const svc of services.slice(1)) {
      const m = LEGACY_SERVICE_TO_PILLAR[svc.service_id];
      if (m && m.pillar === pillar && subNiches.size < MAX_SUB_NICHES) {
        subNiches.add(m.sub_niche);
      }
    }

    const { error: uerr } = await supabase
      .from('creator_listings')
      .update({ primary_pillar: pillar, sub_niches: Array.from(subNiches) })
      .eq('id', listing.id);

    if (uerr) {
      console.warn(`[backfill] listing ${listing.id} update: ${uerr.message}`);
      failed++;
      continue;
    }
    updated++;
  }

  console.log('');
  console.log(`[backfill] Done. Updated: ${updated}, Skipped (already set): ${skipped}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
