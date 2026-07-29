import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { SignaturePad } from '../SignaturePad.jsx';
import { supabase } from '../../lib/supabase.js';

const CONSENT = 'By signing, I agree this electronic signature is legally binding and approves only the changes written in this change order.';

export function ChangeOrderSignModal({ order, onClose, onSigned }) {
  const [name, setName] = useState('');
  const [signature, setSignature] = useState(null);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function sign() {
    setBusy(true); setError('');
    const { data, error: signError } = await supabase.functions.invoke('sign-change-order', { body: {
      changeOrderId: order.id, signerName: name.trim(), method: signature?.method,
      signatureDataUrl: signature?.dataUrl || null, savedSignatureId: signature?.savedSignatureId || null,
      signedContentHash: order.content_hash, consentText: CONSENT,
    } });
    if (signError) setError(signError.message || 'Signature could not be recorded.');
    else onSigned?.(data.changeOrder);
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/85 p-4">
      <div className="mx-auto max-w-3xl rounded-xl border border-gold-500/30 bg-charcoal-950 p-5">
        <div className="flex justify-between"><div><p className="text-sm font-bold text-white">Sign {order.document_number}</p><p className="text-xs text-charcoal-300">Only the written changes below amend the original agreement.</p></div><button onClick={onClose}><X className="text-charcoal-300" /></button></div>
        <div className="my-5 rounded-lg border border-white/10 bg-charcoal-900 p-4 text-xs text-charcoal-200">
          <p><strong>Reason:</strong> {order.reason}</p>
          <pre className="mt-3 whitespace-pre-wrap">{JSON.stringify(order.terms?.changes, null, 2)}</pre>
          <p className="mt-3 font-bold text-gold-300">Added price: ${(Number(order.price_delta_cents) / 100).toFixed(2)}</p>
        </div>
        <SignaturePad legalName={name} value={signature} onChange={setSignature} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your legal name" className="mt-4 w-full rounded-lg border border-white/10 bg-charcoal-900 px-3 py-3 text-sm text-white" />
        <label className="mt-4 flex gap-3 text-xs leading-5 text-charcoal-200"><input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} className="accent-gold-500" /><span>{CONSENT}</span></label>
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        <button onClick={sign} disabled={busy || !signature || !consented || name.trim().length < 2} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 py-3 text-xs font-bold text-charcoal-950 disabled:opacity-40">{busy ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Record signature</button>
      </div>
    </div>
  );
}
