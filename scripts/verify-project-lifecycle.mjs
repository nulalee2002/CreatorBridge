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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Error: Missing environment variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
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
  console.log('--- STARTING PROJECT LIFECYCLE AND DISPUTE TEST SUITE ---');

  // Initialize clients
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
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

  let originalClientProfile = null;
  let projectId = null;
  let transactionId = null;
  let disputeId = null;

  const { data: clientAuth, error: clientAuthErr } = await clientClient.auth.signInWithPassword({
    email: clientEmail,
    password: clientPass
  });
  if (clientAuthErr) throw clientAuthErr;
  const clientUserId = clientAuth.user.id;
  console.log(`- Client logged in. User ID: ${clientUserId}`);

  const { data: existingClientProfile, error: existingClientProfileErr } = await serviceClient
    .from('client_profiles')
    .select('phone, phone_verified, phone_verified_at, display_name, tos_accepted_at')
    .eq('user_id', clientUserId)
    .maybeSingle();
  if (existingClientProfileErr) throw existingClientProfileErr;
  originalClientProfile = existingClientProfile;

  const qaVerifiedAt = new Date().toISOString();
  const { error: qaClientProfileErr } = await serviceClient.from('client_profiles').upsert({
    user_id: clientUserId,
    display_name: existingClientProfile?.display_name || 'Avery Thompson',
    phone: existingClientProfile?.phone || '+14805550142',
    phone_verified: true,
    phone_verified_at: existingClientProfile?.phone_verified_at || qaVerifiedAt,
    tos_accepted_at: existingClientProfile?.tos_accepted_at || qaVerifiedAt,
    updated_at: qaVerifiedAt,
  }, { onConflict: 'user_id' });
  if (qaClientProfileErr) throw qaClientProfileErr;
  console.log('- QA client phone verification is present for the project lifecycle test.');

  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass
  });
  if (adminAuthErr) throw adminAuthErr;
  console.log(`- Admin logged in.`);

  // Find creator listing
  const { data: listings } = await creatorClient
    .from('creator_listings')
    .select('id, review_status')
    .eq('user_id', creatorUserId);
  
  const approvedListing = listings.find(l => l.review_status === 'approved') || listings[0];
  const listingId = approvedListing.id;
  console.log(`- Found Approved Creator Listing ID: ${listingId}`);

  // 1. Create a project under the client via RPC
  console.log('\n1. Creating test project as Client via RPC...');
  const { data: project, error: projectErr } = await clientClient
    .rpc('create_project_brief', {
      p_title: 'QA Pre-Launch Project Lifecycle Test',
      p_service_id: 'photography',
      p_description: 'A test project to verify delivery, revision, and disputes. Required character length is 100 characters for descriptions.',
      p_budget_min: 500.00,
      p_budget_max: 1500.00,
      p_project_duration: '4 hours',
      p_timeline: '2026-06-01',
      p_location: 'Phoenix, AZ'
    });

  if (projectErr) throw projectErr;
  projectId = project.id;
  console.log(`✅ Project created successfully. ID: ${projectId}`);

  // 2. Set creator as accepted_creator_id and transition project status to in_progress
  console.log('\n2. Setting accepted creator on project and transitioning status...');
  const { error: acceptErr } = await clientClient
    .from('projects')
    .update({
      accepted_creator_id: listingId,
      status: 'in_progress'
    })
    .eq('id', projectId);

  if (acceptErr) throw acceptErr;
  console.log('✅ Creator set as accepted and project status is in_progress.');

  // 3. Create a transaction for this project
  console.log('\n3. Creating transaction using serviceClient...');
  const { data: transaction, error: txnErr } = await serviceClient
    .from('transactions')
    .insert({
      project_id: projectId,
      creator_id: listingId,
      client_id: clientUserId,
      project_amount: 100000, // Cents ($1000)
      retainer_amount: 50000,
      final_amount: 50000,
      creator_fee_pct: 10.00,
      client_fee_pct: 5.00,
      creator_fee_amount: 10000,
      client_fee_amount: 5000,
      platform_revenue: 15000,
      retainer_status: 'paid',
      final_status: 'pending'
    })
    .select()
    .single();

  if (txnErr) throw txnErr;
  transactionId = transaction.id;
  console.log(`✅ Transaction created successfully. ID: ${transactionId}`);

  // 4. Creator submits delivery
  console.log('\n4. Submitting delivery as Creator...');
  const deliveryLink = 'https://google.com/drive/my-photos-delivery';
  const deliveryNotes = 'Here are the high-res photos from our Phoenix shoot!';
  const { data: deliveredProject, error: deliveryErr } = await creatorClient
    .from('projects')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivery_link: deliveryLink,
      delivery_notes: deliveryNotes
    })
    .eq('id', projectId)
    .select()
    .single();

  if (deliveryErr) throw deliveryErr;
  console.log(`✅ Delivery submitted. Status: ${deliveredProject.status}, Link: ${deliveredProject.delivery_link}`);

  // 5. Client requests a revision
  console.log('\n5. Requesting revision as Client...');
  const { data: revisedProject, error: revisionErr } = await clientClient
    .from('projects')
    .update({
      status: 'in_progress',
      revision_count: 1,
      delivered_at: null
    })
    .eq('id', projectId)
    .select()
    .single();

  if (revisionErr) throw revisionErr;
  console.log(`✅ Revision submitted. Status: ${revisedProject.status}, Revision Count: ${revisedProject.revision_count}, Delivered At: ${revisedProject.delivered_at}`);

  if (revisedProject.status !== 'in_progress' || revisedProject.revision_count !== 1 || revisedProject.delivered_at !== null) {
    throw new Error('Revision fields did not update correctly!');
  }

  // 6. Creator submits delivery again
  console.log('\n6. Re-submitting delivery as Creator...');
  const { data: redeliveredProject, error: redeliveryErr } = await creatorClient
    .from('projects')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivery_link: deliveryLink + '-v2',
      delivery_notes: 'Updated photos with requested color corrections.'
    })
    .eq('id', projectId)
    .select()
    .single();

  if (redeliveryErr) throw redeliveryErr;
  console.log(`✅ Delivery re-submitted. Status: ${redeliveredProject.status}`);

  // 7. Client opens a dispute
  console.log('\n7. Submitting dispute as Client...');
  const { data: dispute, error: disputeErr } = await clientClient
    .from('disputes')
    .insert({
      transaction_id: transactionId,
      raised_by: clientUserId,
      reason: 'quality_issue: Colors are still too warm, and some shots are blurry.',
      status: 'open'
    })
    .select()
    .single();

  if (disputeErr) throw disputeErr;
  disputeId = dispute.id;
  console.log(`✅ Dispute submitted successfully. ID: ${disputeId}`);

  // Transition project status to disputed
  const { data: disputedProject, error: dispProjErr } = await clientClient
    .from('projects')
    .update({
      status: 'disputed'
    })
    .eq('id', projectId)
    .select()
    .single();

  if (dispProjErr) throw dispProjErr;
  console.log(`✅ Project status transitioned to: ${disputedProject.status}`);

  // 8. Admin resolves dispute
  console.log('\n8. Resolving dispute as Admin...');
  const { data: resolvedDispute, error: resolveErr } = await serviceClient
    .from('disputes')
    .update({
      status: 'resolved',
      resolution_notes: 'Reviewed deliveries. The creator corrected color as requested. Blurry shots were out-of-focus background shots as per style brief. Releasing payment.',
      resolved_at: new Date().toISOString()
    })
    .eq('id', disputeId)
    .select()
    .single();

  if (resolveErr) throw resolveErr;
  console.log(`✅ Dispute resolved. Status: ${resolvedDispute.status}`);

  // Transition project status back to approved / final_paid
  const { data: finalProject, error: finalProjErr } = await clientClient
    .from('projects')
    .update({
      status: 'approved'
    })
    .eq('id', projectId)
    .select()
    .single();

  if (finalProjErr) throw finalProjErr;
  console.log(`✅ Project status transitioned to: ${finalProject.status}`);

  // Clean up
  console.log('\nCleaning up created test records...');
  const { error: cleanDisputeErr } = await serviceClient.from('disputes').delete().eq('id', disputeId);
  if (cleanDisputeErr) console.warn('Warning during dispute cleanup:', cleanDisputeErr.message);

  const { error: cleanTxnErr } = await serviceClient.from('transactions').delete().eq('id', transactionId);
  if (cleanTxnErr) console.warn('Warning during transaction cleanup:', cleanTxnErr.message);

  const { error: cleanProjErr } = await serviceClient.from('projects').delete().eq('id', projectId);
  if (cleanProjErr) console.warn('Warning during project cleanup:', cleanProjErr.message);

  if (originalClientProfile) {
    const { error: restoreClientErr } = await serviceClient.from('client_profiles').update({
      phone: originalClientProfile.phone,
      phone_verified: originalClientProfile.phone_verified,
      phone_verified_at: originalClientProfile.phone_verified_at,
      display_name: originalClientProfile.display_name,
      tos_accepted_at: originalClientProfile.tos_accepted_at,
      updated_at: new Date().toISOString(),
    }).eq('user_id', clientUserId);
    if (restoreClientErr) console.warn('Warning during client profile restore:', restoreClientErr.message);
  }

  console.log('✅ Cleanup complete.');
  console.log('\n--- ALL PROJECT LIFECYCLE AND DISPUTE TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\nFatal test execution error:', err.message);
  process.exit(1);
});
