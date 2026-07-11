import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, FileSignature, Loader2, X } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { getStorageDisplayUrl } from '../utils/storage.js';
import { ContractView } from './ContractView.jsx';
import { SignaturePad } from './SignaturePad.jsx';

export const CONTRACT_CONSENT_TEXT = 'By signing, I agree this electronic signature is legally binding and I have authority to enter this agreement.';

async function functionErrorMessage(error, fallback) {
  const response = error?.context;
  if (response?.clone) {
    try {
      const payload = await response.clone().json();
      return payload?.error || payload?.message || fallback;
    } catch {}
  }
  return error?.message || fallback;
}

export function ContractSignModal({ open, contract: initialContract, userId, onClose, onSigned }) {
  const scrollRef = useRef(null);
  const [contract, setContract] = useState(initialContract);
  const [signatures, setSignatures] = useState([]);
  const [signatureUrls, setSignatureUrls] = useState({});
  const [savedSignatures, setSavedSignatures] = useState([]);
  const [legalName, setLegalName] = useState('');
  const [signatureValue, setSignatureValue] = useState(null);
  const [consented, setConsented] = useState(false);
  const [saveSignature, setSaveSignature] = useState(true);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const signerRole = useMemo(() => {
    if (!contract || !userId) return null;
    if (userId === contract.client_id) return 'client';
    if (userId === contract.creator_user_id) return 'creator';
    return null;
  }, [contract, userId]);
  const existingSignature = signatures.find(item => item.signer_role === signerRole);

  useEffect(() => setContract(initialContract), [initialContract]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !submitting) onClose?.();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open || !contract?.id || !supabaseConfigured) return;
    let active = true;
    async function loadSigningData() {
      setLoading(true);
      setError('');
      const [{ data: signatureRows, error: signatureError }, { data: savedRows, error: savedError }] = await Promise.all([
        supabase.from('contract_signatures').select('*').eq('contract_id', contract.id).order('signed_at'),
        supabase.from('saved_signatures').select('*').eq('user_id', userId).order('is_default', { ascending: false }),
      ]);
      if (!active) return;
      if (signatureError || savedError) {
        setError('Agreement signature details could not be loaded.');
        setLoading(false);
        return;
      }
      const nextSignatureUrls = {};
      await Promise.all((signatureRows || []).map(async signature => {
        if (signature.signature_image_ref) nextSignatureUrls[signature.id] = await getStorageDisplayUrl(signature.signature_image_ref);
      }));
      const nextSaved = await Promise.all((savedRows || []).map(async saved => ({
        ...saved,
        url: await getStorageDisplayUrl(saved.signature_image_ref),
      })));
      if (!active) return;
      setSignatures(signatureRows || []);
      setSignatureUrls(nextSignatureUrls);
      setSavedSignatures(nextSaved.filter(item => item.url));
      const partyName = signerRole === 'client'
        ? contract.terms?.parties?.client?.name
        : contract.terms?.parties?.creator?.name;
      setLegalName(partyName || '');
      setLoading(false);
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (node && node.scrollHeight <= node.clientHeight + 8) setReachedEnd(true);
      });
    }
    loadSigningData();
    return () => { active = false; };
  }, [open, contract?.id, contract?.terms, signerRole, userId]);

  async function downloadPdf() {
    if (!contract?.pdf_ref) return;
    setDownloading(true);
    setError('');
    const url = await getStorageDisplayUrl(contract.pdf_ref, 300);
    setDownloading(false);
    if (!url) return setError('The private PDF could not be opened.');
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function signAgreement() {
    if (!signerRole || !legalName.trim() || !consented || !signatureValue || !reachedEnd) return;
    setSubmitting(true);
    setError('');
    try {
      const { data, error: signError } = await supabase.functions.invoke('sign-contract', {
        body: {
          contractId: contract.id,
          signerName: legalName.trim(),
          method: signatureValue.method,
          signatureDataUrl: signatureValue.dataUrl || null,
          savedSignatureId: signatureValue.savedSignatureId || null,
          saveSignature: saveSignature && signatureValue.method !== 'saved',
          signedContentHash: contract.content_hash,
          consentText: CONTRACT_CONSENT_TEXT,
        },
      });
      if (signError) throw new Error(await functionErrorMessage(signError, 'Agreement could not be signed.'));
      setContract(data.contract);
      setSignatures(current => [...current.filter(item => item.signer_role !== signerRole), data.signature]);
      onSigned?.(data.contract, data.signature);
    } catch (signingError) {
      setError(signingError?.message || 'Agreement could not be signed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !contract) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/85 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close agreement" onClick={() => !submitting && onClose?.()} />
      <div className="relative flex h-[100dvh] w-full max-w-[1120px] flex-col overflow-hidden border border-[#c9a15e]/25 bg-[#0d0a08] shadow-[0_40px_140px_rgba(0,0,0,0.75)] sm:h-[94vh] sm:rounded-lg">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#c9a15e]/20 bg-[#120d08] px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#c9a15e]">Production agreement</p>
            <p className="truncate font-display text-lg font-semibold text-[#f3eadb]">{contract.terms?.project?.title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} title="Close" aria-label="Close agreement" className="flex h-10 w-10 shrink-0 items-center justify-center text-[#8a806e] transition hover:text-[#f3eadb] disabled:opacity-40"><X size={19} /></button>
        </header>

        <div
          ref={scrollRef}
          onScroll={event => {
            const node = event.currentTarget;
            if (node.scrollHeight - node.scrollTop - node.clientHeight < 80) setReachedEnd(true);
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="px-3 py-6 sm:px-7 sm:py-8">
            <ContractView contract={contract} signatures={signatures} signatureUrls={signatureUrls} onDownload={downloadPdf} downloading={downloading} />
          </div>

          <section className="mx-auto mb-8 w-[calc(100%-24px)] max-w-[920px] rounded-lg border border-[#c9a15e]/30 bg-[#151009] px-5 py-7 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:w-[calc(100%-56px)] sm:px-10 sm:py-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#c9a15e]">Execute the agreement</p>
            <h2 className="mt-4 font-display text-3xl font-semibold text-[#f3eadb] sm:text-5xl">{existingSignature ? 'Your signature is recorded' : 'Add your signature to book'}</h2>
            <p className="mt-3 text-sm leading-6 text-[#b3a892]">Sign with your finger on a touchscreen, your mouse on a computer, or reuse your saved signature.</p>

            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center text-[#c9a15e]"><Loader2 className="animate-spin" /></div>
            ) : existingSignature ? (
              <div className="mt-7 flex items-start gap-3 rounded-md border border-[#65b685]/35 bg-[#1f3a2e]/35 p-4 text-sm leading-6 text-[#dceade]">
                <Check className="mt-0.5 shrink-0 text-[#65b685]" size={18} />
                <div><strong>{existingSignature.signer_name}</strong> signed this exact document. The other party can sign in either order. Payment becomes available only after both signatures are complete.</div>
              </div>
            ) : (
              <div className="mt-7">
                {!reachedEnd && (
                  <div className="mb-5 flex items-start gap-3 rounded-md border border-[#c9a15e]/25 bg-[#c9a15e]/8 p-4 text-xs leading-5 text-[#b3a892]">
                    <FileSignature size={17} className="mt-0.5 shrink-0 text-[#c9a15e]" /> Review the complete agreement above. Signing unlocks after you reach the end.
                  </div>
                )}
                <SignaturePad legalName={legalName} savedSignatures={savedSignatures} value={signatureValue} onChange={setSignatureValue} />

                <label className="mt-7 block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[#b3a892]">Legal name</span>
                  <input value={legalName} maxLength={160} onChange={event => setLegalName(event.target.value)} className="h-14 w-full rounded-md border border-[#c9a15e]/45 bg-[#0d0906] px-4 font-display text-xl text-[#f3eadb] outline-none transition focus:border-[#c9a15e]" />
                </label>

                <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#b3a892]">
                  <input type="checkbox" checked={consented} onChange={event => setConsented(event.target.checked)} className="peer sr-only" />
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#c9a15e] text-[#c9a15e] peer-focus-visible:ring-2 peer-focus-visible:ring-[#c9a15e]">{consented && <Check size={16} />}</span>
                  <span>{CONTRACT_CONSENT_TEXT}</span>
                </label>

                {signatureValue?.method !== 'saved' && (
                  <label className="mt-4 flex cursor-pointer items-center gap-3 text-xs text-[#8a806e]">
                    <input type="checkbox" checked={saveSignature} onChange={event => setSaveSignature(event.target.checked)} className="h-4 w-4 accent-[#9c4a33]" /> Save this signature for next time
                  </label>
                )}

                {error && <div className="mt-5 flex items-start gap-2 rounded-md border border-[#9b2c30]/45 bg-[#5a1012]/35 p-3 text-xs leading-5 text-[#e4b8b8]"><AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}</div>}

                <button type="button" onClick={signAgreement} disabled={!reachedEnd || !legalName.trim() || !consented || !signatureValue || submitting} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-md border border-[#c97a55] bg-[#9c4a33] px-5 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_35px_rgba(156,74,51,0.32)] transition hover:bg-[#b85a3e] disabled:cursor-not-allowed disabled:opacity-35">
                  {submitting ? <Loader2 size={17} className="animate-spin" /> : <FileSignature size={17} />} Sign and seal
                </button>
              </div>
            )}

            <p className="mt-7 text-center text-[11px] leading-5 text-[#8a806e]">Each signature records the name, timestamp, IP, device, and hash of the exact document signed. This is a first-party electronic signature and requires entertainment-attorney review before production reliance.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
