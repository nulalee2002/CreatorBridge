import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      if (env[key]) continue;
      env[key] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing environment variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const creatorEmail = env.QA_CREATOR_EMAIL || 'drl33+creator@creatorbridge.studio';
const creatorPass  = env.QA_CREATOR_PASS;
if (!creatorPass) { console.error('Error: QA_CREATOR_PASS must be set in .env'); process.exit(1); }

async function runTests() {
  console.log('--- STARTING CREATOR PROFILE FEATURES TEST SUITE ---');

  // Initialize creator client
  const creatorClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('\nLogging in creator...');
  const { data: creatorAuth, error: creatorAuthErr } = await creatorClient.auth.signInWithPassword({
    email: creatorEmail,
    password: creatorPass
  });
  if (creatorAuthErr) throw creatorAuthErr;
  const creatorUserId = creatorAuth.user.id;
  console.log(`- Creator logged in. User ID: ${creatorUserId}`);

  // Fetch creator listing ID (get the approved one)
  const { data: listings, error: listingErr } = await creatorClient
    .from('creator_listings')
    .select('id, video_intro_url, review_status')
    .eq('user_id', creatorUserId);
  if (listingErr) throw listingErr;
  
  if (!listings || listings.length === 0) {
    console.error('❌ No creator listing found for user!');
    process.exit(1);
  }

  // Prefer approved listing, fallback to first listing
  const activeListing = listings.find(l => l.review_status === 'approved') || listings[0];
  const listingId = activeListing.id;
  console.log(`- Found Creator Listing ID: ${listingId} (Status: ${activeListing.review_status})`);

  // 1. Verify Video Intro URL Persistence
  console.log(`\n1. Testing Video Intro URL persistence...`);
  const testVideoUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  console.log(`- Updating video intro URL to: ${testVideoUrl}`);
  
  const { error: videoUpdateErr } = await creatorClient
    .from('creator_listings')
    .update({ video_intro_url: testVideoUrl })
    .eq('id', listingId);
  if (videoUpdateErr) {
    console.error('❌ Video update error:', videoUpdateErr.message);
    process.exit(1);
  }

  // Retrieve and check
  const { data: listingAfter, error: retrieveErr } = await creatorClient
    .from('creator_listings')
    .select('video_intro_url')
    .eq('id', listingId)
    .single();
  if (retrieveErr) throw retrieveErr;

  if (listingAfter.video_intro_url !== testVideoUrl) {
    console.error('❌ Failed: Video intro URL did not persist correctly!', listingAfter.video_intro_url);
    process.exit(1);
  }
  console.log('✅ Video intro URL successfully updated and verified in DB!');

  // 2. Verify Availability Calendar Persistence
  console.log(`\n2. Testing Availability Calendar persistence...`);
  // Clear availability
  const { error: deleteAvailErr } = await creatorClient
    .from('availability')
    .delete()
    .eq('listing_id', listingId);
  if (deleteAvailErr) throw deleteAvailErr;
  console.log('- Pre-cleared old availability records');

  // Insert mock availability dates
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  console.log(`- Upserting availability for: ${todayStr} (available) and ${tomorrowStr} (booked)`);
  const rows = [
    { listing_id: listingId, date: todayStr, status: 'available', source: 'manual' },
    { listing_id: listingId, date: tomorrowStr, status: 'booked', source: 'manual' }
  ];

  const { error: upsertAvailErr } = await creatorClient
    .from('availability')
    .upsert(rows, { onConflict: 'listing_id,date' });
  if (upsertAvailErr) {
    console.error('❌ Availability upsert error:', upsertAvailErr.message);
    process.exit(1);
  }

  // Retrieve and check
  const { data: availRows, error: retrieveAvailErr } = await creatorClient
    .from('availability')
    .select('date, status')
    .eq('listing_id', listingId);
  if (retrieveAvailErr) throw retrieveAvailErr;

  console.log(`- Retrieved rows from DB:`, availRows);
  const todayRow = availRows.find(r => r.date === todayStr);
  const tomorrowRow = availRows.find(r => r.date === tomorrowStr);

  if (!todayRow || todayRow.status !== 'available' || !tomorrowRow || tomorrowRow.status !== 'booked') {
    console.error('❌ Failed: Availability did not persist correctly!');
    process.exit(1);
  }
  console.log('✅ Availability calendar successfully updated and verified in DB!');

  // 3. Verify Package Builder Persistence
  console.log(`\n3. Testing Package Builder persistence...`);
  // Clear existing packages
  const { error: deletePkgsErr } = await creatorClient
    .from('packages')
    .delete()
    .eq('listing_id', listingId);
  if (deletePkgsErr) throw deletePkgsErr;
  console.log('- Pre-cleared old packages');

  const pkgRows = [
    {
      listing_id: listingId,
      service_id: 'video',
      name: 'QA Basic video package',
      price: 1500,
      description: 'Clean basic edit',
      deliverables: ['1 final edit', 'Drone coverage'],
      turnaround_days: 14,
      revisions: 2,
      display_order: 0
    },
    {
      listing_id: listingId,
      service_id: 'video',
      name: 'QA Premium video package',
      price: 3500,
      description: 'Fully featured cinematic production',
      deliverables: ['3 final videos', 'Drone coverage', 'Raw footage'],
      turnaround_days: 30,
      revisions: 5,
      display_order: 1
    }
  ];

  console.log('- Inserting new mock packages');
  const { error: insertPkgsErr } = await creatorClient
    .from('packages')
    .insert(pkgRows);
  if (insertPkgsErr) {
    console.error('❌ Package insert error:', insertPkgsErr.message);
    process.exit(1);
  }

  // Retrieve and check
  const { data: retrievedPkgs, error: retrievePkgsErr } = await creatorClient
    .from('packages')
    .select('*')
    .eq('listing_id', listingId)
    .order('display_order', { ascending: true });
  if (retrievePkgsErr) throw retrievePkgsErr;

  console.log(`- Retrieved packages from DB:`);
  for (const pkg of retrievedPkgs) {
    console.log(`  * ${pkg.name}: $${pkg.price} (${pkg.turnaround_days} days, ${pkg.revisions} revs)`);
  }

  if (retrievedPkgs.length !== 2 || retrievedPkgs[0].name !== 'QA Basic video package' || retrievedPkgs[1].name !== 'QA Premium video package') {
    console.error('❌ Failed: Packages did not persist correctly!');
    process.exit(1);
  }
  console.log('✅ Package builder successfully updated and verified in DB!');

  console.log('\n--- ALL CREATOR PROFILE FEATURES TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\nFatal test execution error:', err.message);
  process.exit(1);
});
