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

const clientEmail = env.QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const clientPass  = env.QA_CLIENT_PASS;
if (!clientPass) { console.error('Error: QA_CLIENT_PASS must be set in .env'); process.exit(1); }

async function runTests() {
  console.log('--- STARTING CLIENT FEATURES TEST SUITE ---');

  // Initialize client session
  const clientClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('\nLogging in client...');
  const { data: clientAuth, error: clientAuthErr } = await clientClient.auth.signInWithPassword({
    email: clientEmail,
    password: clientPass
  });
  if (clientAuthErr) throw clientAuthErr;
  const clientUserId = clientAuth.user.id;
  console.log(`- Client logged in. User ID: ${clientUserId}`);

  const { data: originalProfile, error: originalProfileErr } = await clientClient
    .from('client_profiles')
    .select('user_id,display_name,company_name,phone,website,bio,email_verified')
    .eq('user_id', clientUserId)
    .maybeSingle();
  if (originalProfileErr) throw originalProfileErr;

  try {

  // 1. Verify Client Profile Upsert
  console.log(`\n1. Testing Client Profile updates...`);
  const testBio = 'Arizona based tech company specializing in video content production and brand stories. Fully verified test client profile.';
  const testWebsite = 'https://creatorbridge.studio/client-qa';
  const testPhone = '602-555-0155';
  const testDisplayName = 'Sonoran Launch Group';

  console.log(`- Upserting profile for Client: display_name=${testDisplayName}, website=${testWebsite}`);
  const { error: upsertErr } = await clientClient
    .from('client_profiles')
    .upsert({
      user_id: clientUserId,
      display_name: testDisplayName,
      company_name: 'SLG Media',
      phone: testPhone,
      website: testWebsite,
      bio: testBio,
      email_verified: true
    }, { onConflict: 'user_id' });

  if (upsertErr) {
    throw new Error(`Client profile upsert error: ${upsertErr.message}`);
  }

  // Fetch and check
  const { data: profileAfter, error: retrieveErr } = await clientClient
    .from('client_profiles')
    .select('*')
    .eq('user_id', clientUserId)
    .single();
  if (retrieveErr) throw retrieveErr;

  console.log('- Retrieved updated client profile:', {
    display_name: profileAfter.display_name,
    phone: profileAfter.phone,
    website: profileAfter.website,
    bio: profileAfter.bio
  });

  if (profileAfter.website !== testWebsite || profileAfter.bio !== testBio) {
    throw new Error('Client profile updates did not persist correctly');
  }
  console.log('✅ Client profile successfully updated and verified in DB!');

  // 2. Verify Referral Query logic
  console.log(`\n2. Testing Referral query capabilities...`);
  const { data: referrals, error: refErr } = await clientClient
    .from('referrals')
    .select('status, reward_issued')
    .eq('referrer_id', clientUserId);

  if (refErr) {
    throw new Error(`Failed to query referrals table: ${refErr.message}`);
  }
  console.log(`✅ Referrals queried successfully! Found ${referrals.length} referral records associated with this client.`);
  for (const ref of referrals) {
    console.log(`  * Status: ${ref.status} | Reward Issued: ${ref.reward_issued}`);
  }

  console.log('\n--- ALL CLIENT FEATURES TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    if (originalProfile) {
      const { error: restoreErr } = await clientClient
        .from('client_profiles')
        .upsert(originalProfile, { onConflict: 'user_id' });
      if (restoreErr) throw new Error(`Could not restore client QA profile: ${restoreErr.message}`);
    } else {
      const { error: cleanupErr } = await clientClient
        .from('client_profiles')
        .delete()
        .eq('user_id', clientUserId);
      if (cleanupErr) throw new Error(`Could not remove temporary client QA profile: ${cleanupErr.message}`);
    }
    console.log('✅ Client QA profile restored.');
  }
}

runTests().catch(err => {
  console.error('\nFatal test execution error:', err.message);
  process.exit(1);
});
