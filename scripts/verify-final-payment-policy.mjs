import { readFileSync } from 'node:fs';
import {
  classifyFinalPaymentIntent,
  expectedFinalChargeCents,
  finalPaymentAttemptKey,
} from '../supabase/functions/_shared/finalPaymentPolicy.js';

const migration = readFileSync(new URL('../supabase/migrations/20260823044500_final_payment_recovery.sql', import.meta.url), 'utf8');
const createIntent = readFileSync(new URL('../supabase/functions/create-payment-intent/index.ts', import.meta.url), 'utf8');
const processor = readFileSync(new URL('../supabase/functions/process-final-payment/index.ts', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
const retiredRelease = readFileSync(new URL('../supabase/functions/release-payment/index.ts', import.meta.url), 'utf8');
const attention = readFileSync(new URL('../src/components/project/FinalPaymentAttention.jsx', import.meta.url), 'utf8');

const transaction = { id: 'txn', final_amount: 50_000, client_fee_amount: 5_000 };
const checks = [
  [expectedFinalChargeCents(transaction) === 55_000, 'trusted amount derivation'],
  [classifyFinalPaymentIntent({ status: 'succeeded' }).state === 'processing', 'API success waits for webhook'],
  [classifyFinalPaymentIntent({ status: 'requires_action' }).requiresAction, 'authentication recovery state'],
  [finalPaymentAttemptKey('txn', 2) === finalPaymentAttemptKey('txn', 2), 'duplicate attempt idempotency'],
  [/for update skip locked/i.test(migration), 'atomic final-payment claims'],
  [migration.includes('creatorbridge_final_payment_url'), 'Vault-backed processor cron'],
  [createIntent.includes("setup_future_usage: 'off_session'"), 'saved method for off-session final'],
  [createIntent.includes('payment_method_consent_at'), 'durable client consent'],
  [processor.includes('off_session: true') && processor.includes('confirm: true'), 'server final attempt'],
  [!processor.includes("final_status: 'paid'") && !processor.includes("final_status: 'released'"), 'processor cannot declare success'],
  [webhook.includes('constructEventAsync') && webhook.includes("final_status:         'paid'"), 'signed webhook success transition'],
  [webhook.includes('Project payment amount or ownership mismatch'), 'webhook ledger validation'],
  [retiredRelease.includes('SIGNED_STRIPE_WEBHOOK_REQUIRED') && !retiredRelease.includes('stripe.transfers.create'), 'manual release retired'],
  [attention.includes('confirmCardPayment') && attention.includes('not released until Stripe confirms'), 'client recovery interface'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
console.log(`CreatorBridge final-payment policy verification passed: ${checks.length} checks.`);
