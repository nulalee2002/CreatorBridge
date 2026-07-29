import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const read = path => readFileSync(join(root, path), 'utf8');
const optional = path => existsSync(join(root, path)) ? read(path) : '';
const expect = (condition, message) => { if (!condition) failures.push(message); };
const migrations = readdirSync(join(root, 'supabase/migrations'))
  .filter(name => name.endsWith('.sql'))
  .sort()
  .map(name => read(`supabase/migrations/${name}`))
  .join('\n');

for (const expected of [
  'public.contract_change_orders',
  'public.change_order_signatures',
  'public.change_order_payments',
  'public.get_project_change_orders',
  'public.get_project_documents',
  'public.create_change_order_draft',
  'public.propose_change_order',
  'public.decline_change_order',
  'public.void_change_order',
  'public.refresh_change_order_signature_status',
  'price_delta_cents >= 0',
  'enable row level security',
]) {
  expect(migrations.includes(expected), `Change-order migrations missing: ${expected}`);
}

for (const file of [
  'src/utils/contractTerms.js',
  'src/components/ContractSignModal.jsx',
  'supabase/functions/generate-contract/index.ts',
  'tests/contractTerms.test.js',
  'scripts/verify-contract-esign-rebook.mjs',
]) {
  expect(!optional(file).includes('attorney_review_required'), `${file} still contains active attorney review metadata`);
}

for (const file of [
  'supabase/functions/generate-change-order/index.ts',
  'supabase/functions/sign-change-order/index.ts',
  'supabase/functions/create-change-order-payment/index.ts',
  'src/components/change-orders/ChangeOrderPanel.jsx',
  'src/components/ProjectDocuments.jsx',
  'src/components/ProjectProtectionGuide.jsx',
]) {
  expect(existsSync(join(root, file)), `Missing ${file}`);
}

const sign = optional('supabase/functions/sign-change-order/index.ts');
expect(sign.includes('signedContentHash'), 'Change-order signatures must be hash bound');
expect(sign.includes("rpc('require_verified_project_parties'"), 'Change-order signing must require both verified project parties');
const payment = optional('supabase/functions/create-change-order-payment/index.ts');
expect(payment.includes("paymentFlow: 'change_order'"), 'Change-order payments need isolated Stripe metadata');
expect(payment.includes('cb_change_order_'), 'Change-order payments need a stable idempotency key');
const webhook = optional('supabase/functions/stripe-webhook/index.ts');
expect(webhook.includes("paymentFlow === 'change_order'"), 'Stripe webhook must isolate change-order settlement');
const storage = optional('supabase/functions/create-storage-signed-url/index.ts');
expect(storage.includes('contract_change_orders'), 'Private downloads must authorize change-order records');
const board = optional('src/pages/ProjectBoard.jsx');
expect(board.includes('<ProjectDocuments'), 'Project Board must expose participant documents');
expect(board.includes('<ChangeOrderPanel'), 'Project Board must expose change-order workflow');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, protectedChangeOrders: true }, null, 2));
