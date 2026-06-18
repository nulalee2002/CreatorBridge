import { useState } from 'react';
import { X, Mail, Lock, User, Building2, Users, Eye, EyeOff, Chrome, Phone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { supabase, supabaseConfigured } from '../../lib/supabase.js';
import { TurnstileWidget, turnstileConfigured } from '../TurnstileWidget.jsx';
import { BrandMark } from '../BrandLogo.jsx';
import { sendNotificationEmail } from '../../lib/notifications.js';

export function AuthModal({ dark, onClose, defaultTab = 'login', defaultRole = 'client', onOpenTerms, onOpenCreatorRegistration }) {
  const { signIn, signUp, signInWithGoogle, profile: authProfile } = useAuth();
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
  // Forgot password state
  const [forgotMode, setForgotMode]     = useState(false);
  const [forgotEmail, setForgotEmail]   = useState('');
  const [forgotSent, setForgotSent]     = useState(false);
  // TOS Gate state
  const [showTosGate, setShowTosGate]   = useState(false);
  const [gateUser, setGateUser]         = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /** Basic email format + common typo domain check */
  const TYPO_DOMAINS = ['gamil.com','gmai.com','gmial.com','gnail.com','yaho.com','yahooo.com','hotmial.com','hotmai.com','outlok.com','outloook.com','iclod.com'];
  function isValidEmail(email) {
    const basic = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!basic) return { ok: false, msg: 'Please enter a valid email address.' };
    const domain = email.split('@')[1]?.toLowerCase();
    if (TYPO_DOMAINS.includes(domain)) return { ok: false, msg: `"${domain}" looks like a typo. Please double-check your email.` };
    return { ok: true };
  }

  const inputCls = `w-full px-4 py-3 text-base md:text-sm rounded-xl border outline-none transition-all ${
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

    // Email format check — runs before any Supabase call on both signup and login
    const emailCheck = isValidEmail(form.email);
    if (!emailCheck.ok) { setError(emailCheck.msg); setLoading(false); return; }

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

      const { data: signUpData, error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName, role, captchaToken: turnstileToken });
      if (error) setError(error.message);
      else {
        const createdUser = signUpData?.user;
        const session = signUpData?.session;
        if (createdUser && session) {
          setGateUser(createdUser);
          setShowTosGate(true);
        } else {
          onClose?.();
        }
      }
    } else {
      if (!supabaseConfigured) {
        setError('Supabase is not configured yet. Please add your credentials to .env');
        setLoading(false);
        return;
      }
      const { data: signInData, error } = await signIn({ email: form.email, password: form.password });
      if (error) setError(error.message);
      else {
        const loggedInUser = signInData?.user;
        if (loggedInUser) {
          const { data: acceptance, error: fetchErr } = await supabase
            .from('legal_acceptances')
            .select('*')
            .eq('user_id', loggedInUser.id)
            .eq('document_type', 'terms_of_service')
            .eq('document_version', '1.0')
            .maybeSingle();

          if (fetchErr) {
            console.error('Error checking terms acceptance:', fetchErr);
            onClose?.();
          } else if (!acceptance) {
            setGateUser(loggedInUser);
            setShowTosGate(true);
          } else {
            onClose?.();
          }
        } else {
          onClose?.();
        }
      }
    }
    setLoading(false);
  }

  async function recordTosAcceptance(user) {
    if (!user) return;
    setLoading(true);
    try {
      const { error: insertErr } = await supabase
        .from('legal_acceptances')
        .insert({
          user_id: user.id,
          document_type: 'terms_of_service',
          document_version: '1.0'
        });
      if (insertErr) {
        setError(insertErr.message || 'Failed to record terms acceptance.');
        setLoading(false);
        return;
      }
      const acceptedRole = authProfile?.role
        || (await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()
        ).data?.role
        || user.user_metadata?.role
        || role;

      // Trigger client welcome email only for confirmed client accounts.
      if (acceptedRole === 'client') {
        sendNotificationEmail(user.email, 'welcome_client', {
          client_name: form.fullName || user.user_metadata?.full_name || 'Client'
        });
      }
    } catch (e) {
      setError(e.message || 'Error recording terms acceptance.');
      setLoading(false);
      return;
    }
    setLoading(false);
    onClose?.();
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
    const { data: signUpData, error } = await signUp({ email: form.email, password: form.password, fullName: form.fullName, role, captchaToken: turnstileToken });
    if (error) setError(error.message);
    else {
      const createdUser = signUpData?.user;
      const session = signUpData?.session;
      if (createdUser && session) {
        setGateUser(createdUser);
        setShowTosGate(true);
      } else {
        onClose?.();
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    if (!supabaseConfigured) { setError('Supabase not configured.'); return; }
    const { error } = await signInWithGoogle();
    if (error) setError(error.message);
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const emailCheck = isValidEmail(forgotEmail);
    if (!emailCheck.ok) { setError(emailCheck.msg); setLoading(false); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setForgotSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="cb-modal-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-[28px] border shadow-2xl overflow-hidden ${
        dark ? 'bg-charcoal-950 border-white/[0.08]' : 'bg-white border-gray-200'
      }`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
        {/* Close */}
        <button type="button" onClick={onClose} aria-label="Close account access"
          className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.04]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
          <X size={16} />
        </button>

        <div className="p-6">
          {showTosGate ? (
            <div className="space-y-4 py-4 text-center">
              <div className="text-4xl mb-3">⚖️</div>
              <h3 className={`font-display font-bold text-xl ${dark ? 'text-white' : 'text-gray-900'}`}>
                Review & Accept Terms
              </h3>
              <p className={`text-xs leading-relaxed max-w-sm mx-auto ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                Before you can proceed to the platform, you must read and agree to our Terms of Service, Creator Agreement, and Dispute Policy.
              </p>
              
              <div className="flex flex-col gap-2.5 py-4 my-2 border-y border-white/[0.07]">
                <a href="/terms-of-service" target="_blank" rel="noreferrer"
                  className="text-xs text-gold-400 hover:text-gold-300 underline font-medium inline-flex items-center justify-center gap-1.5">
                  Read Terms of Service
                </a>
                <a href="/creator-agreement" target="_blank" rel="noreferrer"
                  className="text-xs text-gold-400 hover:text-gold-300 underline font-medium inline-flex items-center justify-center gap-1.5">
                  Read Creator Agreement
                </a>
                <a href="/dispute-policy" target="_blank" rel="noreferrer"
                  className="text-xs text-gold-400 hover:text-gold-300 underline font-medium inline-flex items-center justify-center gap-1.5">
                  Read Dispute Policy
                </a>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={onClose}
                  className={`flex-1 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    dark ? 'border-white/[0.09] text-charcoal-200 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}>
                  Cancel
                </button>
                <button type="button" onClick={() => recordTosAcceptance(gateUser)} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all disabled:opacity-50">
                  {loading ? 'Processing...' : 'I Agree & Accept'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Logo */}
              <div className="text-center mb-6">
                <BrandMark className="mx-auto h-16 w-16 rounded-2xl shadow-[0_0_24px_rgba(212,169,65,0.14)]" />
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
                  {/* Forgot password screen */}
                  {forgotMode ? (
                    <div className="space-y-4 py-2">
                      {forgotSent ? (
                        <div className="text-center py-4">
                          <div className="text-3xl mb-3">📬</div>
                          <p className={`text-sm font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Check your inbox</p>
                          <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                            We sent a password reset link to <span className="text-gold-400">{forgotEmail}</span>.
                          </p>
                          <button type="button" onClick={() => { setForgotMode(false); setForgotSent(false); setError(''); }}
                            className="mt-5 text-xs text-gold-400 hover:text-gold-300 transition-colors">
                            Back to sign in
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-3">
                          <p className={`text-xs mb-1 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                            Enter your email and we'll send you a reset link.
                          </p>
                          <div className="relative">
                            <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                            <input type="email" placeholder="Email address" required value={forgotEmail}
                              autoComplete="email"
                              onChange={e => setForgotEmail(e.target.value)}
                              className={`${inputCls} pl-10`} autoFocus />
                          </div>
                          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
                          <button type="submit" disabled={loading}
                            className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-50 transition-all">
                            {loading ? 'Sending...' : 'Send Reset Link'}
                          </button>
                          <button type="button" onClick={() => { setForgotMode(false); setError(''); }}
                            className={`w-full py-2 text-xs ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'} transition-colors`}>
                            Back to sign in
                          </button>
                        </form>
                      )}
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
                                  autoComplete="name"
                                  onChange={e => set('fullName', e.target.value)}
                                  className={`${inputCls} pl-10`} />
                              </div>
                            )}

                            <div className="relative">
                              <Mail size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                              <input type="email" placeholder="Email address" required value={form.email}
                                autoComplete="email"
                                onChange={e => set('email', e.target.value)}
                                className={`${inputCls} pl-10`} />
                            </div>

                            <div className="relative">
                              <Lock size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                              <input type={showPass ? 'text' : 'password'} placeholder="Password" required
                                minLength={10} title="Password must be at least 10 characters." value={form.password}
                                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                                onChange={e => set('password', e.target.value)}
                                className={`${inputCls} pl-10 pr-10`} />
                              <button type="button" onClick={() => setShowPass(s => !s)}
                                aria-label={showPass ? 'Hide password' : 'Show password'}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>

                            {/* Forgot password link — login tab only */}
                            {tab === 'login' && (
                              <div className="text-right -mt-1">
                                <button type="button" onClick={() => { setForgotMode(true); setError(''); setForgotEmail(form.email); }}
                                  className={`text-[11px] ${dark ? 'text-charcoal-300 hover:text-gold-400' : 'text-gray-400 hover:text-gold-500'} transition-colors`}>
                                  Forgot password?
                                </button>
                              </div>
                            )}

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
                                  className="mt-0.5 h-5 w-5 accent-gold-500 shrink-0"
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
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
