import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const CLIENT_EMAIL = process.env.CREATORBRIDGE_QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const CLIENT_PASSWORD = process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD || 'CB-Client-L8pN43sX!26';
const TEST_RECIPIENT = process.env.CREATORBRIDGE_EMAIL_TEST_TO || CLIENT_EMAIL;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');
assert(SUPABASE_ANON_KEY, 'Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { error: signInError } = await supabase.auth.signInWithPassword({
  email: CLIENT_EMAIL,
  password: CLIENT_PASSWORD,
});
if (signInError) throw signInError;

const { data, error } = await supabase.functions.invoke('send-notification-email', {
  body: {
    to: TEST_RECIPIENT,
    template: 'support_ticket_opened',
    data: {
      user_name: 'CreatorBridge QA',
      ticket_reference: `EMAIL-QA-${Date.now()}`,
    },
  },
});

if (error) throw error;
assert(data?.success === true, 'Email function did not report success');
assert(data?.logged !== true, 'Email function is in local mock mode; RESEND_API_KEY is not configured in Supabase secrets');
assert(Boolean(data?.id), 'Resend did not return an email id');

console.log(JSON.stringify({
  ok: true,
  recipient: TEST_RECIPIENT,
  provider: 'Resend',
  resendMessageId: data.id,
}, null, 2));
