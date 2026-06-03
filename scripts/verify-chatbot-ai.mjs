const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');
assert(SUPABASE_ANON_KEY, 'Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');

let response;
try {
  response = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
} catch (error) {
  throw new Error(`Could not reach Supabase chatbot function. Check network/DNS and Supabase project URL. Details: ${error.message}`);
}

const data = await response.json().catch(async () => ({ raw: await response.text() }));
if (!response.ok) {
  throw new Error(`Chatbot AI function failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
}

assert(data?.provider === 'Anthropic', 'Chatbot did not report the Anthropic provider path');
assert(typeof data?.reply === 'string' && data.reply.trim().length > 0, 'Chatbot returned an empty reply');
assert(/5|five|percent|%/i.test(data.reply), `Chatbot reply did not confirm the expected client booking fee: ${data.reply}`);

console.log(JSON.stringify({
  ok: true,
  provider: data.provider,
  model: data.model || 'unknown',
  reply: data.reply,
}, null, 2));
