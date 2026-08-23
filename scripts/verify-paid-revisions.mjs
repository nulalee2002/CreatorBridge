import { readFileSync } from 'node:fs';

const payment = readFileSync(new URL('../supabase/functions/create-revision-payment/index.ts', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
const email = readFileSync(new URL('../supabase/functions/send-notification-email/index.ts', import.meta.url), 'utf8');
const ledger = readFileSync(new URL('../supabase/migrations/20260823035940_project_revision_ledgers.sql', import.meta.url), 'utf8');

const checks = [
  [payment.includes('const PAID_REVISION_PRICE_CENTS = 5_000'), 'fixed $50 price'],
  [payment.includes('admin.auth.getUser(token)'), 'authenticated caller'],
  [payment.includes('project.client_id !== authData.user.id'), 'project client authorization'],
  [payment.includes(".select('id, completed_projects')"), 'trusted fee-tier input'],
  [payment.includes('client_fee_cents: 0'), 'no added client fee'],
  [payment.includes("paymentFlow: 'paid_revision'"), 'Stripe flow metadata'],
  [payment.includes("paymentType: 'project_revision'"), 'Stripe payment type metadata'],
  [payment.includes('idempotencyKey: `cb_revision_${purchase.id}`'), 'Stripe idempotency'],
  [webhook.includes("paymentFlow === 'paid_revision'"), 'revision webhook routing'],
  [webhook.includes('pi.currency !== \'usd\''), 'currency verification'],
  [webhook.includes('pi.amount !== 5_000'), 'amount verification'],
  [webhook.includes("entitlement_status: 'available'"), 'success entitlement fulfillment'],
  [webhook.includes("case 'payment_intent.payment_failed'"), 'failed intent handling'],
  [webhook.includes("case 'payment_intent.canceled'"), 'canceled intent handling'],
  [email.includes("case 'revision_purchase_succeeded'"), 'purchase-success email'],
  [email.includes("case 'revision_purchase_failed'"), 'purchase-failure email'],
  [email.includes("case 'revision_requested'"), 'revision-request email'],
  [ledger.includes("check (gross_amount_cents = 5000)"), 'database price constraint'],
  [ledger.includes("unique (project_id, client_id, idempotency_key)"), 'database idempotency'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}

console.log(`CreatorBridge paid-revision verification passed: ${checks.length} checks.`);
