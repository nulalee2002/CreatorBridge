import { RATES, SERVICES } from '../data/rates.js';
import { getRate } from '../utils/pricing.js';

export function RateComparisonChart({ serviceId, regionKey, lineItems, dark = true }) {
  if (!serviceId || !regionKey) return null;

  const service = SERVICES[serviceId];
  const rateKeys = [...(service.primaryRates || []), ...(service.packageRates || [])].slice(0, 6);
  const servicRates = RATES[serviceId] || {};

  const rows = rateKeys
    .map(key => {
      const meta = servicRates[key];
      if (!meta) return null;
      const range = getRate(serviceId, key, regionKey);
      if (!range) return null;
      const item = lineItems.find(l => l.rateKey === key);
      const yourRate = item?.value;
      return { key, label: meta.label, range, yourRate };
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  const maxVal = Math.max(...rows.map(r => r.range.high), ...rows.map(r => r.yourRate || 0));

  const pct = (v) => Math.max(2, Math.min(98, (v / maxVal) * 100));

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <h3 className={`font-display font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
        Your Rates vs. Market Range
      </h3>
      <p className={`text-xs mb-4 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
        Compare your active rates against the Low / Mid / High range for this region
      </p>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {[
          { color: 'bg-white/[0.12]', label: 'Low–High Range' },
          { color: 'bg-gold-500/30 border border-gold-500', label: 'Mid (market avg)' },
          { color: 'bg-gold-400', label: 'Your Rate' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3 h-2 rounded-sm ${l.color}`} />
            <span className={`text-[10px] font-medium ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>{l.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map(({ key, label, range, yourRate }) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <span className={`text-xs font-medium truncate max-w-[60%] ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>{label}</span>
              {yourRate && (
                <span className="text-xs font-bold text-gold-400">${yourRate.toLocaleString()}</span>
              )}
            </div>
            <div className="relative h-4 rounded-full overflow-hidden">
              {/* Track */}
              <div className={`absolute inset-0 rounded-full ${dark ? 'bg-white/[0.08]' : 'bg-gray-100'}`} />

              {/* Range bar */}
              <div
                className="absolute top-0 bottom-0 rounded-full bg-white/[0.14]"
                style={{ left: `${pct(range.low)}%`, width: `${pct(range.high) - pct(range.low)}%` }}
              />

              {/* Mid marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-gold-500/50 rounded-full"
                style={{ left: `${pct(range.mid)}%` }}
              />

              {/* Your rate */}
              {yourRate && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gold-400 shadow ring-2 ring-charcoal-950 z-10 transition-all duration-300"
                  style={{ left: `${pct(yourRate)}%`, transform: 'translate(-50%, -50%)' }}
                />
              )}
            </div>
            <div className={`flex justify-between text-[9px] mt-0.5 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
              <span>${range.low.toLocaleString()}</span>
              <span className="text-gold-500/70">${range.mid.toLocaleString()}</span>
              <span>${range.high.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
