import { SERVICES } from '../data/rates.js';

export function ServiceSelector({ value, onChange, dark = true }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Object.values(SERVICES).map(svc => {
        const active = value === svc.id;
        return (
          <button
            key={svc.id}
            type="button"
            onClick={() => onChange(svc.id)}
            className={`group relative flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all duration-200 ${
              active
                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                : dark
                  ? 'border-white/[0.08] bg-charcoal-900/60 text-charcoal-300 hover:border-gold-500/35 hover:bg-white/[0.06]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl">{svc.icon}</span>
            <span className="text-xs font-semibold leading-tight">{svc.name}</span>
            {active && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-gold-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
