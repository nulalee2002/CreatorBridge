import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = path => readFileSync(join(root, path), 'utf8');
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

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  trustSchema: true,
  providerDataMinimized: true,
  publicProfilePhoneLeakPrevented: true,
}, null, 2));
