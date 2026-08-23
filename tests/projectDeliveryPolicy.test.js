import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const utilityUrl = new URL('../src/utils/projectDelivery.js', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260823041248_project_delivery_versions.sql', import.meta.url);

test('direct delivery files share one decimal 5 GB limit', async () => {
  assert.equal(existsSync(utilityUrl), true, 'project delivery utility must exist');
  const { directDeliveryBytes, validateDirectDelivery } = await import(utilityUrl);
  const files = [
    { size: 3_000_000_000, type: 'video/mp4', name: 'part-1.mp4' },
    { size: 2_000_000_000, type: 'video/quicktime', name: 'part-2.mov' },
  ];
  assert.equal(directDeliveryBytes(files), 5_000_000_000);
  assert.equal(validateDirectDelivery(files).ok, true);
  assert.equal(validateDirectDelivery([...files, { size: 1, type: 'application/pdf', name: 'notes.pdf' }]).code, 'DIRECT_SIZE_LIMIT');
});

test('external links do not count against storage and unsafe file types are rejected', async () => {
  const { directDeliveryBytes, normalizeDeliveryUrl, validateDirectDelivery } = await import(utilityUrl);
  assert.equal(directDeliveryBytes([{ itemType: 'external', size: 9_000_000_000 }]), 0);
  assert.equal(normalizeDeliveryUrl('drive.google.com/file/d/example'), 'https://drive.google.com/file/d/example');
  assert.equal(normalizeDeliveryUrl('javascript:alert(1)'), '');
  assert.equal(validateDirectDelivery([{ size: 100, type: 'text/html', name: 'review.html' }]).code, 'UNSAFE_FILE_TYPE');
});

test('delivery schema is private, append-only after submission, and party scoped', () => {
  assert.equal(existsSync(migrationUrl), true, 'project delivery migration must exist');
  const sql = readFileSync(migrationUrl, 'utf8');
  for (const table of ['project_deliveries', 'project_delivery_items', 'project_delivery_holds']) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /file_size_limit = 5000000000/i);
  assert.match(sql, /review_deadline_at/i);
  assert.match(sql, /interval '120 hours'/i);
  assert.match(sql, /prevent_submitted_delivery_mutation/i);
  assert.match(sql, /revoke all on table public\.project_delivery_items from anon, authenticated/i);
});

test('upload, finalization, and download functions enforce trusted authorization', () => {
  for (const name of ['create-delivery-upload', 'finalize-project-delivery', 'create-delivery-download']) {
    const url = new URL(`../supabase/functions/${name}/index.ts`, import.meta.url);
    assert.equal(existsSync(url), true, `${name} Edge Function must exist`);
    const source = readFileSync(url, 'utf8');
    assert.match(source, /auth\.getUser\(token\)/);
  }
  const finalize = readFileSync(new URL('../supabase/functions/finalize-project-delivery/index.ts', import.meta.url), 'utf8');
  assert.match(finalize, /finalize_project_delivery/);
  const download = readFileSync(new URL('../supabase/functions/create-delivery-download/index.ts', import.meta.url), 'utf8');
  assert.match(download, /createSignedUrl/);
  assert.match(download, /retention_expires_at/);
});
