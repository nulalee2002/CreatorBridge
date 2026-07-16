import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Mic, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { CALL_CONSENT_TEXT, CALL_RETENTION_TEXT } from '../../lib/callLegal.js';

async function functionError(error, fallback) {
  try {
    const payload = await error?.context?.clone?.().json();
    return payload?.error || fallback;
  } catch {
    return error?.message || fallback;
  }
}

// Pre-join recording consent. The Join button stays disabled until this party
// consents; the token is only issued by create-call-token once BOTH parties
// have consent rows. Declining cancels the call and routes to messaging.
export function CallConsent({ call, user, onJoined, onClose, onCallChanged }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [waitingForOther, setWaitingForOther] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // If this party already consented (for example rejoining), skip straight to
  // the waiting/join check.
  useEffect(() => {
    let active = true;
    supabase
      .from('call_consents')
      .select('user_id')
      .eq('call_id', call.id)
      .then(({ data }) => {
        if (active && (data || []).some(row => row.user_id === user?.id)) {
          setWaitingForOther(true);
          requestToken(false);
        }
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id, user?.id]);

  async function requestToken(withConsent) {
    setError('');
    const body = withConsent
      ? { callId: call.id, consent: { participantName: name.trim(), consentText: CALL_CONSENT_TEXT } }
      : { callId: call.id };
    const { data, error: fnError } = await supabase.functions.invoke('create-call-token', { body });
    if (fnError) {
      setError(await functionError(fnError, 'The call room could not be prepared.'));
      return null;
    }
    if (data?.token) {
      clearInterval(pollRef.current);
      onJoined?.(data);
      return data;
    }
    if (data?.waiting) {
      setWaitingForOther(true);
      if (!pollRef.current) {
        pollRef.current = setInterval(() => requestToken(false), 6000);
      }
    }
    return data;
  }

  async function agree() {
    if (!checked || name.trim().length < 2) {
      setError('Enter your name and check the consent box to continue.');
      return;
    }
    setBusy(true);
    await requestToken(true);
    setBusy(false);
  }

  async function decline() {
    setDeclining(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_project_call', {
        p_call_id: call.id,
        p_reason: 'Recording consent declined',
      });
      if (rpcError) throw rpcError;
      onCallChanged?.(data);
      onClose?.();
      navigate('/messages');
    } catch (err) {
      setError(err?.message || 'The call could not be cancelled. Please try again.');
      setDeclining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <div className="cb-modal-backdrop" />
      <div className="liquid-glass relative w-full max-w-lg rounded-t-2xl bg-charcoal-950/95 p-5 sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Mic size={16} className="text-gold-400" /> Recording consent
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-charcoal-300 hover:bg-white/[0.08] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl border border-gold-500/25 bg-gold-500/[0.07] p-4">
          <p className="text-xs leading-6 text-charcoal-100">{CALL_CONSENT_TEXT}</p>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-charcoal-300">{CALL_RETENTION_TEXT}</p>

        {waitingForOther ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-charcoal-900/72 p-4">
            <Loader2 size={16} className="animate-spin text-gold-400" />
            <div>
              <p className="text-xs font-bold text-white">Your consent is recorded.</p>
              <p className="text-[11px] leading-5 text-charcoal-300">
                Waiting for the other party to consent. The call starts as soon as both sides agree.
              </p>
            </div>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-charcoal-300">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Type your name"
              maxLength={160}
              className="mt-1 w-full rounded-lg border border-white/[0.09] bg-charcoal-900 px-3 py-2 text-sm text-white placeholder-charcoal-400 focus:border-gold-500/50 focus:outline-none"
            />
            <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-charcoal-200 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={event => setChecked(event.target.checked)}
                className="mt-0.5 accent-[#9C4A33]"
              />
              I have read the notice above and consent to this call being recorded and transcribed.
            </label>
          </>
        )}

        {error && <p className="mt-3 text-xs leading-5 text-red-300">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={decline} disabled={declining} className="btn-ghost flex-1">
            {declining ? <Loader2 size={14} className="animate-spin" /> : 'Decline and use messages'}
          </button>
          {!waitingForOther && (
            <button type="button" onClick={agree} disabled={busy || !checked || name.trim().length < 2} className="btn-gold flex-1">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <><ShieldCheck size={13} /> Agree and join</>}
            </button>
          )}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-charcoal-400">
          If either party declines, the call does not start and the conversation continues in messages.
        </p>
      </div>
    </div>
  );
}
