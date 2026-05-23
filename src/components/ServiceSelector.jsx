import { SERVICES } from '../data/rates.js';

export function ServiceSelector({ value, onChange, dark = true }) {
  // Estimated base hourly rates for display matching database/industry averages
  const baseRates = {
    video: 180,
    photography: 120,
    drone: 150,
    social: 95,
    postProduction: 75,
    liveevents: 135
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Object.values(SERVICES).map(svc => {
        const active = value === svc.id;
        const rate = baseRates[svc.id] || 100;
        return (
          <button
            key={svc.id}
            type="button"
            onClick={() => onChange(svc.id)}
            className={`lane-pick ${active ? 'active' : ''} w-full`}
          >
            <div className="ico">
              <span className="text-base select-none">{svc.icon}</span>
            </div>
            <div className="text-sm font-semibold text-white leading-snug">{svc.name}</div>
            <div className="text-[10px] text-[var(--text-dim)] mt-1 font-medium">
              ${rate}/hr base
            </div>
          </button>
        );
      })}
    </div>
  );
}

