export const PLATFORM_FEES = {
  creatorFeePct:     10,   // 10% taken from creator's earnings (Standard tier)
  clientFeePct:       5,   // 5% added on top of client's payment
  retainerPct:       50,   // 50% retainer upfront, 50% on delivery
  autoApproveDays:    3,   // 72 hours (3 days) before auto-approval if client does not respond
  cancellationFeePct: 10,  // Creator keeps 10% if client cancels after retainer paid
};

/** Loyalty tiers based on completed projects */
export const LOYALTY_TIERS = [
  { name: 'Standard', minProjects: 0,  maxProjects: 9,  feePct: 10, badge: null },
  { name: 'Silver',   minProjects: 10, maxProjects: 24, feePct: 8,  badge: 'silver' },
  { name: 'Gold',     minProjects: 25, maxProjects: Infinity, feePct: 6, badge: 'gold' },
];

/**
 * Returns the loyalty tier for a creator based on their completed project count.
 * @param {number} completedProjects
 * @returns {{ name: string, feePct: number, badge: string|null, nextTier: object|null, projectsToNext: number }}
 */
export function getLoyaltyTier(completedProjects = 0) {
  const count = Number(completedProjects) || 0;
  const tier = LOYALTY_TIERS.find(t => count >= t.minProjects && count <= t.maxProjects)
    || LOYALTY_TIERS[0];
  const nextTier = LOYALTY_TIERS.find(t => t.minProjects > count) || null;
  const projectsToNext = nextTier ? nextTier.minProjects - count : 0;
  return { ...tier, nextTier, projectsToNext };
}

/**
 * Calculate all fee amounts for a given project total (in dollars).
 * Returns amounts in both dollars and cents.
 * @param {number} projectAmountDollars
 * @param {number} [creatorFeePctOverride] - Override the creator fee % (for loyalty tiers)
 * @param {number} [clientFeePctOverride] - Override the client booking fee % (for referral rewards)
 */
export function calcFees(projectAmountDollars, creatorFeePctOverride, clientFeePctOverride) {
  const total      = Number(projectAmountDollars) || 0;
  const retainer   = total * (PLATFORM_FEES.retainerPct / 100);
  const final      = total - retainer;
  const creatorPct = creatorFeePctOverride != null ? creatorFeePctOverride : PLATFORM_FEES.creatorFeePct;
  const clientPct  = clientFeePctOverride != null ? clientFeePctOverride : PLATFORM_FEES.clientFeePct;

  const clientFeeRetainer  = retainer  * (clientPct / 100);
  const clientFeeFinal     = final     * (clientPct / 100);
  const creatorFeeRetainer = retainer  * (creatorPct / 100);
  const creatorFeeFinal    = final     * (creatorPct / 100);

  return {
    // Dollar amounts (for display)
    projectTotal:          total,
    retainerAmount:        retainer,
    finalAmount:           final,
    clientFeeRetainer,
    clientFeeFinal,
    creatorFeeRetainer,
    creatorFeeFinal,
    retainerClientOwes:    retainer + clientFeeRetainer,
    finalClientOwes:       final    + clientFeeFinal,
    retainerCreatorGets:   retainer - creatorFeeRetainer,
    finalCreatorGets:      final    - creatorFeeFinal,
    totalClientPays:       total + clientFeeRetainer + clientFeeFinal,
    totalCreatorReceives:  total - creatorFeeRetainer - creatorFeeFinal,
    platformRevenue:       clientFeeRetainer + clientFeeFinal + creatorFeeRetainer + creatorFeeFinal,

    // Cent amounts (for Stripe — always integers)
    retainerAmountCents:       Math.round(retainer   * 100),
    finalAmountCents:          Math.round(final       * 100),
    retainerClientOwesCents:   Math.round((retainer + clientFeeRetainer)  * 100),
    finalClientOwesCents:      Math.round((final    + clientFeeFinal)     * 100),
    creatorFeeRetainerCents:   Math.round(creatorFeeRetainer * 100),
    creatorFeeFinalCents:      Math.round(creatorFeeFinal    * 100),
    clientFeeRetainerCents:    Math.round(clientFeeRetainer  * 100),
    clientFeeFinalCents:       Math.round(clientFeeFinal     * 100),
    // application_fee_amount = what the platform keeps from each payment
    retainerAppFeeCents:       Math.round((clientFeeRetainer + creatorFeeRetainer) * 100),
    finalAppFeeCents:          Math.round((clientFeeFinal    + creatorFeeFinal)    * 100),
  };
}

/** Format cents to dollar string: 150000 -> "$1,500.00" */
export function centsToDisplay(cents) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format dollars to display string */
export function dollarsToDisplay(dollars) {
  return `$${Number(dollars).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Simplified 3-rule cancellation policy.
 *
 * Rule 1 — Before work begins: creator keeps 25% (cancellation fee).
 *   Applies when: project accepted but creator has not started work yet.
 *
 * Rule 2 — After work begins: creator keeps 50% of project total.
 *   Applies when: creator has actively started production (in_progress / revision).
 *
 * Rule 3 — After delivery: no refund. Creator keeps 100%.
 *   Applies when: work has been delivered or approved.
 */
export const CANCELLATION_RULES = [
  {
    id:       'before_work',
    label:    'Before Work Begins',
    keepPct:  25,
    description: 'Creator keeps 25% as a cancellation fee. Client receives a 75% refund.',
    applies:  ['open', 'accepted', 'retainer_paid'],
  },
  {
    id:       'after_work_begins',
    label:    'After Work Begins',
    keepPct:  50,
    description: 'Creator keeps 50% of the project total. Client receives a 50% refund.',
    applies:  ['in_progress', 'revision'],
  },
  {
    id:       'after_delivery',
    label:    'After Delivery',
    keepPct:  100,
    description: 'No refund once work has been delivered. Creator retains full payment.',
    applies:  ['delivered', 'approved', 'final_paid'],
  },
];

/** Keep backward-compatible CANCELLATION_FEES shape for any component reading it */
export const CANCELLATION_FEES = {
  before_acceptance:  0,
  after_acceptance:   25,
  after_retainer:     25,
  work_in_progress:   50,
  after_delivery:     100,
};

/** Returns the cancellation rule that applies to the given project status */
export function getCancellationRule(projectStatus) {
  return CANCELLATION_RULES.find(r => r.applies.includes(projectStatus))
    || CANCELLATION_RULES[0];
}

/** Map a project status to the relevant cancellation stage (legacy compat) */
export function getCancellationStage(projectStatus) {
  switch (projectStatus) {
    case 'open':
    case 'accepted':
    case 'retainer_paid': return 'before_acceptance';
    case 'in_progress':
    case 'revision':      return 'work_in_progress';
    case 'delivered':
    case 'approved':      return 'after_delivery';
    default:              return 'before_acceptance';
  }
}

/**
 * Calculate how much the creator keeps (and client gets back) on cancellation.
 * @param {number} projectTotal - Full project value in dollars
 * @param {string} projectStatus - Current status of the project
 * @returns {{ rule: object, keepPct: number, creatorKeepsDollars: number, clientRefundDollars: number }}
 */
export function getCancellationFee(projectTotal, projectStatus) {
  const rule   = getCancellationRule(projectStatus);
  const total  = Number(projectTotal) || 0;
  const creatorKeepsDollars = (total * rule.keepPct) / 100;
  const clientRefundDollars = total - creatorKeepsDollars;
  return { rule, feePct: rule.keepPct, creatorKeepsDollars, clientRefundDollars };
}

/** Project status labels and badge colors */
export const PROJECT_STATUSES = {
  open:             { label: 'Open',                   color: 'gold'   },
  accepted:         { label: 'Awaiting Retainer',       color: 'gold'   },
  retainer_paid:    { label: 'Retainer Secured',        color: 'gold'   },
  in_progress:      { label: 'In Progress',             color: 'gold'   },
  delivered:        { label: 'Delivered, Awaiting Review', color: 'gold' },
  revision:         { label: 'Revision Requested',      color: 'gold'   },
  approved:         { label: 'Approved',                color: 'gold'   },
  final_paid:       { label: 'Payment Released',        color: 'gold'   },
  completed:        { label: 'Completed',               color: 'gold'   },
  disputed:         { label: 'Disputed',                color: 'red'    },
  cancelled:        { label: 'Cancelled',               color: 'gray'   },
};

export function statusBadgeClass(status, dark) {
  const colorMap = {
    gold:  'bg-gold-500/15 text-gold-400 border border-gold-500/20',
    teal:  'bg-gold-500/15 text-gold-400 border border-gold-500/20',
    blue:  'bg-gold-500/15 text-gold-400 border border-gold-500/20',
    amber: 'bg-gold-500/15 text-gold-400 border border-gold-500/20',
    green: 'bg-gold-500/15 text-gold-400 border border-gold-500/20',
    red:   'bg-red-500/15 text-red-400',
    gray:  dark ? 'bg-charcoal-700/50 text-charcoal-300 border border-white/[0.06]' : 'bg-gray-100 text-gray-500',
  };
  const s = PROJECT_STATUSES[status];
  return s ? colorMap[s.color] : colorMap.gray;
}
