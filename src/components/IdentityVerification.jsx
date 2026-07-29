import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Clock3, Loader2, ScanFace, ShieldAlert } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { useTrustStatus } from '../hooks/useTrustStatus.js';
import { IdentityConsent } from './IdentityConsent.jsx';

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

export function IdentityVerification({
  dark = true,
  purpose,
  unlockCopy,
  compact = false,
  onStatusChange,
  onBeforeRedirect,
}) {
  const { trust, loading, error: loadError, refresh } = useTrustStatus();
  const [showConsent, setShowConsent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const onStatusChangeRef = useRef(onStatusChange);
  const onBeforeRedirectRef = useRef(onBeforeRedirect);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onBeforeRedirectRef.current = onBeforeRedirect;
  }, [onStatusChange, onBeforeRedirect]);

  useEffect(() => {
    if (!loading) onStatusChangeRef.current?.({ loaded: true, ...trust });
  }, [loading, trust]);

  async function startVerification({ consentVersion }) {
    if (!supabaseConfigured) {
      setError('Identity verification requires the live CreatorBridge backend.');
      return;
    }
    setStarting(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('create-identity-session', {
      body: {
        purpose,
        consentVersion,
        consented: true,
      },
    });
    if (invokeError || data?.error) {
      setError(await functionErrorMessage(invokeError, data?.error || 'Identity verification could not be started.'));
      setStarting(false);
      return;
    }
    if (data?.alreadyVerified) {
      await refresh();
      setShowConsent(false);
      setStarting(false);
      return;
    }
    if (data?.url) {
      onBeforeRedirectRef.current?.();
      window.location.assign(data.url);
      return;
    }
    await refresh();
    setStarting(false);
  }

  const shell = compact
    ? ''
    : `rounded-2xl border p-4 ${dark ? 'border-white/[0.08] bg-charcoal-950/45' : 'border-gray-200 bg-gray-50'}`;

  if (loading) {
    return <div className={`${shell} flex items-center gap-2 text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}><Loader2 size={14} className="animate-spin" /> Checking identity verification...</div>;
  }

  if (trust.identityVerified) {
    return (
      <div className={`${shell} flex items-start gap-2`}>
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500/20"><Check size={12} className="text-gold-400" /></span>
        <div>
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Identity verified</p>
          <p className={`mt-1 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>Your verified identity can be reused for future protected projects unless a defined security trigger requires another check.</p>
        </div>
      </div>
    );
  }

  if (showConsent) {
    return <IdentityConsent dark={dark} busy={starting} onContinue={startVerification} onCancel={() => !starting && setShowConsent(false)} />;
  }

  const reviewState = ['manual_review', 'duplicate_restricted', 'rejected', 'reverification_required'].includes(trust.identityStatus);
  const pending = trust.identityStatus === 'pending';
  const retry = trust.identityStatus === 'retry_required' && trust.retryAllowed;
  const Icon = reviewState ? ShieldAlert : pending ? Clock3 : ScanFace;
  const heading = reviewState
    ? 'Identity review required'
    : pending
      ? 'Identity check processing'
      : retry
        ? 'Secure retry available'
        : 'Verify your identity';

  return (
    <div className={shell}>
      <div className="flex items-start gap-3">
        <Icon size={18} className={`mt-0.5 shrink-0 ${reviewState ? 'text-red-400' : 'text-gold-400'}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{heading}</p>
          <p className={`mt-1 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
            {trust.reviewMessage || (pending
              ? 'Stripe is processing the secure check. Refresh this status after it finishes.'
              : unlockCopy || 'Complete identity verification to unlock this protected action.')}
          </p>
        </div>
      </div>

      {!reviewState && !pending && (
        <button type="button" onClick={() => setShowConsent(true)} className="mt-4 w-full rounded-xl bg-gold-500 py-2.5 text-sm font-bold text-charcoal-950 transition hover:bg-gold-600">
          {retry ? 'Review notice and try again' : 'Review identity notice'}
        </button>
      )}
      {pending && (
        <button type="button" onClick={() => void refresh()} className={`mt-4 w-full rounded-xl border py-2.5 text-sm font-semibold ${
          dark ? 'border-gold-500/30 text-gold-300 hover:bg-gold-500/10' : 'border-gold-300 text-gold-700 hover:bg-gold-50'
        }`}>
          Refresh status
        </button>
      )}
      {(error || loadError) && <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400"><AlertCircle size={13} className="mt-0.5 shrink-0" /> {error || loadError}</div>}
    </div>
  );
}
