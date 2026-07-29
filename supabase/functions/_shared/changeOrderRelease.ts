async function chargeId(stripe: any, paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
  return typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id || null;
}

export async function projectChangeOrderFinalsPaid(admin: any, projectId: string) {
  const { data: activeOrders } = await admin.from('contract_change_orders')
    .select('id').eq('project_id', projectId).eq('status', 'active').gt('price_delta_cents', 0);
  if (!activeOrders?.length) return true;
  const { data: ledgers } = await admin.from('change_order_payments')
    .select('change_order_id,final_status').in('change_order_id', activeOrders.map((order: any) => order.id));
  const byId = new Map((ledgers || []).map((ledger: any) => [ledger.change_order_id, ledger]));
  return activeOrders.every((order: any) => ['paid', 'released'].includes(byId.get(order.id)?.final_status));
}

export async function releasePaidChangeOrders(admin: any, stripe: any, projectId: string, destination: string) {
  const { data: orders } = await admin.from('contract_change_orders')
    .select('id').eq('project_id', projectId).eq('status', 'active').gt('price_delta_cents', 0);
  if (!orders?.length) return [];
  const { data: ledgers, error } = await admin.from('change_order_payments').select('*')
    .in('change_order_id', orders.map((order: any) => order.id));
  if (error) throw error;
  const released = [];
  for (const ledger of ledgers || []) {
    if (!['paid', 'released'].includes(ledger.retainer_status) || !['paid', 'released'].includes(ledger.final_status)) {
      throw new Error('Every active change-order final must be paid before release');
    }
    const creatorNet = Number(ledger.added_amount_cents) - Math.round(Number(ledger.added_amount_cents) * Number(ledger.creator_fee_pct) / 100);
    const retainerNet = Math.min(creatorNet, Number(ledger.retainer_amount_cents));
    const finalNet = creatorNet - retainerNet;
    let retainerTransferId = ledger.retainer_transfer_id;
    let finalTransferId = ledger.final_transfer_id;
    if (!retainerTransferId && retainerNet > 0) {
      const source = await chargeId(stripe, ledger.retainer_payment_intent);
      if (!source) throw new Error('Added-retainer source charge could not be verified');
      const transfer = await stripe.transfers.create({
        amount: retainerNet, currency: 'usd', destination, source_transaction: source,
        metadata: { paymentFlow: 'change_order', paymentType: 'change_order_retainer_release', changeOrderId: ledger.change_order_id, projectId },
      }, { idempotencyKey: `cb_change_order_release_${ledger.change_order_id}_retainer` });
      retainerTransferId = transfer.id;
    }
    if (!finalTransferId && finalNet > 0) {
      const source = await chargeId(stripe, ledger.final_payment_intent);
      if (!source) throw new Error('Added-final source charge could not be verified');
      const transfer = await stripe.transfers.create({
        amount: finalNet, currency: 'usd', destination, source_transaction: source,
        metadata: { paymentFlow: 'change_order', paymentType: 'change_order_final_release', changeOrderId: ledger.change_order_id, projectId },
      }, { idempotencyKey: `cb_change_order_release_${ledger.change_order_id}_final` });
      finalTransferId = transfer.id;
    }
    const now = new Date().toISOString();
    await admin.from('change_order_payments').update({
      retainer_status: 'released', final_status: 'released',
      retainer_transfer_id: retainerTransferId, final_transfer_id: finalTransferId,
      retainer_released_at: now, final_released_at: now, updated_at: now,
    }).eq('id', ledger.id);
    released.push({ changeOrderId: ledger.change_order_id, retainerTransferId, finalTransferId });
  }
  return released;
}
