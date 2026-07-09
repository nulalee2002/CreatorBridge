import { CREATOR_TIERS, tierBadgeClass, calculateTier } from '../config/tiers.js';

/**
 * Compact tier badge - shown on cards, profile headers, match results.
 * Props:
 *   tierId  - 'launch' | 'proven' | 'signature' | 'elite'
 *   size    - 'sm' | 'md' (default 'sm')
 */
export function TierBadge({ tierId = 'launch', size = 'sm' }) {
  const tier = CREATOR_TIERS[tierId];
  if (!tier) return null;

  // Do not show baseline status badges publicly. Every listed creator is
  // already verified; only higher platform tiers need a public badge.
  if (tierId === 'launch' || tierId === 'proven') return null;

  const cls = tierBadgeClass(tierId);
  const textSize = size === 'md' ? 'text-xs' : 'text-[10px]';
  const px = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${textSize} ${px} ${cls}`}>
      <span>{tier.icon}</span>
      {tier.name}
    </span>
  );
}

/**
 * Tier progress widget for the Creator Dashboard.
 * Shows current tier, requirements, and next tier progress.
 */
export function TierProgress({ creator, dark }) {
  const tierId = creator?.tier || calculateTier(creator || {});
  const tier   = CREATOR_TIERS[tierId];
  const tierOrder = ['launch', 'proven', 'signature', 'elite'];
  const tierIndex = tierOrder.indexOf(tierId);
  const nextTierId = tierOrder[tierIndex + 1];
  const nextTier   = nextTierId ? CREATOR_TIERS[nextTierId] : null;

  const completed    = creator?.completed_projects || 0;
  const rating       = creator?.rating || 0;
  const completion   = creator?.completion_rate || 100;

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardBg  = `rounded-2xl border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${dark ? 'bg-charcoal-900/72 border-white/[0.07]' : 'bg-white border-gray-200'}`;

  function Req({ label, current, required, done }) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${textSub}`}>{label}</span>
        <span className={`text-xs font-semibold ${done ? 'text-gold-400' : dark ? 'text-white' : 'text-gray-900'}`}>
          {current} {required ? `/ ${required}` : ''} {done ? '✓' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className={cardBg}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${textSub}`}>Creator Tier</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">{tier.icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`font-display font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>
              {tier.name}
            </span>
            <TierBadge tierId={tierId} size="sm" />
          </div>
          <span className={`text-xs ${textSub}`}>{tier.label}</span>
        </div>
      </div>

      {nextTier ? (
        <>
          <p className={`text-xs font-semibold mb-2 ${dark ? 'text-charcoal-300' : 'text-gray-700'}`}>
            Next: {nextTier.name} tier requirements
          </p>
          <div className="space-y-1.5">
            <Req
              label="Completed projects"
              current={completed}
              required={nextTier.requirements.completedProjects}
              done={completed >= nextTier.requirements.completedProjects}
            />
            <Req
              label="Average rating"
              current={rating ? rating.toFixed(1) : 'No reviews yet'}
              required={nextTier.requirements.minRating.toFixed(1)}
              done={rating >= nextTier.requirements.minRating}
            />
            <Req
              label="Completion rate"
              current={`${completion}%`}
              required={`${nextTier.requirements.completionRate}%`}
              done={completion >= nextTier.requirements.completionRate}
            />
          </div>
        </>
      ) : (
        <p className={`text-xs ${textSub}`}>
          You have reached the highest tier. Maximum loyalty benefits apply.
        </p>
      )}
    </div>
  );
}

/**
 * Small celebratory banner shown when a creator reaches a new tier.
 */
export function TierUpBanner({ newTierId, dark, onDismiss }) {
  const tier = CREATOR_TIERS[newTierId];
  if (!tier || newTierId === 'launch') return null;

  return (
    <div className={`mb-4 p-4 rounded-2xl border flex items-center gap-4 ${
      dark ? 'border-gold-500/30 bg-gold-500/10' : 'border-gold-300 bg-gold-50'
    }`}>
      <span className="text-3xl">{tier.icon}</span>
      <div className="flex-1">
        <p className={`font-bold text-sm ${dark ? 'text-gold-400' : 'text-gold-700'}`}>
          Congratulations! You have reached {tier.name} status on CreatorBridge.
        </p>
        <p className={`text-xs mt-0.5 ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
          {tier.label} - {tier.name === 'Proven' ? 'Your creator fee tier has improved.' : tier.name === 'Signature' ? 'Your profile is now boosted in search results.' : 'You have reached the highest creator tier.'}
        </p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${dark ? 'border-white/[0.09] text-charcoal-300 hover:border-gold-500/35 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-900'}`}>
          Dismiss
        </button>
      )}
    </div>
  );
}
