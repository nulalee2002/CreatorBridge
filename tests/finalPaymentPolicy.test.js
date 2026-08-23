import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationUrl = new URL('../supabase/migrations/20260823044500_final_payment_recovery.sql', import.meta.url);
const createIntentUrl = new URL('../supabase/functions/create-payment-intent/index.ts', import.meta.url);
const processorUrl = new URL('../supabase/functions/process-final-payment/index.ts', import.meta.url);
const webhookUrl = new URL('../supabase/functions/stripe-webhook/index.ts', import.meta.url);
const attentionUrl = new URL('../src/components/project/FinalPaymentAttention.jsx', import.meta.url);
const completionHookUrl = new URL('../src/hooks/useProjectCompletion.js', import.meta.url);

test('final payment recovery state is durable and server controlled', () => {
  assert.equal(existsSync(migrationUrl), true);
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /stripe_customer_id/i);
  assert.match(sql, /payment_method_consent_at/i);
  assert.match(sql, /final_payment_queued_at/i);
  assert.match(sql, /final_payment_attempt_count/i);
  assert.match(sql, /final_payment_requires_action/i);
  assert.match(sql, /final_payment_attention/i);
  assert.match(sql, /queue_project_final_payment/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /revoke all on function[\s\S]*anon[\s\S]*authenticated/i);
});

test('retainer checkout records explicit consent and saves a reusable Stripe method', () => {
  const source = readFileSync(createIntentUrl, 'utf8');
  assert.match(source, /savePaymentMethodForFinal/);
  assert.match(source, /setup_future_usage:\s*'off_session'/);
  assert.match(source, /stripe\.customers\.create/);
  assert.match(source, /payment_method_consent_at/);
  assert.match(source, /stripe_customer_id/);
});

test('final payment processor authenticates callers and never declares payment paid', () => {
  assert.equal(existsSync(processorUrl), true);
  const source = readFileSync(processorUrl, 'utf8');
  assert.match(source, /PLATFORM_JOB_SECRET/);
  assert.match(source, /auth\.getUser/);
  assert.match(source, /off_session:\s*true/);
  assert.match(source, /confirm:\s*true/);
  assert.match(source, /client_payment_method_id/);
  assert.match(source, /final_payment_attention/);
  assert.match(source, /requires_action/);
  assert.doesNotMatch(source, /final_status:\s*['"]paid['"]/);
  assert.doesNotMatch(source, /final_status:\s*['"]released['"]/);
});

test('signed Stripe webhook remains the only success and payout transition', () => {
  const source = readFileSync(webhookUrl, 'utf8');
  assert.match(source, /constructEventAsync\([\s\S]*webhookSecret/);
  assert.match(source, /payment_intent\.succeeded/);
  assert.match(source, /final_status:\s*'paid'/);
  assert.match(source, /releaseCreatorPayout/);
  assert.match(source, /final_payment_requires_action:\s*false/);
  assert.match(source, /final_payment_attention/);
});

test('client sees a recoverable payment-attention state with truthful copy', () => {
  assert.equal(existsSync(attentionUrl), true);
  const source = readFileSync(attentionUrl, 'utf8');
  const hook = readFileSync(completionHookUrl, 'utf8');
  assert.match(source, /final_payment_attention/);
  assert.match(hook, /process-final-payment/);
  assert.match(source, /confirmCardPayment/);
  assert.match(source, /not released until Stripe confirms/i);
});
