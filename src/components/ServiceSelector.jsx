import { PILLARS } from '../data/taxonomy.js';

// Pillar-level base hourly rates for the creator pricing calculator.
// US-only baselines. The calculator multiplies these by market and experience modifiers.
const PILLAR_BASE_RATES = {
  video_production: 250,
  photography:      150,
  post_production:  75,
};

// Maps pillar id → legacy service id used by rates.js RATES lookup tables.
// Kept here so the rest of the calculator code continues to work with `value`
// holding a legacy service id (video / photography / postProduction).
export const PILLAR_TO_LEGACY_SERVICE = {
  video_production: 'video',
  photography:      'photography',
  post_production:  'postProduction',
};
const LEGACY_TO_PILLAR = Object.entries(PILLAR_TO_LEGACY_SERVICE).reduce((acc, [pillar, legacy]) => {
  acc[legacy] = pillar;
  return acc;
}, {});

export function ServiceSelector({ value, onChange, dark = true }) {
  // The component still emits legacy service ids on onChange so downstream
  // rates.js lookups continue to work without a parallel refactor.
  const currentPillar = LEGACY_TO_PILLAR[value] || value;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Object.values(PILLARS).map(pillar => {
        const active = currentPillar === pillar.id;
        const rate = PILLAR_BASE_RATES[pillar.id] || 150;
        return (
          <button
            key={pillar.id}
            type="button"
            onClick={() => onChange(PILLAR_TO_LEGACY_SERVICE[pillar.id])}
            className={`lane-pick ${active ? 'active' : ''} w-full`}
          >
            <div className="ico">
              <span className="text-base select-none">{pillar.icon}</span>
            </div>
            <div className="text-sm font-semibold text-white leading-snug">{pillar.name}</div>
            <div className="text-[10px] text-[var(--text-dim)] mt-1 font-medium">
              ${rate}/hr base
            </div>
          </button>
        );
      })}
    </div>
  );
}
