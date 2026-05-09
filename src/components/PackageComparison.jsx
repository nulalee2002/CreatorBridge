import { PACKAGE_TIERS, RATES } from '../data/rates.js';
import { getRate, formatCurrency } from '../utils/pricing.js';
import { Check } from 'lucide-react';

export function PackageComparison({ serviceId, regionKey, currency = 'USD', exchangeRates, dark = true, onSelectPackage }) {
  if (!serviceId || !regionKey) return null;
  const tiers = PACKAGE_TIERS[serviceId];
  if (!tiers) return null;
  const serviceRates = RATES[serviceId];
  if (!serviceRates) return null;

  const fmt = (v) => formatCurrency(v, currency, exchangeRates);

  const calcPackageTotal = (tierDef) => {
    return (tierDef.items || []).reduce((sum, item) => {
      const range = getRate(serviceId, item.rateKey, regionKey);
      if (!range) return sum;
      return sum + range.mid * item.quantity;
    }, 0);
  };

  const tierColors = {
    basic:    { border: 'border-white/[0.08]', badge: 'bg-white/[0.08] text-charcoal-300', btn: dark ? 'border-white/[0.09] text-charcoal-300' : 'border-gray-300 text-gray-600' },
    standard: { border: 'border-gold-500/50',  badge: 'bg-gold-500/20 text-gold-400',     btn: 'border-gold-500 text-gold-400 bg-gold-500/5' },
    premium:  { border: 'border-gold-400/50',  badge: 'bg-gold-500/25 text-gold-300',     btn: 'border-gold-400 text-gold-300 bg-gold-500/10' },
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <h3 className={`font-display font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
        Package Comparison
      </h3>
      <p className={`text-xs mb-4 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
        Side-by-side view of all three tiers at market mid rates
      </p>

      <div className="grid grid-cols-3 gap-3">
        {Object.entries(tiers).map(([tierKey, tierDef]) => {
          const total = calcPackageTotal(tierDef);
          const colors = tierColors[tierKey] || tierColors.basic;

          return (
            <div key={tierKey}
              className={`rounded-xl border p-3 flex flex-col ${colors.border} ${
                tierKey === 'standard'
                  ? dark ? 'bg-gold-500/5' : 'bg-gold-50/50'
                  : dark ? 'bg-charcoal-950/45' : 'bg-gray-50/50'
              }`}
            >
              {/* Badge */}
              <div className="mb-2">
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors.badge}`}>
                  {tierDef.name}
                  {tierKey === 'standard' && ' ★'}
                </span>
              </div>

              {/* Price */}
              <p className={`font-display text-xl font-bold mb-0.5 ${dark ? 'text-white' : 'text-gray-900'}`}>
                {fmt(total)}
              </p>
              <p className={`text-[10px] mb-3 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>est. at mid rates</p>

              {/* Description */}
              <p className={`text-xs mb-3 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>{tierDef.description}</p>

              {/* Includes */}
              <ul className="space-y-1 flex-1 mb-3">
                {(tierDef.includes || []).map((inc, i) => (
                  <li key={i} className={`flex items-start gap-1.5 text-[11px] ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
                    <Check size={10} className="text-gold-400 mt-0.5 shrink-0" />
                    {inc}
                  </li>
                ))}
              </ul>

              {/* Select button */}
              {onSelectPackage && (
                <button
                  type="button"
                  onClick={() => onSelectPackage(tierKey, tierDef)}
                  className={`w-full py-1.5 rounded-lg border text-xs font-semibold transition-all hover:opacity-80 ${colors.btn}`}
                >
                  Use {tierDef.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
