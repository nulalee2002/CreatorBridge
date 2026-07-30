import { useMemo } from 'react';
import { ArrowRight, Clock3, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { identityReturnPath, validateIdentityPurpose } from '../../supabase/functions/_shared/identityPolicy.js';
import { useTrustStatus } from '../hooks/useTrustStatus.js';

export function IdentityReturnPage({ dark = true }) {
  const [params] = useSearchParams();
  const purpose = useMemo(() => {
    try {
      return validateIdentityPurpose(params.get('purpose'));
    } catch {
      return 'first_contract';
    }
  }, [params]);
  const { trust, loading, error, refresh } = useTrustStatus();
  const destination = identityReturnPath(purpose);
  const destinationLabel = purpose === 'creator_application' ? 'Return to creator application' : 'Return to Project Board';

  return (
    <main className="mx-auto min-h-[60vh] max-w-2xl px-4 py-16 sm:px-6">
      <section className={`rounded-3xl border p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-9 ${
        dark ? 'border-gold-500/25 bg-charcoal-900/80' : 'border-gold-200 bg-white'
      }`}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          {loading ? <Loader2 className="animate-spin" /> : <Clock3 />}
        </span>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-gold-400">Secure identity check</p>
        <h1 className={`mt-2 font-display text-3xl font-semibold ${dark ? 'text-white' : 'text-gray-950'}`}>
          {trust.identityVerified ? 'Identity verified' : 'Verification submitted'}
        </h1>
        <p className={`mx-auto mt-3 max-w-lg text-sm leading-6 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
          {trust.identityVerified
            ? 'Your verified identity is ready for protected CreatorBridge actions.'
            : trust.reviewMessage || 'Stripe may take a moment to finish the checks. CreatorBridge will unlock the next step only after the signed webhook confirms the result.'}
        </p>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        {!trust.identityVerified && (
          <button type="button" onClick={() => void refresh()} className={`mt-5 rounded-xl border px-5 py-2.5 text-sm font-semibold ${
            dark ? 'border-gold-500/30 text-gold-300 hover:bg-gold-500/10' : 'border-gold-300 text-gold-700 hover:bg-gold-50'
          }`}>
            Refresh verification status
          </button>
        )}
        <Link to={destination} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-sm font-bold text-charcoal-950 transition hover:bg-gold-600">
          {destinationLabel} <ArrowRight size={15} />
        </Link>
      </section>
    </main>
  );
}
