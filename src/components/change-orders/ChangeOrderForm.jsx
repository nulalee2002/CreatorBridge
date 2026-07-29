import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

const CATEGORIES = [
  ['scope', 'Scope or deliverables'],
  ['timeline', 'Dates or delivery timeline'],
  ['responsibilities', 'Responsibilities'],
  ['revisions', 'Revision allowance'],
  ['usage_rights', 'Usage rights'],
];

export function ChangeOrderForm({ projectId, sourceSummaryId = null, onClose, onCreated }) {
  const [category, setCategory] = useState('scope');
  const [reason, setReason] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [priceDelta, setPriceDelta] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sourceSummaryId) setReason('Document a material term discussed in the agreed call summary.');
  }, [sourceSummaryId]);

  async function submit(event) {
    event.preventDefault();
    const dollars = Number(priceDelta);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError('Price reductions, refunds, and credits go through CreatorBridge support.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: draft, error: draftError } = await supabase.rpc('create_change_order_draft', {
        p_project_id: projectId,
        p_source_summary_id: sourceSummaryId,
        p_reason: reason,
        p_changes: {
          before: { [category]: before.trim() },
          after: { [category]: after.trim() },
          responsibilities: responsibility.trim() ? [responsibility.trim()] : [],
        },
        p_price_delta_cents: Math.round(dollars * 100),
      });
      if (draftError) throw draftError;
      const { error: pdfError } = await supabase.functions.invoke('generate-change-order', { body: { changeOrderId: draft.id } });
      if (pdfError) throw pdfError;
      const { data: proposed, error: proposeError } = await supabase.rpc('propose_change_order', { p_change_order_id: draft.id });
      if (proposeError) throw proposeError;
      onCreated?.(proposed);
    } catch (err) {
      setError(err?.message || 'The change order could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gold-500/25 bg-charcoal-950/80 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">Create a change order</p>
          <p className="mt-1 text-[11px] leading-5 text-charcoal-300">This becomes binding only after both signatures and any added retainer.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-charcoal-400 hover:text-white"><X size={16} /></button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg border border-white/10 bg-charcoal-900 px-3 py-2 text-xs text-white">
          {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="number" min="0" step="0.01" value={priceDelta} onChange={e => setPriceDelta(e.target.value)} placeholder="Added project price" className="rounded-lg border border-white/10 bg-charcoal-900 px-3 py-2 text-xs text-white" />
        <textarea required value={before} onChange={e => setBefore(e.target.value)} placeholder="Current agreed term" rows={3} className="rounded-lg border border-white/10 bg-charcoal-900 px-3 py-2 text-xs text-white" />
        <textarea required value={after} onChange={e => setAfter(e.target.value)} placeholder="Replacement term" rows={3} className="rounded-lg border border-white/10 bg-charcoal-900 px-3 py-2 text-xs text-white" />
        <textarea required value={reason} onChange={e => setReason(e.target.value)} placeholder="Why this material change is needed" rows={3} className="rounded-lg border border-white/10 bg-charcoal-900 px-3 py-2 text-xs text-white sm:col-span-2" />
        <input value={responsibility} onChange={e => setResponsibility(e.target.value)} placeholder="Who is responsible for the changed work?" className="rounded-lg border border-white/10 bg-charcoal-900 px-3 py-2 text-xs text-white sm:col-span-2" />
      </div>
      {Number(priceDelta) < 0 && <p className="mt-2 text-xs text-gold-300">Price decreases are routed to support so refunds and credits remain auditable.</p>}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      <button type="submit" disabled={busy || !reason.trim() || !before.trim() || !after.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-xs font-bold text-charcoal-950 disabled:opacity-40">
        {busy && <Loader2 size={13} className="animate-spin" />} {busy ? 'Preparing document...' : 'Prepare and propose change order'}
      </button>
    </form>
  );
}
