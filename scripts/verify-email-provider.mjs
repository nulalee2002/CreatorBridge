import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const CLIENT_EMAIL = process.env.CREATORBRIDGE_QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const CLIENT_PASSWORD = process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD;
const TEST_RECIPIENT = process.env.CREATORBRIDGE_EMAIL_TEST_TO || CLIENT_EMAIL;
const SEND_DELIVERY_TEST = ['1', 'true', 'yes'].includes(
  String(process.env.CREATORBRIDGE_EMAIL_DELIVERY_TEST || '').toLowerCase()
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');
assert(SUPABASE_ANON_KEY, 'Missing VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
assert(CLIENT_PASSWORD, 'Missing CREATORBRIDGE_QA_CLIENT_PASSWORD in local .env or environment');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
  email: CLIENT_EMAIL,
  password: CLIENT_PASSWORD,
});
if (signInError) throw signInError;

const accessToken = authData?.session?.access_token;
assert(accessToken, 'Could not get a signed-in access token for email verification');

const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify(SEND_DELIVERY_TEST
    ? {
        to: TEST_RECIPIENT,
        template: 'support_ticket_opened',
        data: {
          user_name: 'CreatorBridge QA',
          ticket_reference: `EMAIL-QA-${Date.now()}`,
        },
      }
    : { verifyOnly: true }),
});

const data = await response.json().catch(async () => ({ raw: await response.text() }));
if (!response.ok) {
  throw new Error(`Email function failed with HTTP ${response.status}: ${JSON.stringify(data)}`);
}

assert(data?.success === true, 'Email function did not report success');
assert(data?.logged !== true, 'Email function is in local mock mode; RESEND_API_KEY is not configured in Supabase secrets');
if (SEND_DELIVERY_TEST) {
  assert(Boolean(data?.id), 'Resend did not return an email id');
} else {
  assert(data?.verifiedOnly === true, 'Email function did not run in verify-only mode');
  assert(data?.providerConfigured === true, 'RESEND_API_KEY is not configured in Supabase secrets');
}

console.log(JSON.stringify({
  ok: true,
  mode: SEND_DELIVERY_TEST ? 'delivery' : 'verify-only',
  recipient: SEND_DELIVERY_TEST ? TEST_RECIPIENT : null,
  provider: 'Resend',
  resendMessageId: data.id || null,
}, null, 2));
