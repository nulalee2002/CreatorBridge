import { useEffect, useMemo, useState } from 'react';
import { Check, LockKeyhole } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const PAID = new Set(['paid', 'released']);

export function ProjectTimeline({ status, dark, projectId, enabled = true }) {
  const [records, setRecords] = useState(null);
  useEffect(() => {
    if (!projectId || !enabled) {
      setRecords(null);
      return;
    }
    let active = true;
    Promise.all([
      supabase.from('contracts').select('status').eq('project_id', projectId).maybeSingle(),
      supabase.from('transactions').select('retainer_status,final_status').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_calls').select('id,status').eq('project_id', projectId),
      supabase.from('call_summaries').select('id,status').eq('project_id', projectId),
      supabase.from('contract_change_orders').select('id,status,price_delta_cents').eq('project_id', projectId),
      supabase.from('change_order_payments').select('change_order_id,retainer_status,final_status').eq('project_id', projectId),
    ]).then(([contract, transaction, calls, summaries, orders, payments]) => {
      if (active) setRecords({
        contract: contract.data,
        transaction: transaction.data,
        calls: calls.data || [],
        summaries: summaries.data || [],
        orders: orders.data || [],
        payments: payments.data || [],
      });
    });
    return () => { active = false; };
  }, [enabled, projectId, status]);

  const steps = useMemo(() => {
    const accepted = !['open', 'draft'].includes(status);
    const agreement = records?.contract?.status === 'countersigned';
    const retainer = PAID.has(records?.transaction?.retainer_status);
    const kickoff = records?.calls?.some(call => call.status === 'completed') || false;
    const summary = records?.summaries?.some(item => item.status === 'agreed') || false;
    const pendingOrder = records?.orders?.some(order => ['draft','proposed','client_signed','creator_signed','countersigned','awaiting_additional_retainer'].includes(order.status));
    const termsReady = summary && !pendingOrder;
    const production = ['in_progress','revision','delivered','approved','final_paid','completed'].includes(status);
    const delivered = ['delivered','approved','final_paid','completed'].includes(status);
    const activePaidOrders = (records?.orders || []).filter(order => order.status === 'active' && order.price_delta_cents > 0);
    const paymentByOrder = new Map((records?.payments || []).map(payment => [payment.change_order_id, payment]));
    const addedFinalsPaid = activePaidOrders.every(order => PAID.has(paymentByOrder.get(order.id)?.final_status));
    const finals = PAID.has(records?.transaction?.final_status) && addedFinalsPaid;
    return [
      { label: 'Proposal accepted', done: accepted, next: 'The client accepts one creator proposal.' },
      { label: 'Identity and signatures', done: agreement, next: 'Both parties verify identity and sign the original agreement.' },
      { label: '50% retainer', done: retainer, next: 'The client pays the original 50% retainer.' },
      { label: 'Kickoff call', done: kickoff, next: 'Schedule and complete the recorded kickoff call.' },
      { label: 'Agreed summary', done: summary, next: 'Both parties mark the shared call summary accurate.' },
      { label: 'Terms locked', done: termsReady, next: pendingOrder ? 'Finish signatures and any added retainer.' : 'Use a signed change order only if material terms changed.' },
      { label: 'Production and delivery', done: production && delivered, next: production ? 'Creator submits the agreed delivery.' : 'Production starts after the retainer.' },
      { label: 'All final payments', done: finals, next: 'Pay the original final and every active added final.' },
    ];
  }, [records, status]);
  const currentIndex = Math.max(0, steps.findIndex(step => !step.done));
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  return (
    <div>
      <div className="w-full overflow-x-auto">
        <div className="flex min-w-max items-start py-2">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div className="flex w-[78px] flex-col items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? 'bg-gold-500 text-charcoal-950' : index === currentIndex ? 'bg-gold-500/20 text-gold-300 ring-2 ring-gold-500/30' : 'bg-white/[0.06] text-charcoal-400'}`}>
                  {step.done ? <Check size={12} /> : <LockKeyhole size={11} />}
                </div>
                <span className={`mt-1 max-w-[76px] text-center text-[9px] leading-tight ${step.done ? 'text-gold-400' : textSub}`}>{step.label}</span>
              </div>
              {index < steps.length - 1 && <div className={`mb-4 h-px w-5 ${step.done ? 'bg-gold-500' : 'bg-white/[0.08]'}`} />}
            </div>
          ))}
        </div>
      </div>
      {!steps[currentIndex]?.done && <p className={`mt-2 text-[10px] leading-4 ${textSub}`}><strong className="text-gold-300">Next:</strong> {steps[currentIndex].next}</p>}
    </div>
  );
}
