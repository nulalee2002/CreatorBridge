import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Smartphone } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';

export function PhoneVerification({
  dark = true,
  purpose = 'account',
  initialPhone = '',
  unlockCopy = 'Verify a phone number to continue.',
  onVerified,
  onStatusChange,
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [verified, setVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState(null);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const onStatusChangeRef = useRef(onStatusChange);
  const onVerifiedRef = useRef(onVerified);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onVerifiedRef.current = onVerified;
  }, [onStatusChange, onVerified]);

  const reportStatus = useCallback((next) => {
    onStatusChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadStatus() {
      if (!supabaseConfigured) {
        if (active) {
          setLoading(false);
          reportStatus({ loaded: true, verified: false, phone: initialPhone, verifiedAt: null });
        }
        return;
      }

      const { data: trust } = await supabase.rpc('get_my_trust_status');
      if (!active) return;
      const row = Array.isArray(trust) ? trust[0] : trust;
      const isVerified = row?.phone_verified === true;
      const currentPhone = row?.phone_e164 || initialPhone || '';
      const currentVerifiedAt = row?.phone_verified_at || null;
      setPhone(currentPhone);
      setVerified(isVerified);
      setVerifiedAt(currentVerifiedAt);
      setLoading(false);
      reportStatus({
        loaded: true,
        verified: isVerified,
        phone: currentPhone,
        verifiedAt: currentVerifiedAt,
      });
    }
    void loadStatus();
    return () => { active = false; };
  }, [initialPhone, reportStatus]);

  async function sendCode() {
    setError('');
    setMessage('');
    if (!phone.trim()) {
      setError('Enter a phone number before requesting a code.');
      return;
    }
    if (!supabaseConfigured) {
      setError('Phone verification requires the live CreatorBridge backend.');
      return;
    }

    setSending(true);
    const { data, error: invokeError } = await supabase.functions.invoke('phone-send-code', {
      body: { phone, purpose },
    });
    setSending(false);
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Verification code could not be sent.');
      return;
    }

    const normalizedPhone = data?.phone || phone;
    setPhone(normalizedPhone);
    setVerified(false);
    setVerifiedAt(null);
    setCodeSent(true);
    setEditing(true);
    setMessage('Verification code sent. Enter it below to finish.');
    reportStatus({ loaded: true, verified: false, phone: normalizedPhone, verifiedAt: null });
  }

  async function checkCode() {
    setError('');
    setMessage('');
    if (!code.trim()) {
      setError('Enter the SMS verification code.');
      return;
    }

    setChecking(true);
    const { data, error: invokeError } = await supabase.functions.invoke('phone-check-code', {
      body: { phone, code, purpose },
    });
    setChecking(false);
    if (invokeError || data?.error || data?.phoneVerified !== true) {
      setError(data?.error || invokeError?.message || 'Verification code could not be confirmed.');
      return;
    }

    const nextPhone = data.phone || phone;
    const nextVerifiedAt = data.phoneVerifiedAt || new Date().toISOString();
    setPhone(nextPhone);
    setCode('');
    setCodeSent(false);
    setEditing(false);
    setVerified(true);
    setVerifiedAt(nextVerifiedAt);
    setMessage('Phone verified.');
    reportStatus({ loaded: true, verified: true, phone: nextPhone, verifiedAt: nextVerifiedAt });
    onVerifiedRef.current?.({ phone: nextPhone, verifiedAt: nextVerifiedAt });
  }

  const inputClass = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
    dark
      ? 'border-white/[0.09] bg-charcoal-950/70 text-white placeholder-charcoal-500 focus:border-gold-500'
      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;
  const secondaryButton = `w-full rounded-xl border py-2.5 text-sm font-bold transition-colors disabled:opacity-40 ${
    dark
      ? 'border-gold-500/35 text-gold-300 hover:bg-gold-500/10'
      : 'border-gold-300 text-gold-700 hover:bg-gold-100'
  }`;

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>
        <Loader2 size={14} className="animate-spin" /> Checking phone verification...
      </div>
    );
  }

  if (verified && !editing) {
    return (
      <div className={`rounded-xl border p-3 ${dark ? 'border-gold-500/25 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-500/20">
            <Check size={12} className="text-gold-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Phone verified</p>
            <p className={`mt-0.5 text-xs ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{phone}</p>
            {verifiedAt && (
              <p className={`mt-1 text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
                Verified {new Date(verifiedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-gold-400 hover:text-gold-300"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${dark ? 'border-white/[0.08] bg-charcoal-950/45' : 'border-gray-200 bg-gray-50'}`}>
      <div className="mb-3 flex items-start gap-2">
        <Smartphone size={16} className="mt-0.5 shrink-0 text-gold-400" />
        <div>
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Verify your phone</p>
          <p className={`mt-1 text-xs leading-5 ${dark ? 'text-charcoal-400' : 'text-gray-500'}`}>{unlockCopy}</p>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="tel"
          value={phone}
          onChange={event => setPhone(event.target.value)}
          placeholder="+1 (555) 000-0000"
          className={inputClass}
        />
        <button type="button" onClick={sendCode} disabled={sending || !phone.trim()} className={secondaryButton}>
          {sending
            ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Sending code...</span>
            : codeSent ? 'Send a new code' : 'Send SMS code'}
        </button>

        {codeSent && (
          <>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="123456"
              className={inputClass}
            />
            <button
              type="button"
              onClick={checkCode}
              disabled={checking || !code.trim()}
              className="w-full rounded-xl bg-gold-500 py-2.5 text-sm font-bold text-charcoal-900 transition-colors hover:bg-gold-600 disabled:opacity-40"
            >
              {checking
                ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Verifying...</span>
                : 'Verify code'}
            </button>
          </>
        )}
      </div>

      {message && <p className="mt-2 rounded-lg bg-gold-400/10 px-3 py-2 text-xs text-gold-400">{message}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
