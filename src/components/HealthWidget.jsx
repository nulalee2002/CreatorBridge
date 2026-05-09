import { useMemo } from 'react';
import { RATES } from '../data/rates.js';
import { getRate } from '../utils/pricing.js';

const HEALTH_TIPS = {
  low: [
    'Your rates are at the low end - consider a 15–20% increase for new clients.',
    'Add a licensing fee if clients will use the content commercially.',
    'Bundle revisions into a higher base rate rather than offering them free.',
    'Charge equipment fees separately to reflect real gear costs.',
  ],
  mid: [
    'You\'re in a healthy range - keep refining your packages.',
    'Rush fees can add 25–50% to eligible projects.',
    'Consider tiered packages (Basic/Standard/Premium) to upsell.',
    'Premium markets support rates at the top of your range.',
  ],
  high: [
    'You\'re charging premium rates - make sure your brand reflects it.',
    'Detailed proposals and case studies help justify higher prices.',
    'Focus on value-based pricing rather than hourly justification.',
    'Referral programs protect your pipeline at these rates.',
  ],
};

export function HealthWidget({ serviceId, regionKey, lineItems, experienceLevel = 'mid', dark = true }) {
  const score = useMemo(() => {
    if (!serviceId || !regionKey || !lineItems.length) return null;
    const serviceRates = RATES[serviceId];
    if (!serviceRates) return null;

    let total = 0, count = 0;
    for (const item of lineItems) {
      if (!item.active || !item.value || !item.rateKey) continue;
      const range = getRate(serviceId, item.rateKey, regionKey);
      if (!range) continue;
      const { low, high, mid } = range;
      const span = high - low;
      if (span <= 0) continue;
      // Score: low=2, mid=6, high=10, clamped
      const normalized = Math.max(1, Math.min(10, ((item.value - low) / span) * 8 + 2));
      total += normalized;
      count++;
    }
    if (count === 0) return null;
    return Math.round((total / count) * 10) / 10;
  }, [serviceId, regionKey, lineItems]);

  if (score === null) {
    return (
      <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
        <h3 className={`font-display font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Am I Charging Enough?</h3>
        <p className={`text-xs ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>Enable some line items to see your rate health score.</p>
      </div>
    );
  }

  const tier = score <= 4 ? 'low' : score <= 7 ? 'mid' : 'high';
  const label = { low: 'Undercharging', mid: 'Healthy Range', high: 'Premium Pricing' }[tier];
  const scoreColor = { low: 'text-red-400', mid: 'text-gold-400', high: 'text-gold-300' }[tier];
  const fillColor = { low: 'bg-red-400', mid: 'bg-gold-500', high: 'bg-gold-300' }[tier];
  const tips = HEALTH_TIPS[tier];

  const arcPct = (score / 10) * 100;
  // SVG arc for the gauge
  const radius = 42;
  const circumference = Math.PI * radius; // half circle
  const strokeDash = (arcPct / 100) * circumference;

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <h3 className={`font-display font-bold text-base mb-4 ${dark ? 'text-white' : 'text-gray-900'}`}>
        Am I Charging Enough?
      </h3>

      <div className="flex items-center gap-6">
        {/* Gauge */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 54" className="w-28 overflow-visible">
            {/* Background track */}
            <path
              d="M 8 50 A 42 42 0 0 1 92 50"
              fill="none"
              stroke={dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Fill */}
            <path
              d="M 8 50 A 42 42 0 0 1 92 50"
              fill="none"
              stroke={tier === 'low' ? '#f87171' : tier === 'high' ? '#efc970' : '#d4a941'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              className="transition-all duration-700"
            />
            {/* Score text */}
            <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="bold"
              fill={tier === 'low' ? '#f87171' : tier === 'high' ? '#efc970' : '#d4a941'}
              fontFamily="Space Grotesk, sans-serif">
              {score}
            </text>
            <text x="50" y="56" textAnchor="middle" fontSize="7"
              fill={dark ? '#8888b8' : '#9ca3af'} fontFamily="DM Sans, sans-serif">
              OUT OF 10
            </text>
          </svg>
        </div>

        {/* Rating label + bar */}
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base ${scoreColor}`}>{label}</p>
          <div className={`mt-2 h-1.5 rounded-full ${dark ? 'bg-white/[0.08]' : 'bg-gray-200'} overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-700 ${fillColor}`}
              style={{ width: `${arcPct}%` }}
            />
          </div>
          <div className={`flex justify-between text-[9px] mt-0.5 ${dark ? 'text-charcoal-400' : 'text-gray-400'}`}>
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className={`mt-4 rounded-xl px-4 py-3 ${dark ? 'bg-charcoal-950/60 border border-white/[0.06]' : 'bg-gray-50'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>Tips</p>
        <ul className="space-y-1.5">
          {tips.slice(0, 2).map((tip, i) => (
            <li key={i} className={`text-xs flex gap-2 ${dark ? 'text-charcoal-300' : 'text-gray-600'}`}>
              <span className="text-gold-400 shrink-0 mt-0.5">→</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
