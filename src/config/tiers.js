// ── Creator Tier Definitions ──────────────────────────────────────
export const CREATOR_TIERS = {
  launch: {
    name: 'Launch',
    label: 'New Creator',
    color: 'gray',
    icon: '🚀',
    requirements: {
      completedProjects: 0,
      minRating: 0,
      completionRate: 0,
    },
  },
  proven: {
    name: 'Proven',
    label: 'Trusted Creator',
    color: 'gold',
    icon: '✓',
    requirements: {
      completedProjects: 5,
      minRating: 4.0,
      completionRate: 80,
    },
  },
  elite: {
    name: 'Elite',
    label: 'Top Performer',
    color: 'gold',
    icon: '⭐',
    requirements: {
      completedProjects: 20,
      minRating: 4.5,
      completionRate: 90,
    },
  },
  signature: {
    name: 'Signature',
    label: 'Industry Leader',
    color: 'gold',
    icon: '👑',
    requirements: {
      completedProjects: 50,
      minRating: 4.7,
      completionRate: 95,
    },
  },
};

// Ordered list for iteration (lowest to highest)
export const TIER_ORDER = ['launch', 'proven', 'elite', 'signature'];

// ── Pricing Floors by Tier and Service ───────────────────────────
// Note: 'postProduction' is the service ID used in the app (from rates.js)
export const PRICING_FLOORS = {
  video: {
    launch:    { minProject: 200,  minHourly: 35  },
    proven:    { minProject: 500,  minHourly: 75  },
    elite:     { minProject: 1500, minHourly: 150 },
    signature: { minProject: 3000, minHourly: 250 },
  },
  photography: {
    launch:    { minProject: 100,  minHourly: 25  },
    proven:    { minProject: 250,  minHourly: 50  },
    elite:     { minProject: 800,  minHourly: 125 },
    signature: { minProject: 2000, minHourly: 200 },
  },
  podcast: {
    launch:    { minProject: 75,   minHourly: 25  },
    proven:    { minProject: 200,  minHourly: 50  },
    elite:     { minProject: 500,  minHourly: 100 },
    signature: { minProject: 1500, minHourly: 175 },
  },
  drone: {
    launch:    { minProject: 150,  minHourly: 50  },
    proven:    { minProject: 400,  minHourly: 100 },
    elite:     { minProject: 1000, minHourly: 200 },
    signature: { minProject: 2500, minHourly: 300 },
  },
  social: {
    launch:    { minProject: 75,   minHourly: 20  },
    proven:    { minProject: 200,  minHourly: 40  },
    elite:     { minProject: 500,  minHourly: 80  },
    signature: { minProject: 1500, minHourly: 150 },
  },
  postProduction: {
    launch:    { minProject: 50,   minHourly: 20  },
    proven:    { minProject: 150,  minHourly: 40  },
    elite:     { minProject: 500,  minHourly: 80  },
    signature: { minProject: 1500, minHourly: 150 },
  },
};

/**
 * Calculate which tier a creator qualifies for based on their stats.
 * Returns the highest tier they qualify for.
 */
export function calculateTier(creator) {
  const completed    = creator.completed_projects || 0;
  const rating       = creator.rating || 0;
  const completion   = creator.completion_rate || 100; // default 100 for new creators

  let currentTier = 'launch';
  for (const tierId of TIER_ORDER) {
    const req = CREATOR_TIERS[tierId].requirements;
    if (
      completed >= req.completedProjects &&
      rating >= req.minRating &&
      completion >= req.completionRate
    ) {
      currentTier = tierId;
    }
  }
  return currentTier;
}

/**
 * Check if a given rate is below the floor for this tier and service.
 * Returns null if no floor found, or an object with warning details.
 */
export function checkPricingFloor(tierId, serviceId, rateValue, rateType = 'project') {
  const floors = PRICING_FLOORS[serviceId]?.[tierId];
  if (!floors) return null;

  const floor = rateType === 'hourly' ? floors.minHourly : floors.minProject;
  if (rateValue < floor) {
    return {
      floor,
      rateType,
      message: `Creators at your level typically charge at least $${floor.toLocaleString()} for this type of work. Setting your rate too low may reduce perceived quality.`,
    };
  }
  return null;
}

/**
 * Tailwind class helpers for tier badge styling.
 */
export function tierBadgeClass(tierId) {
  switch (tierId) {
    case 'signature': return 'bg-gold-500/20 text-gold-400 ring-1 ring-gold-500/40 shadow-[0_0_8px_rgba(212,169,65,0.2)]';
    case 'elite':     return 'bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/35';
    case 'proven':    return 'bg-gold-500/10 text-gold-400 ring-1 ring-gold-500/25';
    default:          return 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/20';
  }
}
