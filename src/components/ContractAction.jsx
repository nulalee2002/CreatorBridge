import { useEffect, useState } from 'react';
import { AlertCircle, FileSignature, Loader2, ShieldCheck } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { ContractSignModal } from './ContractSignModal.jsx';

async function functionError(error, fallback) {
  try {
    const payload = await error?.context?.clone?.().json();
    return payload?.error || fallback;
  } catch {
    return error?.message || fallback;
  }
}

export function ContractAction({ projectId, userId, className = '', onContractChange }) {
  const [contract, setContract] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId || !userId || !supabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase
      .from('contracts')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setContract(data || null);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [projectId, userId]);

  async function openContract(event) {
    event?.stopPropagation?.();
    if (!contract) return;
    setError('');
    if (!contract.pdf_ref || contract.status === 'draft') {
      setPreparing(true);
      const { data, error: prepareError } = await supabase.functions.invoke('generate-contract', {
        body: { projectId, contractId: contract.id },
      });
      setPreparing(false);
      if (prepareError) {
        setError(await functionError(prepareError, 'Agreement preparation failed.'));
        return;
      }
      setContract(data.contract);
      onContractChange?.(data.contract);
    }
    setOpen(true);
  }

  if (loading) return <div className={`h-9 animate-pulse rounded-md bg-white/[0.04] ${className}`} />;
  if (!contract) return null;
  const complete = contract.status === 'countersigned';

  return (
    <div className={className} onClick={event => event.stopPropagation()}>
      <button type="button" onClick={openContract} disabled={preparing} className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold transition ${
        complete
          ? 'border-[#65b685]/35 bg-[#1f3a2e]/35 text-[#9fd3b1] hover:border-[#65b685]/60'
          : 'border-[#c9a15e]/35 bg-[#c9a15e]/10 text-[#d8b875] hover:border-[#c9a15e]/60'
      } disabled:opacity-45`}>
        {preparing ? <Loader2 size={14} className="animate-spin" /> : complete ? <ShieldCheck size={14} /> : <FileSignature size={14} />}
        {preparing ? 'Preparing agreement' : complete ? 'Agreement complete' : 'Review and sign agreement'}
      </button>
      {error && <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-[#d99a98]"><AlertCircle size={12} className="mt-0.5 shrink-0" /> {error}</p>}
      <ContractSignModal
        open={open}
        contract={contract}
        userId={userId}
        onClose={() => setOpen(false)}
        onSigned={updated => {
          setContract(updated);
          onContractChange?.(updated);
        }}
      />
    </div>
  );
}
