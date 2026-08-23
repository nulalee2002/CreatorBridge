import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFinalPaymentIntent,
  expectedFinalChargeCents,
  finalPaymentAttemptKey,
  validateFinalPaymentIntent,
} from '../supabase/functions/_shared/finalPaymentPolicy.js';

const transaction = {
  id: 'txn-1', project_id: 'project-1', creator_id: 'creator-1', client_id: 'client-1',
  final_amount: 50_000, client_fee_amount: 5_000,
};

function intent(overrides = {}) {
  return {
    id: 'pi_1', amount: 55_000, currency: 'usd', status: 'processing',
    metadata: {
      transactionId: 'txn-1', projectId: 'project-1', creatorId: 'creator-1', clientId: 'client-1',
      paymentType: 'final', paymentFlow: 'platform_charge_then_transfer',
    },
    ...overrides,
  };
}

test('derives the final charge only from the trusted transaction ledger', () => {
  assert.equal(expectedFinalChargeCents(transaction), 55_000);
  assert.equal(validateFinalPaymentIntent(intent(), transaction), true);
  assert.throws(() => validateFinalPaymentIntent(intent({ amount: 54_999 }), transaction), /amount/i);
  assert.throws(() => validateFinalPaymentIntent(intent({ currency: 'eur' }), transaction), /currency/i);
  assert.throws(() => validateFinalPaymentIntent(intent({ metadata: { ...intent().metadata, clientId: 'attacker' } }), transaction), /ownership/i);
});

test('classifies Stripe responses without declaring API success paid', () => {
  assert.deepEqual(classifyFinalPaymentIntent(intent({ status: 'succeeded' })), { state: 'processing', requiresAction: false });
  assert.deepEqual(classifyFinalPaymentIntent(intent({ status: 'processing' })), { state: 'processing', requiresAction: false });
  assert.deepEqual(classifyFinalPaymentIntent(intent({ status: 'requires_action' })), { state: 'attention', requiresAction: true });
  assert.deepEqual(classifyFinalPaymentIntent(intent({ status: 'requires_payment_method' })), { state: 'attention', requiresAction: true });
  assert.deepEqual(classifyFinalPaymentIntent(intent({ status: 'canceled' })), { state: 'attention', requiresAction: false });
});

test('retry keys are stable for duplicates and distinct for a new attempt', () => {
  assert.equal(finalPaymentAttemptKey('txn-1', 2), finalPaymentAttemptKey('txn-1', 2));
  assert.notEqual(finalPaymentAttemptKey('txn-1', 2), finalPaymentAttemptKey('txn-1', 3));
  assert.throws(() => finalPaymentAttemptKey('', 1), /transaction/i);
  assert.throws(() => finalPaymentAttemptKey('txn-1', 0), /attempt/i);
});
