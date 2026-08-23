import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(SUPABASE_URL, 'Missing VITE_SUPABASE_URL or SUPABASE_URL');

const transactionId = crypto.randomUUID();
const endpoint = `${SUPABASE_URL}/functions/v1/release-payment`;

async function callReleasePayment(headers = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ transactionId }),
  });

  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  return { response, body };
}

const missingAuth = await callReleasePayment();
assert(
  [401, 403].includes(missingAuth.response.status),
  `Missing auth should be blocked with HTTP 401/403, got ${missingAuth.response.status}: ${JSON.stringify(missingAuth.body)}`
);

const fakeAuth = await callReleasePayment({ Authorization: 'Bearer definitely-not-a-real-token' });
assert(
  [401, 403].includes(fakeAuth.response.status),
  `Invalid auth should be blocked with HTTP 401/403, got ${fakeAuth.response.status}: ${JSON.stringify(fakeAuth.body)}`
);

const source = readFileSync(new URL('../supabase/functions/release-payment/index.ts', import.meta.url), 'utf8');
assert(
  source.includes('admin.auth.getUser(token)'),
  'release-payment must validate the caller token with Supabase Auth'
);
assert(
  source.includes('SIGNED_STRIPE_WEBHOOK_REQUIRED'),
  'release-payment must be a closed compatibility endpoint'
);
assert(
  source.includes('Manual payout release is disabled'),
  'release-payment must explain that manual payout release is disabled'
);
assert(
  !source.includes('stripe.transfers.create'),
  'release-payment must not create Stripe transfers'
);
assert(
  !source.includes("final_status: 'released'"),
  'release-payment must not mark a transaction released'
);

console.log(JSON.stringify({
  ok: true,
  unauthenticatedBlocked: true,
  invalidTokenBlocked: true,
  manualReleaseDisabled: true,
  signedWebhookRequired: true,
}, null, 2));
