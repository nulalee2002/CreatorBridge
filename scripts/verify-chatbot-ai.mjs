import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const CLIENT_EMAIL = process.env.CREATORBRIDGE_QA_CLIENT_EMAIL || process.env.QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const CLIENT_PASSWORD = process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD || process.env.QA_CLIENT_PASS;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');
assert(SUPABASE_ANON_KEY, 'Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
assert(CLIENT_PASSWORD, 'Missing CREATORBRIDGE_QA_CLIENT_PASSWORD or QA_CLIENT_PASS in local .env');

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const signIn = await client.auth.signInWithPassword({
  email: CLIENT_EMAIL,
  password: CLIENT_PASSWORD,
});
assert(!signIn.error, `Could not sign in QA client for paid AI test: ${signIn.error?.message}`);

let anonResponse;
try {
  anonResponse = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Can anonymous users use paid live AI?' }],
    }),
  });
} catch (error) {
  throw new Error(`Could not reach Supabase chatbot function. Details: ${error.message}`);
}

assert(
  anonResponse.status === 401 || anonResponse.status === 403,
  `Anonymous paid AI should be blocked, got HTTP ${anonResponse.status}`,
);

const response = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${signIn.data.session.access_token}`,
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'system',
        content: 'You are Bridge, the CreatorBridge support assistant. Answer briefly and accurately.',
      },
      {
        role: 'user',
        content: 'In one short sentence, what booking fee do clients pay on CreatorBridge?',
      },
    ],
  }),
});

const data = await response.json().catch(async () => ({ raw: await response.text() }));
if (!response.ok) {
  throw new Error(`Chatbot AI function failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
}

assert(data?.provider === 'OpenAI', 'Chatbot did not report the OpenAI provider path');
assert(typeof data?.reply === 'string' && data.reply.trim().length > 0, 'Chatbot returned an empty reply');
assert(/5|five|percent|%/i.test(data.reply), `Chatbot reply did not confirm the expected client booking fee: ${data.reply}`);

console.log(JSON.stringify({
  ok: true,
  anonymousBlocked: true,
  provider: data.provider,
  model: data.model || 'unknown',
  dailyLimit: data.dailyLimit,
  requestCount: data.requestCount,
  reply: data.reply,
}, null, 2));
