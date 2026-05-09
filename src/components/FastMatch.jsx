import { useState, useEffect } from 'react';
import { Zap, X, Star, MapPin, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { matchCreators, loadAllCreatorsForMatching } from '../utils/matchingAlgorithm.js';
import { SERVICES } from '../data/rates.js';
import { TierBadge } from './TierBadge.jsx';
import { VerificationBadge } from './VerificationFlow.jsx';

const FAST_MATCH_FEE = 25; // $ after first free use
const FAST_MATCH_FREE_KEY = 'cm-fast-match-used-free';

function hasUsedFree() {
  try { return localStorage.getItem(FAST_MATCH_FREE_KEY) === 'true'; } catch { return false; }
}
function markFreeUsed() {
  try { localStorage.setItem(FAST_MATCH_FREE_KEY, 'true'); } catch {}
}

/**
 * FastMatch - lightning-bolt button that instantly surfaces the single best creator
 * for a given service and optional budget.
 *
 * Props: dark, serviceId (optional pre-filter), onViewProfile(creatorId)
 */
export function FastMatch({ dark, serviceId, onViewProfile }) {
  const navigate = useNavigate();
  const [open, setOpen]         = useState(false);
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [feeWarning, setFeeWarning] = useState(false);
  const [budgetMax, setBudgetMax]   = useState('');

  const isFree = !hasUsedFree();

  function runMatch() {
    setLoading(true);
    const creators = loadAllCreatorsForMatching();
    const brief = {
      serviceId: serviceId || null,
      budgetMin: 0,
      budgetMax: budgetMax ? Number(budgetMax) : 999999,
      location: { preference: 'either' },
    };
    const results = matchCreators(creators, brief);
    setResult(results[0] || null);
    setLoading(false);
    if (!isFree) {
      // In a real app this would charge $25 via Stripe; here we just note it
    } else {
      markFreeUsed();
    }
  }

  function handleOpen() {
    if (!isFree) { setFeeWarning(true); }
    setOpen(true);
  }

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        title="Fast Match - find your best creator instantly"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all shadow-sm"
      >
        <Zap size={12} className="fill-charcoal-900" /> Fast Match
        {isFree && <span className="text-[9px] font-bold bg-charcoal-900/20 px-1 rounded">FREE</span>}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="cb-modal-backdrop" onClick={() => setOpen(false)} />
          <div className={`relative w-full max-w-sm rounded-2xl border overflow-hidden ${dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_28px_90px_rgba(0,0,0,0.46)]' : 'bg-white border-gray-200 shadow-2xl'}`}>
            <div className="h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />
            <button type="button" onClick={() => setOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg ${dark ? 'text-charcoal-300 hover:text-white hover:bg-white/[0.08]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
              <X size={16} />
            </button>

            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-gold-500/20 flex items-center justify-center">
                  <Zap size={15} className="text-gold-400 fill-gold-400" />
                </div>
                <h3 className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>Fast Match</h3>
              </div>
              <p className={`text-xs mb-5 ${textSub}`}>
                Instantly find your single best creator match.
                {isFree
                  ? ' Your first Fast Match is free!'
                  : ` Subsequent uses are $${FAST_MATCH_FEE} (charged at booking).`
                }
              </p>

              {/* Fee warning */}
              {feeWarning && !isFree && (
                <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 ${dark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-gold-50 border border-gold-200'}`}>
                  <Zap size={12} className="text-gold-400 mt-0.5 shrink-0" />
                  <p className={`text-xs ${dark ? 'text-gold-300' : 'text-gold-800'}`}>
                    A $25 Fast Match fee applies and will be added to your next booking.
                  </p>
                </div>
              )}

              {/* Optional budget filter */}
              {!result && (
                <div className="mb-5">
                  <label className={`text-xs font-medium block mb-1.5 ${textSub}`}>Max budget (optional)</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${textSub}`}>$</span>
                    <input
                      type="number"
                      min={0}
                      value={budgetMax}
                      onChange={e => setBudgetMax(e.target.value)}
                      placeholder="No limit"
                      className={`w-full pl-7 pr-3 py-2.5 text-sm rounded-xl border outline-none transition-all ${
                        dark ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500'
                             : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Result */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full" />
                </div>
              )}

              {result && !loading && (
                <FastMatchResult result={result} dark={dark} onViewProfile={(id) => {
                  setOpen(false);
                  onViewProfile?.(id) || navigate(`/creator/${id}`);
                }} />
              )}

              {result === null && !loading && result !== undefined && (
                <div className="text-center py-6">
                  <p className="text-2xl mb-2">🔍</p>
                  <p className={`text-sm font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>No matches found</p>
                  <p className={`text-xs mt-1 ${textSub}`}>Try removing the budget filter.</p>
                </div>
              )}

              {!result && !loading && (
                <button type="button" onClick={runMatch}
                  className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-sm font-bold transition-all flex items-center justify-center gap-2">
                  <Zap size={14} className="fill-charcoal-900" />
                  {isFree ? 'Find My Best Match (Free)' : `Find My Best Match ($${FAST_MATCH_FEE})`}
                </button>
              )}

              {result && !loading && (
                <button type="button" onClick={() => { setResult(null); setBudgetMax(''); }}
                  className={`w-full mt-2 py-2 rounded-xl border text-xs font-medium transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'}`}>
                  Search again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FastMatchResult({ result, dark, onViewProfile }) {
  const { creator, matchPct, rateRange } = result;
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const location = creator.location || {};
  const locationStr = [location.city, location.state].filter(Boolean).join(', ');

  return (
    <div className={`rounded-xl border p-4 mb-4 ${dark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`}>
      {/* Match pct badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${dark ? 'bg-charcoal-950/70 ring-1 ring-white/[0.08]' : 'bg-white border border-gray-200'}`}>
            {creator.avatar || '🎬'}
          </div>
          <div>
            <p className={`font-bold text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>
              {creator.businessName || creator.name}
            </p>
            {locationStr && (
              <p className={`text-xs flex items-center gap-1 ${textSub}`}>
                <MapPin size={9} /> {locationStr}
              </p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-xl font-bold text-gold-400">{matchPct}%</p>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${textSub}`}>match</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        {creator.verification_status && creator.verification_status !== 'unverified' && (
          <VerificationBadge status={creator.verification_status} />
        )}
        {creator.tier && creator.tier !== 'launch' && <TierBadge tierId={creator.tier} />}
      </div>

      {/* Rating */}
      {creator.rating > 0 && (
        <div className="flex items-center gap-1 mb-2">
          {[1,2,3,4,5].map(s => (
            <Star key={s} size={10} className={s <= Math.round(creator.rating) ? 'text-gold-400 fill-gold-400' : dark ? 'text-charcoal-600' : 'text-gray-300'} />
          ))}
          <span className={`text-xs font-bold ml-0.5 ${dark ? 'text-white' : 'text-gray-900'}`}>{creator.rating}</span>
        </div>
      )}

      {/* Rate range */}
      {rateRange && (
        <p className={`text-xs ${textSub}`}>
          Est. range:{' '}
          <span className={`font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
            ${rateRange.min.toLocaleString()} – ${rateRange.max.toLocaleString()}
          </span>
        </p>
      )}

      <button type="button" onClick={() => onViewProfile(creator.id)}
        className="w-full mt-3 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-charcoal-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
        View Profile <ChevronRight size={12} />
      </button>
    </div>
  );
}
