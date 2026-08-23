import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Timer } from 'lucide-react';
import { RevisionPurchasePanel } from './RevisionPurchasePanel.jsx';

function deadlineText(deadline) {
  const milliseconds = new Date(deadline).getTime() - Date.now();
  if (milliseconds <= 0) return 'Review deadline reached; server processing is pending.';
  const hours = Math.ceil(milliseconds / 3_600_000);
  return hours > 48 ? `${Math.ceil(hours / 24)} days remaining` : `${hours} hours remaining`;
}

export function DeliveryReviewPanel({ completion, onOpenDispute, dark }) {
  const active = useMemo(() => completion.deliveries.find(delivery => delivery.status === 'under_review'), [completion.deliveries]);
  const [instructions, setInstructions] = useState('');
  const [showRevision, setShowRevision] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(value => value + 1), 60_000); return () => clearInterval(id); }, []);
  if (!active) return null;

  const state = completion.revisionState || { includedTotal: 2, includedRemaining: 2, paidAvailable: 0 };
  const paidRequired = state.lockReason === 'PAID_REVISION_REQUIRED' && Number(state.paidAvailable || 0) === 0;

  async function requestRevision() {
    if (instructions.trim().length < 2) return setError('Describe the changes the creator should make.');
    setBusy(true); setError('');
    try {
      await completion.requestRevision(active.id, instructions.trim(), crypto.randomUUID());
      setInstructions(''); setShowRevision(false);
    } catch (cause) { setError(cause?.message || 'Revision request could not be submitted.'); }
    finally { setBusy(false); }
  }

  async function approve() {
    setBusy(true); setError('');
    try { await completion.approveDelivery(active.id); }
    catch (cause) { setError(cause?.message || 'Approval could not be recorded.'); }
    finally { setBusy(false); }
  }

  return <section className={`rounded-2xl border p-4 ${dark ? 'border-gold-500/20 bg-charcoal-900/55 text-white' : 'border-gold-200 bg-white text-gray-900'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400">Delivery version {active.version}</p><h3 className="mt-1 font-display text-lg font-bold">Client review</h3></div><span className="flex items-center gap-1 rounded-full bg-gold-500/10 px-2 py-1 text-[10px] font-bold text-gold-300"><Timer size={11} /> {deadlineText(active.reviewDeadlineAt || active.review_deadline_at)}</span></div><p className="mt-2 text-xs leading-5 text-charcoal-300">You have five calendar days from formal submission to approve, request a revision, or open a dispute. Only the server controls this deadline. Approval, including automatic approval at the deadline, securely starts the final payment attempt.</p><div className="mt-3 rounded-lg bg-black/15 px-3 py-2 text-xs"><strong>2 included revisions per project.</strong> {state.includedRemaining} included remaining. {state.paidAvailable ? `${state.paidAvailable} paid revision available.` : ''}</div>{paidRequired ? <div className="mt-3"><RevisionPurchasePanel completion={completion} /></div> : <>{showRevision && <div className="mt-3"><textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} maxLength={5000} placeholder="Describe the requested changes" className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs" /><button type="button" disabled={busy} onClick={requestRevision} className="mt-2 w-full rounded-xl border border-gold-500/30 bg-gold-500/10 py-2.5 text-xs font-bold text-gold-300"><RotateCcw size={13} className="mr-1 inline" /> Submit revision request</button></div>}<div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={busy} onClick={approve} className="flex items-center justify-center gap-1 rounded-xl bg-gold-500 py-2.5 text-xs font-bold text-charcoal-950"><CheckCircle2 size={13} /> Approve and process final payment</button><button type="button" disabled={busy} onClick={() => setShowRevision(value => !value)} className="rounded-xl border border-gold-500/30 py-2.5 text-xs font-bold text-gold-300">Request revision</button></div></>}<button type="button" onClick={() => onOpenDispute?.(active.id)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-red-500/30 py-2.5 text-xs font-bold text-red-300"><AlertTriangle size={13} /> Open dispute</button>{error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}</section>;
}
