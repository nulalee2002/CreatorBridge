import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { provisionQaTrust } from './lib/qaTrust.mjs';

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
  console.log('--- STARTING MESSAGING AND SECURITY TEST SUITE ---');

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
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('\nLogging in test users...');
  const { data: creatorAuth, error: creatorAuthErr } = await creatorClient.auth.signInWithPassword({
    email: creatorEmail,
    password: creatorPass
  });
  if (creatorAuthErr) throw creatorAuthErr;
  const creatorUserId = creatorAuth.user.id;
  console.log(`- Creator logged in. ID: ${creatorUserId}`);

  const { data: clientAuth, error: clientAuthErr } = await clientClient.auth.signInWithPassword({
    email: clientEmail,
    password: clientPass
  });
  if (clientAuthErr) throw clientAuthErr;
  const clientUserId = clientAuth.user.id;
  console.log(`- Client logged in. ID: ${clientUserId}`);

  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPass
  });
  if (adminAuthErr) throw adminAuthErr;
  const adminUserId = adminAuth.user.id;
  console.log(`- Admin logged in. ID: ${adminUserId}`);

  const restoreAdminTrust = await provisionQaTrust(serviceClient, adminUserId);
  const restoreClientTrust = await provisionQaTrust(serviceClient, clientUserId);
  const messageIds = [];

  try {
  // 1. Test clean message transmission (no active booking: admin to creator)
  console.log(`\n1. Testing clean message transmission (no active booking)...`);
  const cleanMsgText = 'Hello! I am checking on the platform status. No contact details here.';
  const { data: cleanMsg, error: cleanMsgErr } = await adminClient.rpc('send_creatorbridge_message', {
    p_recipient_id: creatorUserId,
    p_body: cleanMsgText,
  });

  if (cleanMsgErr) {
    throw new Error(`Failed clean message transmission: ${cleanMsgErr.message}`);
  }
  messageIds.push(cleanMsg.id);
  console.log('✅ Clean message sent successfully! Message ID:', cleanMsg.id);

  // 2. Test contact details blocking (no active booking: admin to creator)
  console.log(`\n2. Testing contact details blocking (no active booking)...`);
  const contactDetails = [
    'My email is test-email@example.com. Talk soon!',
    'Call me at 480-555-0199 or text.',
    'Let us talk on instagram: @myhandle',
    'Visit my link: www.google.com',
    'Email me at test at example dot com'
  ];

  for (const text of contactDetails) {
    const { data: failMsg, error: blockErr } = await adminClient.rpc('send_creatorbridge_message', {
      p_recipient_id: creatorUserId,
      p_body: text,
    });

    if (blockErr && blockErr.message.includes('Contact details must stay inside CreatorBridge')) {
      console.log(`✅ Correctly blocked: "${text}"`);
    } else {
      throw new Error(`Failed to block contact details in "${text}": ${blockErr ? blockErr.message : 'Message went through'}`);
    }
  }

  // 3. Test contact details allowed with active booking (client to creator)
  console.log(`\n3. Testing contact details allowed with active booking...`);
  const contactText = 'Hey, here is my contact detail. Email me at info@creatorbridge.studio or phone 602-555-0100.';
  const { data: allowedMsg, error: allowErr } = await clientClient.rpc('send_creatorbridge_message', {
    p_recipient_id: creatorUserId,
    p_body: contactText,
  });

  if (allowErr) {
    throw new Error(`Failed to allow contact info with active booking: ${allowErr.message}`);
  }
  messageIds.push(allowedMsg.id);
  console.log('✅ Message containing contact details successfully permitted due to active booking! Message ID:', allowedMsg.id);

  // 4. Test read receipt status marking
  console.log(`\n4. Testing read receipt marking...`);
  console.log('Checking message read status before marking...');
  const { data: messagesBefore, error: fetchErr } = await creatorClient.from('messages')
    .select('id, read')
    .eq('id', cleanMsg.id)
    .single();
  if (fetchErr) throw fetchErr;
  console.log(`- Before marking: Message read status is ${messagesBefore.read}`);

  console.log('Marking conversation as read by creator...');
  const { error: readReceiptErr } = await creatorClient.rpc('mark_conversation_messages_read', {
    p_conversation_id: cleanMsg.conversation_id,
  });
  if (readReceiptErr) throw readReceiptErr;

  const { data: messagesAfter, error: fetchAfterErr } = await creatorClient.from('messages')
    .select('id, read')
    .eq('id', cleanMsg.id)
    .single();
  if (fetchAfterErr) throw fetchAfterErr;
  console.log(`- After marking: Message read status is ${messagesAfter.read}`);

  if (messagesAfter.read !== true) {
    throw new Error('Message was not marked read');
  }
  console.log('✅ Read receipt successfully processed!');

  console.log('\n--- ALL MESSAGING AND SECURITY TESTS PASSED SUCCESSFULLY! ---');
  } finally {
    if (messageIds.length > 0) {
      const { error: cleanupError } = await serviceClient.from('messages').delete().in('id', messageIds);
      if (cleanupError) console.warn('Warning during message cleanup:', cleanupError.message);
    }
    await restoreClientTrust();
    await restoreAdminTrust();
    await creatorClient.auth.signOut();
    await clientClient.auth.signOut();
    await adminClient.auth.signOut();
  }
}

runTests().catch(err => {
  console.error('\nFatal test execution error:', err.message);
  process.exit(1);
});
