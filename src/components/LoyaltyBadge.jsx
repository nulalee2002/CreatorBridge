import { getLoyaltyTier } from '../config/fees.js';

/**
 * Public-facing badge shown on creator profile cards and profile pages.
 * Only renders for Silver and Gold creators.
 */
export function LoyaltyBadge({ completedProjects = 0 }) {
  const { badge, name } = getLoyaltyTier(completedProjects);
  if (!badge) return null;

  if (badge === 'gold') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-500/20 text-gold-400 ring-1 ring-gold-500/40 shadow-[0_0_8px_rgba(212,169,65,0.25)]">
        Gold Creator
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-400/15 text-gray-300 ring-1 ring-gray-400/30">
      Silver Creator
    </span>
  );
}

/**
 * Dashboard progress widget — shows the creator's current tier
 * and how many projects until they reach the next tier.
 */
export function LoyaltyProgress({ completedProjects = 0, dark }) {
  const { name, feePct, badge, nextTier, projectsToNext } = getLoyaltyTier(completedProjects);

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardBg  = dark ? 'bg-charcoal-900/72 border-white/[0.07] shadow-[0_24px_80px_rgba(0,0,0,0.16)]' : 'bg-white border-gray-200';

  const tierColor = badge === 'gold'
    ? 'text-gold-400'
    : badge === 'silver'
    ? 'text-gray-300'
    : dark ? 'text-charcoal-300' : 'text-gray-500';

  // Progress bar pct within current tier range
  const tierDef = { Standard: { min: 0, max: 10 }, Silver: { min: 10, max: 25 }, Gold: { min: 25, max: 25 } }[name] || { min: 0, max: 10 };
  const pct = name === 'Gold' ? 100 : Math.round(((completedProjects - tierDef.min) / (tierDef.max - tierDef.min)) * 100);

  return (
    <div className={`rounded-2xl border p-4 ${cardBg}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${textSub}`}>Loyalty Status</p>

      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${tierColor}`}>{name} Creator</span>
          {badge && <LoyaltyBadge completedProjects={completedProjects} />}
        </div>
        <span className={`text-xs font-semibold ${tierColor}`}>{feePct}% fee</span>
      </div>

      <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.08]' : 'bg-gray-100'} mb-2`}>
        <div
          className={`h-full rounded-full transition-all ${badge === 'gold' ? 'bg-gold-500' : badge === 'silver' ? 'bg-gray-400' : 'bg-charcoal-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <p className={`text-xs ${textSub}`}>
        {name === 'Gold' ? (
          <>Gold Creator. Maximum loyalty discount applied.</>
        ) : (
          <>
            <span className={`font-medium ${dark ? 'text-white' : 'text-gray-900'}`}>{completedProjects}</span> completed project{completedProjects !== 1 ? 's' : ''}.{' '}
            {projectsToNext > 0 && nextTier && (
              <>
                <span className="font-medium">{projectsToNext} more</span> to unlock{' '}
                <span className={badge === 'silver' ? 'text-gold-400' : 'text-gray-300'}>{nextTier.name}</span>{' '}
                tier ({nextTier.feePct}% fee).
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
