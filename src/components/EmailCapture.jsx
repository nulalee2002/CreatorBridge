import { useState } from 'react';
import { CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * EmailCapture — waitlist sign-up widget.
 *
 * Props:
 *   source   Row value for waitlist.source (default 'homepage')
 *   compact  Render a smaller inline version (true for footer use)
 *   dark     Theme flag passed from parent
 */
export function EmailCapture({ source = 'homepage', compact = false, dark = true }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [done,    setDone]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const { error: insertErr } = await supabase
      .from('waitlist')
      .insert({ email: trimmed, source });

    setLoading(false);

    if (insertErr) {
      // Unique-violation = already on the list — treat as success
      if (insertErr.code === '23505') {
        setDone(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
      return;
    }

    setDone(true);
  }

  /* ── Success state ── */
  if (done) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <CheckCircle size={compact ? 14 : 18} className="text-[#c9a84c] shrink-0" />
        <span className="text-[#c9a84c] font-semibold">You're on the list — we'll be in touch.</span>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-2 ${compact ? 'max-w-xs' : 'max-w-md'} w-full`}>
      {!compact && (
        <p className="text-[11px] tracking-widest uppercase text-[#6a6a72]">
          Stay in the loop
        </p>
      )}

      <div className={`flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1.5
        focus-within:border-[#c9a84c] focus-within:bg-white/[0.04] transition-all`}>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          placeholder={compact ? 'Your email' : 'Enter your email to join the waitlist'}
          aria-label="Email address"
          className={`flex-1 bg-transparent ${compact ? 'py-1.5 text-xs' : 'py-2.5 text-sm'} px-3 text-white placeholder-[#6a6a72] focus:outline-none`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`btn-gold flex items-center justify-center font-bold rounded-lg whitespace-nowrap
            ${compact ? 'text-[11px] px-3 py-1.5' : 'text-xs px-4'} disabled:opacity-60`}
        >
          {loading
            ? <Loader size={14} className="animate-spin" />
            : compact ? 'Join' : 'Join the Waitlist'}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 font-medium">{error}</p>
      )}
    </form>
  );
}
