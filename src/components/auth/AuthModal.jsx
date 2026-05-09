import { useState } from 'react';
import { X, Mail, Lock, User, Building2, Users, Eye, EyeOff, Chrome, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';
import { TurnstileWidget, turnstileConfigured } from '../TurnstileWidget.jsx';

export function AuthModal({ dark, onClose, defaultTab = 'login', defaultRole = 'client', onOpenTerms, onOpenCreatorRegistration }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [tab, setTab]           = useState(defaultTab); // 'login' | 'signup'
  const [role, setRole]         = useState(defaultRole); // 'creator' | 'client'
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ fullName: '', email: '', password: '', phone: '', tosAccepted: false, _hp: '' });
  const [turnstileToken, setTurnstileToken] = useState('');
  // SMS verification state (creator signup only, when Supabase configured)
  const [smsStep, setSmsStep]   = useState(false); // true = show code entry
  const [smsCode, setSmsCode]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = `w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${
    dark
      ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20'
      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  /** Check for duplicate phone in localStorage (demo mode) */
  function phoneAlreadyUsed(phone) {
    try {
      const profiles = JSON.parse(localStorage.getItem('creator-profiles') || '[]');
      return profiles.some(p => p.phone === phone);
    } catch { return false; }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (tab === 'signup') {
      // Honeypot check: real users never fill this field
      if (form._hp) { setLoading(false); return; }
      // Turnstile check
      if (turnstileConfigured() && !turnstileToken) {
        setError('Please complete the security check.');
        setLoading(false);
        return;
      }
      if (!form.tosAccepted) { setError('You must agree to the Terms of Service to create an account.'); setLoading(false); return; }

      // Creator phone verification
      if (role === 'creator' && form.phone) {
        if (!supabaseConfigured) {
          // Demo mode: check for duplicate phone locally
          if (phoneAlreadyUsed(form.phone)) {
            setError('This phone number is already linked to a CreatorBridge account. Each creator can only have one account.');
            setLoading(false);
            return;
          }
          // Store phone in local profile and proceed
          try {
            const profiles = JSON.parse(localStorage.getItem('creator-profiles') || '[]');
            profiles.push({ phone: form.phone, email: form.email });
            localStorage.setItem('creator-profiles', JSON.stringify(profiles));
          } catch {}
        } else {
          // Supabase mode: send OTP
          const { error: otpErr } = await supabase.auth.signInWithOtp({ phone: form.phone });
          if (otpErr) {
            if (otpErr.message?.toLowerCase().includes('already')) {
              setError('This phone number is already linked to a CreatorBridge account. Each creator can only have one account.');
            } else {
              setError(otpErr.message || 'Failed to send verification code.');
            }
            setLoading(false);
            return;
          }
          setSmsStep(true);
          setLoading(false);
          return; // wait for user to enter code
        }
      }

      if (!supabaseConfigured) {
        setError('Supabase is not configured yet. Please add your credentials to .env');
        setLoading(false);
        return;
      }

      const { error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName, role });
      if (error) setError(error.message);
      else { onClose?.(); }
    } else {
      if (!supabaseConfigured) {
        setError('Supabase is not configured yet. Please add your credentials to .env');
        setLoading(false);
        return;
      }
      const { error } = await signIn({ email: form.email, password: form.password });
      if (error) setError(error.message);
      else { onClose?.(); }
    }
    setLoading(false);
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: verifyErr } = await supabase.auth.verifyOtp({ phone: form.phone, token: smsCode, type: 'sms' });
    if (verifyErr) {
      setError(verifyErr.message || 'Invalid code. Please try again.');
      setLoading(false);
      return;
    }
    // Phone verified, now create account
    const { error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName, role });
    if (error) setError(error.message);
    else { onClose?.(); }
    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    if (!supabaseConfigured) { setError('Supabase not configured.'); return; }
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-[28px] border shadow-2xl overflow-hidden ${
        dark ? 'bg-charcoal-950/92 border-white/[0.08]' : 'bg-white border-gray-200'
      }`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
        {/* Close */}
        <button type="button" onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>

        <div className="p-6">
          {/* Logo */}
          <div className="text-center mb-6">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-gold-500/24 bg-gold-500/10 text-2xl shadow-[0_0_24px_rgba(212,169,65,0.12)]">🎬</span>
            <p className="text-gold-400 mt-4 mb-2" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Account Access
            </p>
            <h2 className={`font-display font-bold text-2xl mt-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Creator<span className="text-gradient-gold">Bridge</span>
            </h2>
          </div>

          {/* Tab switcher */}
          <div className={`flex rounded-xl border overflow-hidden mb-5 ${dark ? 'border-white/[0.07]' : 'border-gray-200'}`}>
            {[['login','Sign In'],['signup','Create Account']].map(([t, label]) => (
              <button key={t} type="button" onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                  tab === t ? 'bg-gold-500 text-charcoal-900' : dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}>{label}</button>
            ))}
          </div>

          {/* Role selector (signup only) */}
          {tab === 'signup' && (
            <div className="mb-4">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] mb-2 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>I am a...</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'client',  icon: Users,     label: 'Client', sub: 'Looking to hire' },
                  { id: 'creator', icon: Building2, label: 'Creator', sub: 'Offering services' },
                ].map(({ id, icon: Icon, label, sub }) => (
                  <button key={id} type="button" onClick={() => setRole(id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      role === id
                        ? 'border-gold-500 bg-gold-500/10'
                        : dark ? 'border-white/[0.07] bg-white/[0.025] hover:border-gold-500/35' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <Icon size={20} className={role === id ? 'text-gold-400' : dark ? 'text-charcoal-300' : 'text-gray-400'} />
                    <span className={`text-xs font-bold ${role === id ? 'text-gold-400' : dark ? 'text-white' : 'text-gray-900'}`}>{label}</span>
                    <span className={`text-[10px] ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Creator signup — redirect to full 5-step registration form */}
          {tab === 'signup' && role === 'creator' ? (
            <div className="space-y-4 py-2">
              <div className={`rounded-2xl border p-5 text-center ${dark ? 'border-gold-500/30 bg-gold-500/10' : 'border-gold-200 bg-gold-50'}`}>
                <div className="text-2xl mb-3">🎬</div>
                <p className={`text-sm font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
                  To join as a creator, please use our full application form.
                </p>
                <p className={`text-xs mb-4 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                  Creator registration requires a 5-step application to verify your experience and credentials.
                </p>
                <button type="button"
                  onClick={() => { onOpenCreatorRegistration?.(); onClose?.(); }}
                  className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all">
                  Open Creator Application
                </button>
              </div>
            </div>
          ) : (
          <>
          {/* SMS code entry screen */}
          {smsStep ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-2">
                <div className="text-2xl mb-2">📱</div>
                <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>Check your phone</p>
                <p className={`text-xs mt-1 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                  We sent a 6-digit code to {form.phone}
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={smsCode}
                onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} text-center text-xl tracking-widest`}
                required
                autoFocus
              />
              {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={loading || smsCode.length !== 6}
                className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-50 transition-all">
                {loading ? 'Verifying...' : 'Verify and Create Account'}
              </button>
              <button type="button" onClick={() => { setSmsStep(false); setError(''); setSmsCode(''); }}
                className={`w-full py-2 text-xs ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'} transition-colors`}>
                Back
              </button>
            </form>
          ) : (
          <>
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Honeypot field — hidden from real users, bots will fill this */}
            <input
              type="text"
              name="website_url"
              value={form._hp}
              onChange={e => set('_hp', e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
            />
            {tab === 'signup' && (
              <div className="relative">
                <User size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                <input type="text" placeholder="Full Name" required value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  className={`${inputCls} pl-10`} />
              </div>
            )}

            <div className="relative">
              <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
              <input type="email" placeholder="Email address" required value={form.email}
                onChange={e => set('email', e.target.value)}
                className={`${inputCls} pl-10`} />
            </div>

            <div className="relative">
              <Lock size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
              <input type={showPass ? 'text' : 'password'} placeholder="Password" required
                minLength={6} value={form.password}
                onChange={e => set('password', e.target.value)}
                className={`${inputCls} pl-10 pr-10`} />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Phone number for creator signup */}
            {tab === 'signup' && role === 'creator' && (
              <div className="relative">
                <Phone size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                <input type="tel" placeholder="Phone number (e.g. +1 555 000 0000)"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  className={`${inputCls} pl-10`} />
                <p className={`text-[10px] mt-1 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
                  Required for identity verification. One account per phone number.
                </p>
              </div>
            )}

            {tab === 'signup' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.tosAccepted}
                  onChange={e => set('tosAccepted', e.target.checked)}
                  className="mt-0.5 accent-gold-500 shrink-0"
                />
                <span className={`text-[11px] leading-snug ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                  I agree to the{' '}
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onOpenTerms?.(); }}
                    className="text-gold-400 hover:text-gold-300 underline font-medium">
                    Terms of Service
                  </button>{' '}
                  and Platform Policies
                </span>
              </label>
            )}

            {tab === 'signup' && (
              <TurnstileWidget
                dark={dark}
                onVerify={token => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
              />
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading || (tab === 'signup' && !form.tosAccepted)}
              className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-50 transition-all">
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : `Create ${role === 'creator' ? 'Creator' : 'Client'} Account`}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className={`flex-1 h-px ${dark ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
            <span className={`text-[10px] ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>or</span>
            <div className={`flex-1 h-px ${dark ? 'bg-white/[0.07]' : 'bg-gray-200'}`} />
          </div>

          <button type="button" onClick={handleGoogle}
            className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
              dark ? 'border-white/[0.09] text-charcoal-200 hover:border-gold-500/35 hover:text-white hover:bg-white/[0.025]' : 'border-gray-200 text-gray-600 hover:text-gray-900'
            }`}>
            <Chrome size={14} /> Continue with Google
          </button>

          <p className={`text-center text-[10px] mt-4 ${dark ? 'text-charcoal-600' : 'text-gray-400'}`}>
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-gold-400 hover:text-gold-300 font-medium">
              {tab === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
          </>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
