import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log('SKIP: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(0);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const table of [
  'identity_consents',
  'identity_verifications',
  'identity_provider_events',
  'identity_review_actions',
]) {
  const { error } = await admin.from(table).select('*', { head: true, count: 'exact' });
  assert(!error, `${table} is unavailable: ${error?.message}`);
}

for (const functionName of [
  'phone-send-code',
  'phone-check-code',
  'create-identity-session',
  'stripe-webhook',
]) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert(response.status !== 404, `${functionName} is not deployed`);
  assert(response.status < 500, `${functionName} failed its unauthenticated health probe with ${response.status}`);
}

console.log(JSON.stringify({
  ok: true,
  identityTablesReachable: true,
  identityFunctionsDeployed: true,
  biometricCompletionRequiresManualQa: true,
}, null, 2));
