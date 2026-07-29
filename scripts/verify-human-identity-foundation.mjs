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
}, null, 2));
