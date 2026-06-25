export const COLLABORATION_MINIMUM_CENTS = 25000;
export const COLLABORATION_MINIMUM_PLATFORM_FEE_CENTS = 500;
export const ACH_PROCESSING_RATE = 0.008;
export const ACH_PROCESSING_CAP_CENTS = 500;

export function collaborationCreatorFeePct(completedExternalProjects = 0) {
  return completedExternalProjects >= 25 ? 6 : completedExternalProjects >= 10 ? 8 : 10;
}

export function calculateCollaborationFees(amountCents, completedExternalProjects = 0) {
  const amount = Math.max(0, Math.round(amountCents));
  const creatorFeePct = collaborationCreatorFeePct(completedExternalProjects);
  const platformFeeCents = Math.max(COLLABORATION_MINIMUM_PLATFORM_FEE_CENTS, Math.round(amount * creatorFeePct / 100));
  const processingCostCents = Math.min(ACH_PROCESSING_CAP_CENTS, Math.round(amount * ACH_PROCESSING_RATE));
  return { amountCents: amount, buyerFeeCents: 0, creatorFeePct, platformFeeCents, processingCostCents, primeChargeCents: amount + processingCostCents, collaboratorNetCents: amount - platformFeeCents };
}
