import { SEASONAL_DEMAND } from '../data/regions.js';

const SERVICE_COLORS = {
  video:          { key: 'video',   label: 'Video',   color: '#d4a941' },
  photography:    { key: 'photo',   label: 'Photo',   color: '#efc970' },
  podcast:        { key: 'podcast', label: 'Podcast', color: '#d4a941' },
  drone:          { key: 'drone',   label: 'Drone',   color: '#efc970' },
  social:         { key: 'social',  label: 'Social',  color: '#d4a941' },
  postProduction: { key: 'post',    label: 'Post',    color: '#efc970' },
};

const PEAK_LABELS = {
  video:          'Peak: May–Oct (weddings/events), Nov–Dec (corp)',
  photography:    'Peak: May–Oct (weddings/portraits)',
  podcast:        'Peak: Sep–Dec (Q4 launches)',
  drone:          'Peak: Apr–Sep (good weather)',
  social:         'Peak: Nov–Dec (holiday campaigns)',
  postProduction: 'Peak: Oct–Dec (Q4 budgets)',
};

export function SeasonalDemand({ serviceId, dark = true }) {
  const svc = SERVICE_COLORS[serviceId];
  const peakLabel = PEAK_LABELS[serviceId];

  const maxVal = 100;
  const chartH = 64;

  const points = SEASONAL_DEMAND.map((row, i) => {
    const val = svc ? row[svc.key] : 70;
    const x = (i / (SEASONAL_DEMAND.length - 1)) * 100;
    const y = 100 - (val / maxVal) * 100;
    return { x, y, val, month: row.month };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const fillD = `${pathD} L 100 100 L 0 100 Z`;

  const color = svc?.color || '#d4a941';

  return (
    <div className={`rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`}>
      <h3 className={`font-display font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>
        Seasonal Demand
      </h3>
      {peakLabel && (
        <p className="text-xs text-gold-400 mb-3">{peakLabel}</p>
      )}

      {/* Line chart */}
      <div className="relative" style={{ height: chartH }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {[25, 50, 75].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y}
              stroke={dark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'} strokeWidth="0.5" strokeDasharray="2,2" />
          ))}
          {/* Fill */}
          <path d={fillD} fill="url(#demandGrad)" />
          {/* Line */}
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Current month dot */}
          {(() => {
            const monthIdx = new Date().getMonth();
            const p = points[monthIdx];
            if (!p) return null;
            return (
              <circle cx={p.x} cy={p.y} r="2.5" fill={color} stroke="white" strokeWidth="1" />
            );
          })()}
        </svg>
      </div>

      {/* Month labels */}
      <div className="flex justify-between mt-1">
        {SEASONAL_DEMAND.map((row, i) => {
          const isCurrentMonth = i === new Date().getMonth();
          return (
            <span key={row.month} className={`text-[8px] font-medium ${
              isCurrentMonth ? 'text-gold-400' : dark ? 'text-charcoal-300' : 'text-gray-400'
            }`}>
              {row.month}
            </span>
          );
        })}
      </div>

      {/* Demand % labels */}
      <div className="flex justify-between mt-0.5">
        {points.map((p, i) => {
          const isCurrentMonth = i === new Date().getMonth();
          return (
            <span key={i} className={`text-[7px] ${
              isCurrentMonth ? 'font-bold text-gold-400' : dark ? 'text-charcoal-400' : 'text-gray-300'
            }`}>
              {p.val}%
            </span>
          );
        })}
      </div>
    </div>
  );
}
