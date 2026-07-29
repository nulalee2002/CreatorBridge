import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { ChangeOrderPayment } from './ChangeOrderPayment.jsx';

export function ChangeOrderFinalPayments({ projectId }) {
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  async function load() {
    const [{ data: orderRows }, { data: paymentRows }] = await Promise.all([
      supabase.from('contract_change_orders').select('*').eq('project_id', projectId).eq('status', 'active').gt('price_delta_cents', 0),
      supabase.from('change_order_payments').select('*').eq('project_id', projectId),
    ]);
    setOrders(orderRows || []); setPayments(paymentRows || []);
  }
  useEffect(() => { load(); }, [projectId]);
  const outstanding = orders.filter(order => !['paid','released'].includes(payments.find(payment => payment.change_order_id === order.id)?.final_status));
  if (!orders.length) return null;
  return (
    <div className="mb-5 rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4">
      <p className="text-sm font-bold text-white">Added finals from signed change orders</p>
      <p className="mt-1 text-xs leading-5 text-charcoal-300">Each added final remains a separate protected charge and receipt. All active finals must clear before payout release.</p>
      <div className="mt-3 space-y-3">
        {outstanding.map(order => <div key={order.id}><p className="mb-1 text-[11px] font-bold text-gold-300">{order.document_number} · ${(Math.floor(order.price_delta_cents / 2) / 100).toFixed(2)} base final</p><ChangeOrderPayment order={order} phase="final" onPaid={load} /></div>)}
        {!outstanding.length && <p className="text-xs font-bold text-forest-100">Every added final is paid.</p>}
      </div>
    </div>
  );
}
