import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260823041248_project_delivery_versions.sql', import.meta.url), 'utf8');
const upload = readFileSync(new URL('../supabase/functions/create-delivery-upload/index.ts', import.meta.url), 'utf8');
const finalize = readFileSync(new URL('../supabase/functions/finalize-project-delivery/index.ts', import.meta.url), 'utf8');
const download = readFileSync(new URL('../supabase/functions/create-delivery-download/index.ts', import.meta.url), 'utf8');

const checks = [
  [/create table public\.project_deliveries/i.test(migration), 'delivery versions table'],
  [/create table public\.project_delivery_items/i.test(migration), 'delivery items table'],
  [/create table public\.project_delivery_holds/i.test(migration), 'delivery holds table'],
  [/unique \(project_id, version\)/i.test(migration), 'unique project version'],
  [/unique \(project_id, creator_user_id, idempotency_key\)/i.test(migration), 'finalization idempotency'],
  [/direct_size_bytes bigint[\s\S]*5000000000/i.test(migration), 'combined 5 GB constraint'],
  [/prevent_submitted_delivery_mutation/i.test(migration), 'immutable submitted delivery'],
  [/prevent_submitted_delivery_item_mutation/i.test(migration), 'immutable submitted items'],
  [/enforce_delivery_direct_size/i.test(migration), 'transactional aggregate cap'],
  [/enable row level security/gi.test(migration), 'RLS enabled'],
  [/revoke all on table public\.project_delivery_items from anon, authenticated/i.test(migration), 'no direct item mutation'],
  [/Project creators can upload issued delivery objects/.test(migration), 'issued-object upload policy'],
  [/file_size_limit = 5000000000/i.test(migration), 'private bucket object limit'],
  [/interval '120 hours'/i.test(migration), 'server five-day deadline'],
  [/message_type, pinned, body, read[\s\S]*'delivery', true/i.test(migration), 'pinned project delivery card'],
  [/create_platform_notification[\s\S]*'delivery_submitted'/i.test(migration), 'delivery notification'],
  [upload.includes('admin.auth.getUser(token)'), 'upload authentication'],
  [upload.includes('creator?.user_id !== authData.user.id'), 'accepted creator upload authorization'],
  [upload.includes('createSignedUploadUrl'), 'signed non-public upload'],
  [upload.includes('upsert: false'), 'non-overwriting upload'],
  [upload.includes('5_000_000_000'), 'upload byte cap'],
  [finalize.includes('verifyUploadedObject'), 'uploaded-object verification'],
  [finalize.includes("rpc('finalize_project_delivery'"), 'transactional finalization'],
  [finalize.includes("template: 'delivery_submitted'"), 'client delivery email'],
  [download.includes('admin.auth.getUser(token)'), 'download authentication'],
  [download.includes(".from('platform_admins')"), 'download admin authorization'],
  [download.includes('retention_expires_at'), 'retention enforcement'],
  [download.includes(".eq('active', true)"), 'hold-aware access'],
  [download.includes('createSignedUrl'), 'short-lived signed download'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
console.log(`CreatorBridge project-delivery verification passed: ${checks.length} checks.`);
