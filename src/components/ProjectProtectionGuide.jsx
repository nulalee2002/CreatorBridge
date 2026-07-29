import { useEffect, useState } from 'react';
import { Check, HelpCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const VERSION = '2026-07-29';
const STEPS = [
  ['1', 'Accepted proposal', 'CreatorBridge generates the original agreement from the accepted proposal and package.'],
  ['2', 'Identity and signatures', 'Both parties verify their identity and sign the same hash-bound agreement. CreatorBridge never signs for either party.'],
  ['3', '50% retainer', 'The client pays the first half. Production and embedded video calls remain locked until payment succeeds.'],
  ['4', 'Kickoff call and shared summary', 'The recorded call and jointly agreed summary document the conversation, but do not rewrite the agreement.'],
  ['5', 'Change order when needed', 'A material change to scope, price, dates, responsibilities, revisions, or rights gets its own document and both signatures. Added work starts after any added retainer.'],
  ['6', 'Delivery and final payments', 'The original final and every active added final are separate protected charges and must clear before payout release.'],
];

export function ProjectProtectionGuide({ projectId, userId, role = 'client' }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!projectId || !userId) return;
    supabase.from('project_guide_acknowledgments').select('project_id')
      .eq('project_id', projectId).eq('user_id', userId).eq('guide_version', VERSION).maybeSingle()
      .then(({ data }) => { if (!data) setOpen(true); });
  }, [projectId, userId]);
  async function acknowledge() {
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('acknowledge_project_protection_guide', {
      p_project_id: projectId,
      p_guide_version: VERSION,
    });
    setSaving(false);
    if (saveError) {
      setError('We could not save your acknowledgment. Please try again.');
      return;
    }
    setOpen(false);
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[10px] font-bold text-gold-300"><HelpCircle size={12} /> How this project works</button>
      {open && (
        <div className="fixed inset-0 z-[95] overflow-y-auto bg-black/85 p-4">
          <div className="mx-auto max-w-2xl rounded-2xl border border-gold-500/25 bg-charcoal-950 p-6">
            <div className="flex justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-400">Protected project guide</p><h2 className="mt-2 font-display text-3xl font-bold text-white">{role === 'creator' ? 'How you get approved and paid' : 'How your project stays protected'}</h2></div><button onClick={() => setOpen(false)} aria-label="Close"><X className="text-charcoal-300" /></button></div>
            <div className="mt-6 space-y-4">{STEPS.map(([n,title,body])=><div key={n} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-charcoal-950">{n}</span><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-charcoal-300">{body}</p></div></div>)}</div>
            <p className="mt-6 rounded-lg border border-white/10 p-3 text-[10px] leading-4 text-charcoal-400">Opening or acknowledging this guide is educational only. It is not a legal signature, recording consent, or biometric consent.</p>
            {error && <p role="alert" className="mt-4 text-xs text-red-300">{error}</p>}
            <button onClick={acknowledge} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 py-3 text-xs font-bold text-charcoal-950 disabled:opacity-60"><Check size={14} /> {saving ? 'Saving…' : 'I understand the project flow'}</button>
          </div>
        </div>
      )}
    </>
  );
}
