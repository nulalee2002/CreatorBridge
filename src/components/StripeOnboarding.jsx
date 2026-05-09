import { useState, useEffect } from 'react';
import { CheckCircle, CreditCard, ExternalLink, AlertCircle, Loader } from 'lucide-react';
import { supabase, supabaseConfigured } from '../lib/supabase.js';
import { stripeConfigured } from '../lib/stripe.js';

/**
 * StripeOnboarding — shown on the Creator Dashboard.
 * When stripe_onboarded is false: shows "Connect with Stripe" CTA.
 * When stripe_onboarded is true:  shows "Payments Active" badge.
 */
export function StripeOnboarding({ creator, dark, onStatusChange }) {
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError]       = useState('');
  const [status, setStatus]     = useState({
    connected:        !!creator?.stripe_onboarded,
    chargesEnabled:   !!creator?.payouts_enabled,
    payoutsEnabled:   !!creator?.payouts_enabled,
    detailsSubmitted: !!creator?.stripe_onboarded,
  });

  const cardCls = `rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  // On mount, if creator has a stripe_account_id but not yet marked onboarded, re-check
  useEffect(() => {
    if (creator?.stripe_account_id && !creator?.stripe_onboarded && supabaseConfigured) {
      checkStatus(creator.stripe_account_id);
    }
  }, [creator?.stripe_account_id]);

  async function checkStatus(accountId) {
    setChecking(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('check-connect-status', {
        body: { stripeAccountId: accountId, listingId: creator.id },
      });
      if (fnErr) throw fnErr;
      setStatus(data);
      if (data.connected && data.chargesEnabled) {
        onStatusChange?.({ stripe_onboarded: true, payouts_enabled: data.payoutsEnabled });
      }
    } catch (e) {
      // silently fail — status stays as-is
    } finally {
      setChecking(false);
    }
  }

  async function checkStripeUniqueness(stripeAccountId) {
    if (!stripeAccountId) return true;
    // Check localStorage for duplicate stripe_account_id on a different listing
    try {
      const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
      const conflict = all.find(c => c.stripe_account_id === stripeAccountId && c.id !== creator.id);
      if (conflict) {
        setError('This payment account is already connected to another CreatorBridge profile. Each creator can only have one active profile.');
        return false;
      }
    } catch {}
    // Check Supabase if configured
    if (supabaseConfigured) {
      const { data } = await supabase
        .from('creator_listings')
        .select('id')
        .eq('stripe_account_id', stripeAccountId)
        .neq('id', creator.id)
        .limit(1);
      if (data?.length > 0) {
        setError('This payment account is already connected to another CreatorBridge profile. Each creator can only have one active profile.');
        return false;
      }
    }
    return true;
  }

  async function handleConnect() {
    if (!supabaseConfigured || !stripeConfigured) {
      setError('Payment system not configured. Add your Stripe and Supabase keys to .env');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('create-connect-account', {
        body: {
          userId:    creator.user_id,
          email:     creator.email || creator.contact?.email,
          listingId: creator.id,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.stripeAccountId) {
        const isUnique = await checkStripeUniqueness(data.stripeAccountId);
        if (!isUnique) { setLoading(false); return; }
      }
      if (data?.url) {
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      }
    } catch (e) {
      setError(e.message || 'Could not start Stripe onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Already fully onboarded
  if (status.connected && status.chargesEnabled) {
    return (
      <div className={`${cardCls} flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/15 ring-1 ring-gold-500/25 flex items-center justify-center">
            <CheckCircle size={18} className="text-gold-400" />
          </div>
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Payments Active</p>
            <p className={`text-xs ${textSub}`}>Your account is connected and ready to receive payments.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status.payoutsEnabled && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25">
              Payouts enabled
            </span>
          )}
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            <ExternalLink size={11} /> Stripe Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Stripe account created but onboarding not complete
  if (creator?.stripe_account_id && !status.chargesEnabled) {
    return (
      <div className={`${cardCls}`}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold-500/15 ring-1 ring-gold-500/25 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-gold-400" />
          </div>
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Complete Stripe Setup</p>
            <p className={`text-xs mt-0.5 ${textSub}`}>
              Your Stripe account was created but setup is not complete. Finish onboarding to start accepting payments.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || checking}
            className="flex-1 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            {loading || checking ? <Loader size={14} className="animate-spin" /> : <CreditCard size={14} />}
            {loading ? 'Redirecting...' : checking ? 'Checking...' : 'Continue Setup'}
          </button>
          <button
            type="button"
            onClick={() => checkStatus(creator.stripe_account_id)}
            disabled={checking}
            className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
              dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // Not yet connected
  return (
    <div className={`${cardCls}`}>
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gold-500/15 flex items-center justify-center shrink-0">
          <CreditCard size={20} className="text-gold-400" />
        </div>
        <div>
          <h3 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
            Get paid for your work
          </h3>
          <p className={`text-sm mt-1 leading-relaxed ${textSub}`}>
            Connect your payment account to start receiving bookings. Clients pay through CreatorBridge,
            and funds are released to you when you deliver.
          </p>
        </div>
      </div>

      {/* Fee preview */}
      <div className={`rounded-xl p-3 mb-4 ${dark ? 'bg-charcoal-950/60 border border-white/[0.07]' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Client pays', value: '+ 5%', note: 'booking fee' },
            { label: 'Platform fee', value: '10%', note: 'from your payout' },
            { label: 'You keep', value: '90%', note: 'of every booking' },
          ].map(({ label, value, note }) => (
            <div key={label}>
              <p className={`text-[10px] font-medium ${textSub}`}>{label}</p>
              <p className={`font-display font-bold text-lg ${dark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
              <p className={`text-[10px] ${textSub}`}>{note}</p>
            </div>
          ))}
        </div>
      </div>

      {(!supabaseConfigured || !stripeConfigured) && (
        <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 ${dark ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-gold-50 border border-gold-200'}`}>
          <AlertCircle size={14} className="text-gold-400 shrink-0 mt-0.5" />
          <p className={`${dark ? 'text-gold-300' : 'text-gold-800'} text-xs`}>
            {!stripeConfigured
              ? 'Add VITE_STRIPE_PUBLISHABLE_KEY to your .env file to enable payments.'
              : 'Connect Supabase to enable payment processing.'}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleConnect}
        disabled={loading || !supabaseConfigured || !stripeConfigured}
        className="w-full py-3 rounded-xl bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2"
      >
        {loading ? <Loader size={14} className="animate-spin" /> : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.479 9.883c-2.508-.809-3.308-1.655-3.308-2.999 0-1.523 1.414-2.573 3.75-2.573 2.461 0 3.369 1.073 3.446 2.672h3.044c-.088-2.198-1.438-4.22-4.125-4.893V0H12v2.032c-2.507.465-4.518 1.96-4.518 4.21 0 2.697 2.232 4.04 5.485 4.94 2.762.789 3.308 1.945 3.308 3.165 0 .906-.646 2.348-3.75 2.348-2.858 0-3.977-1.308-4.124-2.672H5.357c.163 2.786 2.232 4.352 4.643 4.808V24h4.286v-2.016c2.52-.443 4.5-1.79 4.5-4.238 0-3.373-2.895-4.524-5.307-5.363z"/>
          </svg>
        )}
        {loading ? 'Redirecting to Stripe...' : 'Connect with Stripe'}
      </button>
      <p className={`text-center text-[10px] mt-2 ${textSub}`}>
        Powered by Stripe. Your financial data is never stored on our servers.
      </p>
    </div>
  );
}
