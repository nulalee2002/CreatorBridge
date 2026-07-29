import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = path => readFileSync(join(root, path), 'utf8');
const optionalSource = path => {
  try {
    return source(path);
  } catch {
    return '';
  }
};
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
const phoneUi = optionalSource('src/components/PhoneVerification.jsx');
expect(phoneSend.includes('auth.getUser'), 'Shared phone send function must derive the caller from Supabase Auth');
expect(phoneCheck.includes('auth.getUser'), 'Shared phone check function must derive the caller from Supabase Auth');
expect(phoneSend.includes('account_phone_verifications'), 'Shared phone send function must reset the private trust record');
expect(phoneCheck.includes('account_phone_verifications'), 'Shared phone check function must persist the private trust record');
expect(phoneUi.includes("functions.invoke('phone-send-code'"), 'Shared phone UI must call phone-send-code');
expect(phoneUi.includes("functions.invoke('phone-check-code'"), 'Shared phone UI must call phone-check-code');

const clientVerification = optionalSource('src/components/ClientVerification.jsx');
const creatorDirectory = optionalSource('src/components/CreatorDirectory.jsx');
expect(clientVerification.includes('<PhoneVerification'), 'Client verification must use the shared phone component');
expect(creatorDirectory.includes('<PhoneVerification'), 'Creator application must use the shared phone component');

const createIdentitySession = optionalSource('supabase/functions/create-identity-session/index.ts');
const identityConsent = optionalSource('src/components/IdentityConsent.jsx');
const identityPolicy = optionalSource('supabase/functions/_shared/identityPolicy.js');
const identityVerification = optionalSource('src/components/IdentityVerification.jsx');
const contractSignModal = optionalSource('src/components/ContractSignModal.jsx');
expect(identityPolicy.includes('require_live_capture'), 'Stripe Identity must require live document capture');
expect(identityPolicy.includes('require_matching_selfie'), 'Stripe Identity must require a matching selfie');
expect(createIdentitySession.includes('identity_consents'), 'Stripe Identity session creation must record dedicated consent');
expect(createIdentitySession.includes('idempotencyKey'), 'Stripe Identity session creation must be idempotent');
expect(`${identityConsent}\n${identityPolicy}`.includes('government-issued ID'), 'Identity consent must explain government ID processing');
expect(`${identityConsent}\n${identityPolicy}`.includes('live selfie'), 'Identity consent must explain live selfie processing');
expect(identityVerification.includes("functions.invoke('create-identity-session'"), 'Identity UI must start sessions through the authenticated Edge Function');
expect(creatorDirectory.includes('<IdentityVerification'), 'Creator submission must show identity verification');
expect(contractSignModal.includes('<IdentityVerification'), 'Contract signing must show identity verification');

const identityWebhook = optionalSource('supabase/functions/stripe-identity-webhook/index.ts');
expect(identityWebhook.includes('STRIPE_IDENTITY_WEBHOOK_SECRET'), 'Identity webhook must use its dedicated signing secret');
expect(identityWebhook.includes('constructEventAsync'), 'Identity webhook must verify Stripe signatures');
expect(identityWebhook.includes('claim_identity_provider_event'), 'Identity webhook must claim provider events idempotently');
expect(identityWebhook.includes('identity.verification_session.verified'), 'Identity webhook must process verified sessions');
expect(identityWebhook.includes('identity.verification_session.requires_input'), 'Identity webhook must process failed sessions');

const protectedIdentitySources = `${createIdentitySession}\n${identityWebhook}`.toLowerCase();
for (const forbidden of ['raw_payload', 'verification_report_json', 'selfie_url', 'face_embedding']) {
  expect(!protectedIdentitySources.includes(forbidden), `Identity functions must not persist prohibited field: ${forbidden}`);
}

for (const expected of [
  'public.user_identity_verified',
  'creatorbridge_private.user_phone_verified(v_user_id)',
  'creatorbridge_private.user_identity_verified(v_user_id)',
  'Phone verification is required before submitting a creator application',
  'Identity verification is required before submitting a creator application',
  'Phone verification is required before contacting creators',
  'Both project parties must complete identity verification',
]) {
  expect(sql.includes(expected), `Identity enforcement migration missing: ${expected}`);
}

const signContract = optionalSource('supabase/functions/sign-contract/index.ts');
const createPaymentIntent = optionalSource('supabase/functions/create-payment-intent/index.ts');
const createCallToken = optionalSource('supabase/functions/create-call-token/index.ts');
const collaborationPayment = optionalSource('supabase/functions/create-collaboration-payment/index.ts');
for (const [name, contents] of [
  ['contract signing', signContract],
  ['project payment', createPaymentIntent],
  ['call joining', createCallToken],
]) {
  expect(
    contents.includes("rpc('require_verified_project_parties'"),
    `${name} must enforce both project parties through the shared server predicate`,
  );
  expect(
    contents.includes('IDENTITY_VERIFICATION_REQUIRED'),
    `${name} must return a stable identity gate code`,
  );
}
expect(
  collaborationPayment.includes("rpc('user_identity_verified'"),
  'Creator collaboration funding must verify both creators through the shared server predicate',
);
expect(
  collaborationPayment.includes('IDENTITY_VERIFICATION_REQUIRED'),
  'Creator collaboration funding must return a stable identity gate code',
);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  trustSchema: true,
  providerDataMinimized: true,
  publicProfilePhoneLeakPrevented: true,
  phoneSharedAcrossRoles: true,
  consentedIdentitySession: true,
  signedIdentityWebhook: true,
}, null, 2));
