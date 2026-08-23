import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const functionUrl = new URL('../supabase/functions/create-revision-payment/index.ts', import.meta.url);
const webhook = readFileSync(new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url), 'utf8');
const email = readFileSync(new URL('../supabase/functions/send-notification-email/index.ts', import.meta.url), 'utf8');

test('creates paid revision charges from trusted project data at exactly fifty dollars', () => {
  assert.equal(existsSync(functionUrl), true, 'create-revision-payment Edge Function must exist');
  const source = readFileSync(functionUrl, 'utf8');
  assert.match(source, /const PAID_REVISION_PRICE_CENTS = 5_000/);
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /project\.client_id !== authData\.user\.id/);
  assert.match(source, /completed_projects/);
  assert.match(source, /client_fee_cents:\s*0/);
  assert.match(source, /paymentFlow:\s*'paid_revision'/);
  assert.match(source, /paymentType:\s*'project_revision'/);
  assert.match(source, /idempotencyKey:/);
});

test('fulfills one revision entitlement only after a validated Stripe success event', () => {
  assert.match(webhook, /paymentFlow === 'paid_revision'/);
  assert.match(webhook, /pi\.amount !== 5_000/);
  assert.match(webhook, /pi\.currency !== 'usd'/);
  assert.match(webhook, /entitlement_status:\s*'available'/);
  assert.match(webhook, /stripe_event_id:\s*event\.id/);
  assert.doesNotMatch(webhook, /const \{ paymentType \} = pi\.metadata;\s*const \{ paymentType \} = pi\.metadata;/);
});

test('failed or canceled payments stay locked and produce client notifications', () => {
  assert.match(webhook, /case 'payment_intent\.payment_failed'/);
  assert.match(webhook, /case 'payment_intent\.canceled'/);
  assert.match(webhook, /payment_status:\s*'failed'/);
  assert.match(webhook, /payment_status:\s*'canceled'/);
  assert.match(webhook, /notifyRevisionPurchaseClient\(supabaseAdmin, purchase, 'failed'\)/);
  assert.match(email, /case 'revision_purchase_succeeded'/);
  assert.match(email, /case 'revision_purchase_failed'/);
  assert.match(email, /case 'revision_requested'/);
});
