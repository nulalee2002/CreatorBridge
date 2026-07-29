import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = path => readFileSync(join(root, path), 'utf8');
const optionalSource = path => existsSync(join(root, path)) ? source(path) : '';
const migrationSource = () => readdirSync(join(root, 'supabase/migrations'))
  .filter(name => name.includes('human_identity') || name.includes('identity_admin_review'))
  .map(name => source(`supabase/migrations/${name}`))
  .join('\n');

const sql = migrationSource();
for (const expected of [
  'create table if not exists public.identity_consents',
  'create table if not exists public.identity_verifications',
  'create table if not exists public.identity_provider_events',
  'create table if not exists public.identity_review_actions',
  'creatorbridge_private.user_phone_verified',
  'creatorbridge_private.user_identity_verified',
  'public.get_my_trust_status',
  'public.require_verified_project_parties',
  'enable row level security',
]) {
  expect(sql.toLowerCase().includes(expected.toLowerCase()), `Identity migrations missing: ${expected}`);
}

for (const forbidden of [
  'id_image',
  'government_id_image',
  'selfie_url',
  'selfie_image',
  'face_embedding',
  'face_vector',
  'raw_payload',
  'verification_report_json',
]) {
  expect(!sql.toLowerCase().includes(forbidden), `Identity migrations must not persist prohibited field: ${forbidden}`);
}

const phoneSend = optionalSource('supabase/functions/phone-send-code/index.ts');
const phoneCheck = optionalSource('supabase/functions/phone-check-code/index.ts');
expect(phoneSend.includes('auth.getUser'), 'Shared phone send function must derive the caller from Supabase Auth');
expect(phoneCheck.includes('auth.getUser'), 'Shared phone check function must derive the caller from Supabase Auth');
expect(phoneCheck.includes('phone_verified'), 'Shared phone check function must persist verified phone state server-side');

const createIdentitySession = optionalSource('supabase/functions/create-identity-session/index.ts');
expect(createIdentitySession.includes('require_live_capture'), 'Stripe Identity must require live document capture');
expect(createIdentitySession.includes('require_matching_selfie'), 'Stripe Identity must require a matching selfie');
expect(createIdentitySession.includes('identity_consents'), 'Stripe Identity session creation must record dedicated consent');
expect(createIdentitySession.includes('idempotencyKey'), 'Stripe Identity session creation must be idempotent');

const identityWebhook = optionalSource('supabase/functions/stripe-identity-webhook/index.ts');
expect(identityWebhook.includes('STRIPE_IDENTITY_WEBHOOK_SECRET'), 'Identity webhook must use its dedicated signing secret');
expect(identityWebhook.includes('constructEventAsync'), 'Identity webhook must verify Stripe signatures');
expect(identityWebhook.includes('identity_provider_events'), 'Identity webhook must claim provider events idempotently');

for (const [path, expected] of [
  ['supabase/functions/sign-contract/index.ts', 'user_identity_verified'],
  ['supabase/functions/create-payment-intent/index.ts', 'require_verified_project_parties'],
  ['supabase/functions/create-call-token/index.ts', 'require_verified_project_parties'],
  ['supabase/functions/create-collaboration-payment/index.ts', 'user_identity_verified'],
]) {
  expect(optionalSource(path).includes(expected), `${path} must enforce ${expected}`);
}

const protectedSources = [
  optionalSource('supabase/functions/create-identity-session/index.ts'),
  optionalSource('supabase/functions/stripe-identity-webhook/index.ts'),
].join('\n').toLowerCase();
for (const forbidden of ['raw_payload', 'verification_report_json', 'selfie_url', 'face_embedding']) {
  expect(!protectedSources.includes(forbidden), `Identity functions must not persist prohibited field: ${forbidden}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  trustSchema: true,
  providerDataMinimized: true,
  phoneSharedAcrossRoles: true,
  trustedActionsServerGated: true,
}, null, 2));
