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
  missingAuth.response.status === 403,
  `Missing auth should be blocked with HTTP 403, got ${missingAuth.response.status}: ${JSON.stringify(missingAuth.body)}`
);
assert(
  /Authentication is required/i.test(missingAuth.body?.error || ''),
  `Missing auth error should explain authentication is required, got: ${JSON.stringify(missingAuth.body)}`
);

const fakeAuth = await callReleasePayment({ Authorization: 'Bearer definitely-not-a-real-token' });
assert(
  fakeAuth.response.status === 403,
  `Invalid auth should be blocked with HTTP 403, got ${fakeAuth.response.status}: ${JSON.stringify(fakeAuth.body)}`
);

const source = readFileSync(new URL('../supabase/functions/release-payment/index.ts', import.meta.url), 'utf8');
assert(
  source.includes("supabaseAdmin.auth.getUser(token)"),
  'release-payment must validate the caller token with Supabase Auth'
);
assert(
  source.includes("authData.user.id === txn.client_id"),
  'release-payment must authorize the paying client before release'
);
assert(
  source.includes("rpc('is_platform_admin'"),
  'release-payment must allow platform admin release through admin RPC check'
);
assert(
  source.includes("Deno.env.get('PLATFORM_JOB_SECRET')"),
  'release-payment must require PLATFORM_JOB_SECRET for trusted jobs'
);
assert(
  source.includes('supabaseAdmin.auth.admin.getUserById(creatorListing.user_id)'),
  'release-payment email must resolve creator auth user through creator_listings.user_id'
);

console.log(JSON.stringify({
  ok: true,
  unauthenticatedBlocked: true,
  invalidTokenBlocked: true,
  clientOrAdminAuthorizationPresent: true,
  trustedJobSecretPresent: true,
  creatorEmailResolvedThroughListingUserId: true,
}, null, 2));
