import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.CREATORBRIDGE_QA_CLIENT_EMAIL;
const password = process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD;

if (!supabaseUrl || !anonKey || !email || !password) {
  throw new Error('Missing Supabase or QA client credentials');
}

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  // p_limit=0 follows the function's read-only branch. The random user id
  // proves that authenticated browsers cannot invoke this service-only RPC,
  // without consuming anyone's quota or changing production data.
  const { error } = await client.rpc('consume_chatbot_ai_quota', {
    p_user_id: randomUUID(),
    p_limit: 0,
  });

  if (!error) {
    throw new Error('Authenticated users can execute the service-only chatbot quota RPC');
  }

  const denial = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  if (!denial.includes('permission denied') && error.code !== '42501') {
    throw new Error(`Quota RPC failed for an unexpected reason: ${error.message}`);
  }

  console.log(JSON.stringify({
    ok: true,
    authenticatedDirectExecutionBlocked: true,
    serviceRolePathRetainedByMigration: true,
  }, null, 2));
} finally {
  await client.auth.signOut();
}
