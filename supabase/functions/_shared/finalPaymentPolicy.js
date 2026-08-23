export function expectedFinalChargeCents(transaction) {
  const finalAmount = Number(transaction?.final_amount || 0);
  const clientFee = Number(transaction?.client_fee_amount || 0);
  const total = finalAmount + clientFee;
  if (!Number.isInteger(total) || total <= 0) throw new Error('Trusted final payment amount is invalid');
  return total;
}

export function validateFinalPaymentIntent(intent, transaction) {
  if (Number(intent?.amount) !== expectedFinalChargeCents(transaction)) throw new Error('Final payment amount mismatch');
  if (intent?.currency !== 'usd') throw new Error('Final payment currency mismatch');
  const metadata = intent?.metadata || {};
  if (
    metadata.paymentType !== 'final'
    || metadata.paymentFlow !== 'platform_charge_then_transfer'
    || String(metadata.transactionId) !== String(transaction.id)
    || String(metadata.projectId) !== String(transaction.project_id)
    || String(metadata.creatorId) !== String(transaction.creator_id)
    || String(metadata.clientId) !== String(transaction.client_id)
  ) throw new Error('Final payment ownership or flow mismatch');
  return true;
}

export function classifyFinalPaymentIntent(intent) {
  if (intent?.status === 'succeeded' || intent?.status === 'processing') {
    return { state: 'processing', requiresAction: false };
  }
  if (intent?.status === 'requires_action' || intent?.status === 'requires_payment_method') {
    return { state: 'attention', requiresAction: true };
  }
  return { state: 'attention', requiresAction: false };
}

export function finalPaymentAttemptKey(transactionId, attempt) {
  if (!transactionId) throw new Error('Final payment transaction id is required');
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('Final payment attempt must be a positive integer');
  return `cb_final_auto_${transactionId}_${attempt}`;
}
