import { useState } from 'react';
import { Check, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  IDENTITY_CONSENT_COPY,
  IDENTITY_CONSENT_VERSION,
} from '../../supabase/functions/_shared/identityPolicy.js';

export function IdentityConsent({ dark = true, busy = false, onContinue, onCancel }) {
  const [accepted, setAccepted] = useState(false);
  const panel = dark
    ? 'border-gold-500/25 bg-charcoal-950/70 text-charcoal-200'
    : 'border-gold-200 bg-gold-50 text-gray-700';

  return (
    <section className={`rounded-2xl border p-5 ${panel}`} aria-labelledby="identity-consent-title">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          <ShieldCheck size={19} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400">Separate consent</p>
          <h3 id="identity-consent-title" className={`mt-1 font-display text-xl font-semibold ${dark ? 'text-white' : 'text-gray-950'}`}>
            {IDENTITY_CONSENT_COPY.title}
          </h3>
        </div>
      </div>

      <div className={`mt-4 space-y-3 text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
        <p>{IDENTITY_CONSENT_COPY.summary}</p>
        <p>{IDENTITY_CONSENT_COPY.processing}</p>
        <p>{IDENTITY_CONSENT_COPY.retention}</p>
        <p>
          Read the <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-gold-400 underline">CreatorBridge Privacy Policy</a>
          {' '}and <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-gold-400 underline">Stripe Privacy Policy <ExternalLink size={11} /></a>.
          Contact CreatorBridge support for review, recovery, or deletion information.
        </p>
      </div>

      <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
        dark ? 'border-white/[0.09] bg-white/[0.035]' : 'border-gold-200 bg-white'
      }`}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={event => setAccepted(event.target.checked)}
          className="peer sr-only"
        />
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gold-500 text-gold-400 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500">
          {accepted && <Check size={15} />}
        </span>
        <span className={`text-sm leading-6 ${dark ? 'text-charcoal-200' : 'text-gray-700'}`}>
          {IDENTITY_CONSENT_COPY.affirmation}
        </span>
      </label>

      <p className={`mt-2 text-[10px] ${dark ? 'text-charcoal-500' : 'text-gray-400'}`}>
        Consent notice version {IDENTITY_CONSENT_VERSION}
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
            dark ? 'border-white/[0.1] text-charcoal-300 hover:text-white' : 'border-gray-300 text-gray-600 hover:text-gray-900'
          }`}>
            Not now
          </button>
        )}
        <button
          type="button"
          onClick={() => onContinue?.({ consentVersion: IDENTITY_CONSENT_VERSION })}
          disabled={!accepted || busy}
          className="rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-charcoal-950 transition hover:bg-gold-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Opening secure verification...' : 'Continue securely with Stripe'}
        </button>
      </div>
    </section>
  );
}
