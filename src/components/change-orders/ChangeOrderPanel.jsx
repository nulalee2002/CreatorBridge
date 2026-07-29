import { useEffect, useState } from 'react';
import { FilePlus2, PenLine, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { ChangeOrderForm } from './ChangeOrderForm.jsx';
import { ChangeOrderSignModal } from './ChangeOrderSignModal.jsx';
import { ChangeOrderPayment } from './ChangeOrderPayment.jsx';

export function ChangeOrderPanel({ projectId, userId }) {
  const [orders, setOrders] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [sourceSummaryId, setSourceSummaryId] = useState(null);
  const [signing, setSigning] = useState(null);
  const [error, setError] = useState('');
  async function load() {
    if (!projectId) return;
    const { data, error: loadError } = await supabase.rpc('get_project_change_orders', { p_project_id: projectId });
    if (loadError) { setError(loadError.message); return; }
    setOrders(data || []);
    const ids = (data || []).map(order => order.id);
    if (ids.length) {
      const { data: signatureRows } = await supabase.from('change_order_signatures').select('*').in('change_order_id', ids);
      setSignatures(signatureRows || []);
    } else setSignatures([]);
  }
  async function transition(order, action) {
    const reason = window.prompt(action === 'decline' ? 'Why are you declining this proposed change?' : 'Why are you voiding this change order?');
    if (!reason?.trim()) return;
    const { error: actionError } = await supabase.rpc(action === 'decline' ? 'decline_change_order' : 'void_change_order', {
      p_change_order_id: order.id,
      p_reason: reason.trim(),
    });
    if (actionError) setError(actionError.message); else load();
  }
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => {
    const open = event => {
      if (event.detail?.projectId !== projectId) return;
      setSourceSummaryId(event.detail?.summaryId || null);
      setShowForm(true);
    };
    window.addEventListener('creatorbridge:create-change-order', open);
    return () => window.removeEventListener('creatorbridge:create-change-order', open);
  }, [projectId]);
  return (
    <section className="rounded-xl border border-white/[0.07] bg-charcoal-900/55 p-4">
      <div className="flex items-center justify-between">
        <div><p className="text-xs font-bold text-white">Change orders</p><p className="mt-1 text-[10px] leading-4 text-charcoal-400">A call summary records discussion. Only a separately signed change order changes scope, price, dates, revisions, or rights.</p></div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 rounded-lg border border-gold-500/25 px-2.5 py-1.5 text-[10px] font-bold text-gold-300"><FilePlus2 size={12} /> Create</button>
      </div>
      {showForm && <div className="mt-4"><ChangeOrderForm projectId={projectId} sourceSummaryId={sourceSummaryId} onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} /></div>}
      <div className="mt-4 space-y-3">
        {orders.map(order => {
          const mine = signatures.some(sig => sig.change_order_id === order.id && sig.signer_user_id === userId);
          return (
            <div key={order.id} className="rounded-lg border border-white/[0.07] bg-charcoal-950/60 p-3">
              <div className="flex justify-between gap-3"><div><p className="text-xs font-bold text-white">{order.document_number}</p><p className="text-[10px] capitalize text-charcoal-400">{order.status.replaceAll('_',' ')} · ${(order.price_delta_cents/100).toFixed(2)} added</p></div>
              {!mine && ['proposed','client_signed','creator_signed'].includes(order.status) && <button onClick={() => setSigning(order)} className="flex items-center gap-1 text-[10px] font-bold text-gold-300"><PenLine size={12} /> Review and sign</button>}</div>
              {['proposed','client_signed','creator_signed'].includes(order.status) && (
                <div className="mt-2 flex gap-3">
                  {order.initiated_by !== userId && <button onClick={() => transition(order,'decline')} className="text-[10px] font-bold text-red-300">Decline with reason</button>}
                  {order.initiated_by === userId && <button onClick={() => transition(order,'void')} className="text-[10px] font-bold text-charcoal-300">Void with reason</button>}
                </div>
              )}
              {!['active'].includes(order.status) && <p className="mt-2 text-[10px] text-charcoal-400">This record does not change the project yet.</p>}
              {order.status === 'awaiting_additional_retainer' && userId === order.client_id && <div className="mt-3"><ChangeOrderPayment order={order} onPaid={load} /></div>}
            </div>
          );
        })}
        {!orders.length && <p className="text-[11px] text-charcoal-400">No change orders. The original agreement remains the complete scope.</p>}
      </div>
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
      <button onClick={load} className="mt-3 flex items-center gap-1 text-[10px] text-charcoal-400"><RefreshCw size={10} /> Refresh</button>
      {signing && <ChangeOrderSignModal order={signing} onClose={() => setSigning(null)} onSigned={() => { setSigning(null); load(); }} />}
    </section>
  );
}
