export const PLATFORM_FEES = {
  creatorFeePct:     10,   // 10% taken from creator's earnings (Launch tier)
  clientFeePct:       5,   // 5% added on top of client's payment
  retainerPct:       50,   // 50% retainer upfront, 50% on delivery
  autoApproveDays:    5,   // Five-day review window; approval, revision, or dispute action pauses automatic release.
  cancellationFeePct: 25,  // After retainer paid, cancellation splits the retainer: creator keeps 25% of the total (half the retainer), client refunded 25%
};

/** Loyalty tiers based on completed projects */
export const LOYALTY_TIERS = [
  { name: 'Launch',    minProjects: 0,  maxProjects: 9,        feePct: 10, badge: null },
  { name: 'Proven',    minProjects: 10, maxProjects: 24,       feePct: 8,  badge: 'silver' },
  { name: 'Signature', minProjects: 25, maxProjects: 49,       feePct: 6,  badge: 'gold' },
  { name: 'Elite',     minProjects: 50, maxProjects: Infinity, feePct: 6,  badge: 'gold' },
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

  // Client booking fee is charged once, on completion (the final payment), the
  // full clientPct of the whole project total, with nothing added to the retainer.
  const clientFeeRetainer  = 0;
  const clientFeeFinal     = total     * (clientPct / 100);
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

    // Cent amounts (for Stripe, always integers)
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
 * Cancellation policy. Only the retainer is ever collected before completion, so
 * cancellation only ever concerns the retainer. keepPct is expressed as a
 * percentage of the full project TOTAL.
 *
 * Rule 1, Before the retainer is paid: either party may cancel at no cost.
 *   Nothing has been charged. (open / accepted)
 *
 * Rule 2, After the retainer is paid, any time before delivery (including
 *   mid-project): the 50% retainer is split evenly, the creator keeps 25% of the
 *   total (half the retainer) and the client is refunded 25% of the total (the
 *   other half). No platform fees apply, because fees are only charged on
 *   successful completion. (retainer_paid / in_progress / revision)
 *
 * Rule 3, After delivery: no cancellation and no refund; the project proceeds to
 *   final payment. (delivered / approved / final_paid)
 */
export const CANCELLATION_RULES = [
  {
    id:       'before_retainer',
    label:    'Before Retainer Paid',
    keepPct:  0,
    description: 'Either party may cancel at no cost. No money has changed hands.',
    applies:  ['open', 'accepted'],
  },
  {
    id:       'after_retainer',
    label:    'After Retainer Paid',
    keepPct:  25,
    description: 'The 50% retainer is split evenly: the creator keeps 25% of the project total and the client is refunded 25% of the total. No platform fees apply.',
    applies:  ['retainer_paid', 'in_progress', 'revision'],
  },
  {
    id:       'after_delivery',
    label:    'After Delivery',
    keepPct:  50,
    description: 'No refund once work has been delivered. The retainer stays with the creator and the project proceeds to final payment.',
    applies:  ['delivered', 'approved', 'final_paid'],
  },
];

/** Keep backward-compatible CANCELLATION_FEES shape (creator-keep % of total) */
export const CANCELLATION_FEES = {
  before_acceptance:  0,
  after_acceptance:   0,
  after_retainer:     25,
  work_in_progress:   25,
  after_delivery:     50,
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
    case 'accepted':      return 'before_acceptance';
    case 'retainer_paid': return 'after_retainer';
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
  // The client can only be refunded from what they have actually paid, the
  // retainer (50% of total). Before the retainer is paid, nothing has changed
  // hands, so the refund is 0.
  const retainerPaidDollars = rule.id === 'before_retainer'
    ? 0
    : (total * PLATFORM_FEES.retainerPct) / 100;
  const clientRefundDollars = Math.max(0, retainerPaidDollars - creatorKeepsDollars);
  return { rule, feePct: rule.keepPct, creatorKeepsDollars, clientRefundDollars };
}

/** Project status labels and badge colors */
export const PROJECT_STATUSES = {
  open:             { label: 'Open',                   color: 'gold'   },
  rebook_draft:     { label: 'Rebooking Draft',        color: 'gray'   },
  rebook_pending:   { label: 'Rebooking Confirmation', color: 'gold'   },
  accepted:         { label: 'Awaiting Retainer',       color: 'gold'   },
  retainer_paid:    { label: 'Retainer Secured',        color: 'gold'   },
  in_progress:      { label: 'In Progress',             color: 'gold'   },
  delivered:        { label: 'Delivered, Awaiting Review', color: 'gold' },
  revision:         { label: 'Revision Requested',      color: 'gold'   },
  approved:         { label: 'Approved',                color: 'gold'   },
  final_payment_processing: { label: 'Final Payment Processing', color: 'gold' },
  final_payment_attention:  { label: 'Payment Needs Attention',  color: 'red' },
  final_paid:       { label: 'Final Payment Confirmed',  color: 'gold'   },
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
