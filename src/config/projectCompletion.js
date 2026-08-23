export const INCLUDED_REVISIONS = 2;
export const PAID_REVISION_PRICE_CENTS = 5_000;
export const DELIVERY_DIRECT_LIMIT_BYTES = 5_000_000_000;
export const REVIEW_WINDOW_HOURS = 120;
export const DOWNLOAD_RETENTION_DAYS = 7;

export function creatorFeePctForCompletedProjects(completedProjects) {
  const completed = Math.max(0, Number(completedProjects) || 0);
  if (completed >= 25) return 6;
  if (completed >= 10) return 8;
  return 10;
}

export function calculatePaidRevisionSplit(completedProjects) {
  const creatorFeePct = creatorFeePctForCompletedProjects(completedProjects);
  const creatorFeeCents = Math.round(PAID_REVISION_PRICE_CENTS * creatorFeePct / 100);
  const creatorNetCents = PAID_REVISION_PRICE_CENTS - creatorFeeCents;

  return {
    clientChargeCents: PAID_REVISION_PRICE_CENTS,
    clientFeeCents: 0,
    creatorFeePct,
    creatorFeeCents,
    creatorNetCents,
    platformRevenueCents: creatorFeeCents,
  };
}
