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

const creatorEmail = env.QA_CREATOR_EMAIL || env.CREATORBRIDGE_QA_CREATOR_EMAIL || 'drl33+creator@creatorbridge.studio';
const creatorPass  = env.QA_CREATOR_PASS || env.CREATORBRIDGE_QA_CREATOR_PASSWORD;

const clientEmail  = env.QA_CLIENT_EMAIL || env.CREATORBRIDGE_QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const clientPass   = env.QA_CLIENT_PASS || env.CREATORBRIDGE_QA_CLIENT_PASSWORD;

const adminEmail   = env.QA_ADMIN_EMAIL || env.CREATORBRIDGE_QA_ADMIN_EMAIL || 'drl33@creatorbridge.studio';
const adminPass    = env.QA_ADMIN_PASS || env.CREATORBRIDGE_QA_ADMIN_PASSWORD;

if (!creatorPass || !clientPass || !adminPass) {
  console.error('Error: QA_CREATOR_PASS, QA_CLIENT_PASS, and QA_ADMIN_PASS must be set in .env');
  process.exit(1);
}

async function runTests() {
  console.log('--- STARTING NETWORK AND MEMBERSHIP GATE TEST SUITE ---');

  // Initialize clients
  const creatorClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const clientClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('\nLogging in test users...');
  const { data: creatorAuth, error: creatorAuthErr } = await creatorClient.auth.signInWithPassword({
    email: creatorEmail,
    password: creatorPass
  });
  if (creatorAuthErr) throw creatorAuthErr;
  const creatorUserId = creatorAuth.user.id;
  console.log(`- Creator logged in. User ID: ${creatorUserId}`);

  const { data: clientAuth, error: clientAuthErr } = await clientClient.auth.signInWithPassword({
    email: clientEmail,
    password: clientPass
  });
  if (clientAuthErr) throw clientAuthErr;
  const clientUserId = clientAuth.user.id;
  console.log(`- Client logged in. User ID: ${clientUserId}`);

  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass
  });
  if (adminAuthErr) throw adminAuthErr;
  console.log(`- Admin logged in.`);

  // Find creator listing (the approved one)
  const { data: listings } = await creatorClient
    .from('creator_listings')
    .select('id, review_status')
    .eq('user_id', creatorUserId);
  
  const approvedListing = listings.find(l => l.review_status === 'approved') || listings[0];
  const listingId = approvedListing.id;
  console.log(`- Found Approved Listing ID: ${listingId}`);

  // 1. Temporarily reject creator listing to test unverified block
  console.log('\n1. Rejecting creator listing temporarily using admin write RPC...');
  const { error: rejectErr } = await adminClient.rpc('admin_reject_creator', {
    p_listing_id: listingId
  });
  if (rejectErr) throw rejectErr;
  console.log('✅ Listing status set to rejected successfully.');

  // 2. Test RLS block on network post insertion for unverified creator
  console.log('\n2. Testing unverified creator RLS block on network post...');
  const { data: blockedPost, error: postBlockErr } = await creatorClient
    .from('network_posts')
    .insert({
      state_code: 'AZ',
      user_id: creatorUserId,
      content: 'This post should be blocked by RLS membership check.',
      post_type: 'general',
      user_display_name: 'Marcus Reed',
      user_verification_status: 'unverified'
    });

  if (postBlockErr) {
    console.log('✅ Correctly blocked! RLS error:', postBlockErr.message);
  } else {
    console.error('❌ FAILED: RLS did not block unverified creator post!');
    process.exit(1);
  }

  // 3. Restore creator listing approval
  console.log('\n3. Re-approving creator listing using admin write RPC...');
  const { error: approveErr } = await adminClient.rpc('admin_approve_creator', {
    p_listing_id: listingId
  });
  if (approveErr) throw approveErr;
  console.log('✅ Listing status restored to approved.');

  // 4. Test verified client posting
  console.log('\n4. Testing verified client post creation...');
  const clientPostText = 'A new client post for AZ media freelancers.';
  const { data: clientPost, error: clientPostErr } = await clientClient
    .from('network_posts')
    .insert({
      state_code: 'AZ',
      user_id: clientUserId,
      content: clientPostText,
      post_type: 'looking_for_creator',
      user_display_name: 'Avery Thompson',
      user_verification_status: 'verified'
    })
    .select()
    .single();

  if (clientPostErr) {
    console.error('❌ Failed client post creation:', clientPostErr.message);
    process.exit(1);
  }
  const postId = clientPost.id;
  console.log('✅ Client post created successfully. ID:', postId);

  // 5. Test verified creator reply creation
  console.log('\n5. Testing verified creator reply creation...');
  const replyText = 'I am interested in this collaboration opportunity!';
  const { data: creatorReply, error: replyErr } = await creatorClient
    .from('network_replies')
    .insert({
      post_id: postId,
      user_id: creatorUserId,
      content: replyText,
      user_display_name: 'Marcus Reed',
      user_verification_status: 'verified'
    })
    .select()
    .single();

  if (replyErr) {
    console.error('❌ Failed creator reply creation:', replyErr.message);
    process.exit(1);
  }
  console.log('✅ Creator reply created successfully. ID:', creatorReply.id);

  // 6. Test verified creator post like creation
  console.log('\n6. Testing verified creator post like creation...');
  const { error: likeErr } = await creatorClient
    .from('network_post_likes')
    .insert({
      post_id: postId,
      user_id: creatorUserId
    });

  if (likeErr) {
    console.error('❌ Failed creator post like creation:', likeErr.message);
    process.exit(1);
  }
  console.log('✅ Creator liked client post successfully!');

  // 7. Test state chat message insertion
  console.log('\n7. Testing state chat message insertion...');
  const chatText = 'Live chat update from Phoenix!';
  const { data: chatMsg, error: chatErr } = await creatorClient
    .from('state_chat_messages')
    .insert({
      state_code: 'AZ',
      user_id: creatorUserId,
      message: chatText,
      user_display_name: 'Marcus Reed',
      user_verification_status: 'verified'
    })
    .select()
    .single();

  if (chatErr) {
    console.error('❌ Failed state chat message insertion:', chatErr.message);
    process.exit(1);
  }
  console.log('✅ State chat message inserted successfully. ID:', chatMsg.id);

  // Clean up created test data
  console.log('\nCleaning up created test records...');
  await adminClient.from('network_posts').delete().eq('id', postId);
  await adminClient.from('state_chat_messages').delete().eq('id', chatMsg.id);
  console.log('✅ Cleanup complete.');

  console.log('\n--- ALL NETWORK AND MEMBERSHIP GATE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\nFatal test execution error:', err.message);
  process.exit(1);
});
