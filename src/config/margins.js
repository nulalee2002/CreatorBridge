export const MINIMUM_PROJECT_BUDGET_DOLLARS = 250;
export const MINIMUM_PLATFORM_FEE_CENTS = 500;

export const CLIENT_MINIMUM_PROJECT_NOTE =
  "Projects on CreatorBridge start at $250. Every booking is backed by secure escrow payment and dispute protection, and the minimum keeps each project worth a verified creator's time and those protections viable for both sides.";

export const CLIENT_MINIMUM_PROJECT_ERROR =
  "Projects start at $250 on CreatorBridge. Please set your budget to $250 or more so your project is worth a professional creator's time and fully covered by our protected payment process.";

export const CREATOR_MINIMUM_PROJECT_NOTE =
  'CreatorBridge projects start at $250. Set your packages and proposals at $250 or more, it keeps your work worth your time and keeps the escrow and payment protection viable on every booking.';

export const CREATOR_MINIMUM_PROJECT_ERROR =
  'Packages and proposals start at $250 on CreatorBridge. Please set this at $250 or more.';

export function isBelowMinimumProjectBudget(value) {
  const amount = Number(value);
  return !Number.isFinite(amount) || amount < MINIMUM_PROJECT_BUDGET_DOLLARS;
}
