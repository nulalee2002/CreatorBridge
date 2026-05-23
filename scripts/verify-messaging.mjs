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

const creatorEmail = 'drl33+creator@creatorbridge.studio';
const creatorPass = 'CB-Creator-K7mQ92rV!26';

const clientEmail = 'drl33+client@creatorbridge.studio';
const clientPass = 'CB-Client-L8pN43sX!26';

const adminEmail = 'drl33@creatorbridge.studio';
const adminPass = 'CB-Admin-Secured!2026';

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

  // 1. Test clean message transmission (no active booking: admin to creator)
  console.log(`\n1. Testing clean message transmission (no active booking)...`);
  const cleanMsgText = 'Hello! I am checking on the platform status. No contact details here.';
  const { data: cleanMsg, error: cleanMsgErr } = await adminClient.rpc('send_creatorbridge_message', {
    p_recipient_id: creatorUserId,
    p_body: cleanMsgText,
  });

  if (cleanMsgErr) {
    console.error('❌ Failed clean message transmission:', cleanMsgErr.message);
    process.exit(1);
  }
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
      console.error(`❌ FAILED to block: "${text}"`, blockErr ? blockErr.message : 'Message went through!');
      process.exit(1);
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
    console.error('❌ Failed to allow contact info with active booking:', allowErr.message);
    process.exit(1);
  }
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
    console.error('❌ Failed: Message was not marked read!');
    process.exit(1);
  }
  console.log('✅ Read receipt successfully processed!');

  console.log('\n--- ALL MESSAGING AND SECURITY TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\nFatal test execution error:', err.message);
  process.exit(1);
});
