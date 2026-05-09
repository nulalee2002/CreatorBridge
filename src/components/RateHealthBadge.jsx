import { getRateHealth } from '../utils/pricing.js';
import { Tooltip } from './Tooltip.jsx';

const HEALTH_CONFIG = {
  green:   { label: 'In Range',    bar: 'bg-gold-400',   text: 'text-gold-400',   tip: 'Your rate is within the standard market range for this region.' },
  yellow:  { label: 'Below Low',   bar: 'bg-gold-500', text: 'text-gold-400', tip: 'You may be undercharging - this rate is below the low end for your region.' },
  red:     { label: 'Too Low',     bar: 'bg-red-400',    text: 'text-red-400',    tip: 'You may be undervaluing your services. Consider raising this rate.' },
  blue:    { label: 'Premium',     bar: 'bg-gold-300',   text: 'text-gold-300',   tip: 'Above the high end - you\'re charging premium rates. Make sure clients understand your value.' },
  neutral: { label: '-',           bar: 'bg-white/[0.16]', text: 'text-charcoal-300', tip: 'No range data available for this rate.' },
};

export function RateHealthBadge({ value, range, showLabel = false }) {
  const status = getRateHealth(value, range);
  const cfg = HEALTH_CONFIG[status];

  // Width of fill bar (proportional within range)
  let fillPct = 50;
  if (range) {
    const { low, high } = range;
    const span = high - low;
    if (span > 0) fillPct = Math.max(4, Math.min(96, ((value - low) / span) * 80 + 10));
  }

  return (
    <Tooltip content={cfg.tip} position="top">
      <span className="inline-flex items-center gap-1.5 cursor-default">
        <span className="relative w-12 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <span
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${cfg.bar}`}
            style={{ width: `${fillPct}%` }}
          />
        </span>
        {showLabel && (
          <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
        )}
      </span>
    </Tooltip>
  );
}
