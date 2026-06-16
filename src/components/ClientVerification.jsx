import { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { recentFilterCount } from '../utils/messageFilter.js';

// ── Spam scoring ────────────────────────────────────────────────
/**
 * Increment a client's spam score.
 * Call this when suspicious behavior is detected (e.g. too many quote requests, filter hits).
 */
export async function incrementSpamScore(userId, amount = 1) {
  try {
    if (supabaseConfigured && supabase) {
      await supabase.rpc('increment_spam_score', { uid: userId, amount });
    } else {
      const key = `cm-client-spam-${userId}`;
      const current = parseInt(localStorage.getItem(key) || '0', 10);
      const next = current + amount;
      localStorage.setItem(key, String(next));
      if (next >= 10) {
        // Flag for review
        const flags = JSON.parse(localStorage.getItem('cm-spam-flags') || '[]');
        if (!flags.includes(userId)) {
          flags.push({ userId, flaggedAt: new Date().toISOString(), score: next });
          localStorage.setItem('cm-spam-flags', JSON.stringify(flags));
        }
      }
    }
  } catch {}
}

/**
 * Check whether a client has triggered spam thresholds.
 * Returns { restricted: boolean, score: number }
 */
export function getSpamStatus(userId) {
  try {
    const key = `cm-client-spam-${userId}`;
    const score = parseInt(localStorage.getItem(key) || '0', 10);
    return { restricted: score >= 10, score };
  } catch { return { restricted: false, score: 0 }; }
}

/**
 * Check spam conditions and increment score as needed.
 * Call this after a quote request is sent.
 */
export async function checkQuoteSpam(userId) {
  try {
    const key = `cm-quote-times-${userId}`;
    const times = JSON.parse(localStorage.getItem(key) || '[]');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = times.filter(t => t > cutoff);
    recent.push(Date.now());
    localStorage.setItem(key, JSON.stringify(recent));
    // 5+ quote requests in 24h without booking = spam signal
    if (recent.length >= 5) {
      await incrementSpamScore(userId, 1);
    }
    // Filter hits also increment (checked separately via recentFilterCount)
    const filterHits = recentFilterCount(userId);
    if (filterHits >= 3) {
      await incrementSpamScore(userId, 1);
    }
  } catch {}
}

// ── Client Profile helpers ──────────────────────────────────────
function loadClientProfile(userId) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-client-profiles') || '[]');
    return all.find(p => p.userId === userId) || null;
  } catch { return null; }
}

function saveClientProfile(profile) {
  try {
    const all = JSON.parse(localStorage.getItem('cm-client-profiles') || '[]');
    const idx = all.findIndex(p => p.userId === profile.userId);
    if (idx !== -1) all[idx] = profile; else all.push(profile);
    localStorage.setItem('cm-client-profiles', JSON.stringify(all));
  } catch {}
}

// ── Main component ──────────────────────────────────────────────
/**
 * Client verification gate. Shows a step-by-step checklist and
 * blocks certain actions until requirements are met.
 *
 * Props:
 *   user         — auth user object
 *   dark         — boolean
 *   onComplete   — callback when basic verification is complete
 *   requireLevel — 'basic' (email+name+tos) | 'contact' (adds phone)
 */
export function ClientVerification({ user, dark, onComplete, requireLevel = 'basic' }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm]       = useState({ displayName: '', phone: '', tosAccepted: false });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [phoneMessage, setPhoneMessage] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const inputCls = `w-full px-3 py-2 text-sm rounded-xl border outline-none transition-all ${
    dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
         : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
    let p = null;
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      p = data;
    } else {
      p = loadClientProfile(user.id);
    }
    if (p) {
      setProfile(p);
      setForm({
        displayName: p.display_name || p.displayName || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        phone: p.phone || '',
        tosAccepted: !!(p.tos_accepted_at || p.tosAcceptedAt),
      });
    } else {
      setForm(f => ({
        ...f,
        displayName: f.displayName || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
      }));
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.tosAccepted) return;
    setSaving(true);
    setError('');

    const now = new Date().toISOString();
    const profileData = {
      userId: user.id,
      user_id: user.id,
      displayName: form.displayName,
      display_name: form.displayName,
      phone: form.phone,
      tosAcceptedAt: now,
      tos_accepted_at: now,
      emailVerified: !!user.email_confirmed_at,
      email_verified: !!user.email_confirmed_at,
      phoneVerified: !!(profile?.phone_verified || profile?.phoneVerified),
      phone_verified: !!(profile?.phone_verified || profile?.phoneVerified),
      phoneVerifiedAt: profile?.phone_verified_at || profile?.phoneVerifiedAt || null,
      phone_verified_at: profile?.phone_verified_at || profile?.phoneVerifiedAt || null,
      updatedAt: now,
      updated_at: now,
    };

    if (supabaseConfigured) {
      const { error: saveError } = await supabase.from('client_profiles').upsert({
        user_id: user.id,
        display_name: form.displayName,
        phone: form.phone || null,
        tos_accepted_at: now,
        email_verified: !!user.email_confirmed_at,
        updated_at: now,
      }, { onConflict: 'user_id' });
      if (saveError) {
        setError(saveError.message || 'Verification could not be saved.');
        setSaving(false);
        return;
      }
    } else {
      saveClientProfile(profileData);
    }

    setProfile(profileData);
    setSaved(true);
    setSaving(false);
    if (requireLevel !== 'contact' || profileData.phone_verified) onComplete?.();
  }

  async function sendPhoneCode() {
    setError('');
    setPhoneMessage('');
    if (!form.phone.trim()) {
      setError('Enter a phone number before requesting a code.');
      return;
    }
    if (!supabaseConfigured) {
      setError('Phone verification requires the live CreatorBridge backend.');
      return;
    }

    setSendingCode(true);
    const { data, error: invokeError } = await supabase.functions.invoke('client-phone-send-code', {
      body: { phone: form.phone },
    });
    setSendingCode(false);

    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Verification code could not be sent.');
      return;
    }

    setOtpSent(true);
    if (data?.phone) setForm(f => ({ ...f, phone: data.phone }));
    setPhoneMessage('Verification code sent. Enter it below to finish.');
    await loadProfile();
  }

  async function checkPhoneCode() {
    setError('');
    setPhoneMessage('');
    if (!otpCode.trim()) {
      setError('Enter the SMS verification code.');
      return;
    }
    if (!supabaseConfigured) {
      setError('Phone verification requires the live CreatorBridge backend.');
      return;
    }

    setCheckingCode(true);
    const { data, error: invokeError } = await supabase.functions.invoke('client-phone-check-code', {
      body: { phone: form.phone, code: otpCode },
    });
    setCheckingCode(false);

    if (invokeError || data?.error || !data?.phoneVerified) {
      setError(data?.error || invokeError?.message || 'Verification code could not be confirmed.');
      return;
    }

    const verifiedAt = new Date().toISOString();
    const nextProfile = {
      ...(profile || {}),
      user_id: user.id,
      userId: user.id,
      phone: data.phone || form.phone,
      phone_verified: true,
      phoneVerified: true,
      phone_verified_at: verifiedAt,
      phoneVerifiedAt: verifiedAt,
      display_name: profile?.display_name || form.displayName,
      displayName: profile?.displayName || form.displayName,
      tos_accepted_at: profile?.tos_accepted_at || (form.tosAccepted ? verifiedAt : null),
      tosAcceptedAt: profile?.tosAcceptedAt || (form.tosAccepted ? verifiedAt : null),
    };
    setProfile(nextProfile);
    setForm(f => ({ ...f, phone: data.phone || f.phone }));
    setOtpCode('');
    setOtpSent(false);
    setPhoneMessage('Phone verified. You can now post project briefs.');
    onComplete?.();
    await loadProfile();
  }

  // Check if already complete
  const emailOk = !!user?.email;
  const nameOk  = !!(profile?.display_name || profile?.displayName || form.displayName);
  const tosOk   = !!(profile?.tos_accepted_at || profile?.tosAcceptedAt);
  const phoneOk = !!(profile?.phone_verified || profile?.phoneVerified) && !!(profile?.phone_verified_at || profile?.phoneVerifiedAt);

  const basicComplete = emailOk && nameOk && tosOk;
  const contactComplete = basicComplete && phoneOk;
  const isComplete = requireLevel === 'contact' ? contactComplete : basicComplete;

  if (isComplete && !saved) {
    // Already verified — render nothing (or a small badge)
    return null;
  }

  function StepCheck({ done, label }) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          done ? 'bg-gold-500/20 ring-1 ring-gold-500/25' : dark ? 'bg-white/[0.08]' : 'bg-gray-200'
        }`}>
          {done ? <Check size={10} className="text-gold-400" /> : <X size={10} className={textSub} />}
        </div>
        <span className={`text-xs ${done ? (dark ? 'text-charcoal-300' : 'text-gray-600') : textSub}`}>{label}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-gold-500/25' : 'bg-gold-50 border-gold-200'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Account Verification Required</p>
      <p className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
        Complete your profile to send messages and book creators.
      </p>

      <div className="mb-4 space-y-2">
        <StepCheck done={emailOk} label={`Account email on file (${user?.email || ''})`} />
        <StepCheck done={nameOk} label="Display name set" />
        <StepCheck done={tosOk} label="Terms of Service accepted" />
        {requireLevel === 'contact' && (
          <StepCheck done={phoneOk} label="Phone verified by SMS" />
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {!nameOk && (
          <div>
            <label className={`text-xs font-medium mb-1 block ${textSub}`}>Display Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="Your name or company"
              className={inputCls}
              required
            />
          </div>
        )}

        {requireLevel === 'contact' && !phoneOk && (
          <div className="space-y-2">
            <label className={`text-xs font-medium mb-1 block ${textSub}`}>Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+1 (555) 000-0000"
              className={inputCls}
            />
            <button
              type="button"
              onClick={sendPhoneCode}
              disabled={sendingCode || !form.phone.trim()}
              className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-all ${
                dark
                  ? 'border-gold-500/35 text-gold-300 hover:bg-gold-500/10 disabled:opacity-40'
                  : 'border-gold-300 text-gold-700 hover:bg-gold-100 disabled:opacity-40'
              }`}
            >
              {sendingCode ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Sending code...</span> : 'Send SMS code'}
            </button>
            {otpSent && (
              <div className="space-y-2">
                <label className={`text-xs font-medium block ${textSub}`}>Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={checkPhoneCode}
                  disabled={checkingCode || !otpCode.trim()}
                  className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all"
                >
                  {checkingCode ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Verifying...</span> : 'Verify code'}
                </button>
              </div>
            )}
            {phoneMessage && <p className="text-xs text-gold-400 bg-gold-400/10 rounded-lg px-3 py-2">{phoneMessage}</p>}
          </div>
        )}

        {!tosOk && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tosAccepted}
              onChange={e => setForm(f => ({ ...f, tosAccepted: e.target.checked }))}
              className="mt-0.5 accent-gold-500"
            />
            <span className={`text-xs ${textSub}`}>
              I agree to the{' '}
              <a href="/terms" target="_blank" className="text-gold-400 hover:text-gold-300 underline">
                CreatorBridge Terms of Service
              </a>{' '}
              and Platform Policies.
            </span>
          </label>
        )}

        <button type="submit" disabled={saving || !form.tosAccepted || !form.displayName}
          className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-charcoal-900 text-sm font-bold transition-all">
          {saving ? 'Saving...' : requireLevel === 'contact' ? 'Save Profile Details' : 'Complete Verification'}
        </button>
        {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
      </form>

      {/* Insurance notice */}
      <div className={`mt-3 flex items-start gap-2 p-3 rounded-xl border ${dark ? 'border-gold-500/25 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
        <AlertCircle size={13} className="text-gold-400 shrink-0 mt-0.5" />
        <p className={`text-[11px] leading-relaxed ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
          CreatorBridge does not verify creator insurance. For on-site projects, confirm insurance coverage directly with your creator before booking.
        </p>
      </div>
    </div>
  );
}
