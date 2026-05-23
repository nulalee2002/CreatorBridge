import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { BrandMark } from '../components/BrandLogo.jsx';

export function ResetPasswordPage({ dark }) {
  const navigate = useNavigate();
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [done, setDone]               = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase embeds the recovery token in the URL hash.
  // Calling getSession() after onAuthStateChange fires with SIGNED_IN + recovery
  // gives us an active session we can use to updateUser.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });
    // Also check if session already exists (page reload case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setDone(true);
    setTimeout(() => navigate('/find'), 3000);
  }

  const inputCls = `w-full px-4 py-3 text-sm rounded-xl border outline-none transition-all ${
    dark
      ? 'bg-charcoal-950/75 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20'
      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
  }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-[28px] border shadow-2xl overflow-hidden ${
        dark ? 'bg-charcoal-950/92 border-white/[0.08]' : 'bg-white border-gray-200'
      }`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />

        <div className="p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <BrandMark className="mx-auto h-16 w-16 rounded-2xl shadow-[0_0_24px_rgba(212,169,65,0.14)]" />
            <p className="text-gold-400 mt-4 mb-2" style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Account Access
            </p>
            <h2 className={`font-display font-bold text-2xl mt-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
              Creator<span className="text-gradient-gold">Bridge</span>
            </h2>
          </div>

          {done ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle size={40} className="mx-auto text-gold-400" />
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Password updated</p>
              <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                You're all set. Redirecting you to the homepage now.
              </p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-4">
              <p className={`text-sm ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>Verifying your reset link...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className={`text-sm font-bold mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Set a new password</p>
                <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
                  Choose something strong. At least 6 characters.
                </p>
              </div>

              <div className="relative">
                <Lock size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="New password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputCls} pl-10 pr-10`}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? 'text-charcoal-300 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="relative">
                <Lock size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`} />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={`${inputCls} pl-10`}
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold disabled:opacity-50 transition-all">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
