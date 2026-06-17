import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'supabase/migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter(name => name.endsWith('.sql'))
  .map(name => [name, readFileSync(join(migrationsDir, name), 'utf8')]);
const allMigrations = migrationFiles.map(([, source]) => source).join('\n');

const createPaymentIntent = readFileSync(join(root, 'supabase/functions/create-payment-intent/index.ts'), 'utf8');
const releasePayment = readFileSync(join(root, 'supabase/functions/release-payment/index.ts'), 'utf8');
const stripeWebhook = readFileSync(join(root, 'supabase/functions/stripe-webhook/index.ts'), 'utf8');
const referralSection = readFileSync(join(root, 'src/components/ReferralSection.jsx'), 'utf8');
const supportChatbot = readFileSync(join(root, 'src/components/SupportChatbot.jsx'), 'utf8');
const termsPage = readFileSync(join(root, 'src/pages/TermsOfService.jsx'), 'utf8');
const termsModal = readFileSync(join(root, 'src/components/TermsModal.jsx'), 'utf8');

assert(
  allMigrations.includes('create table if not exists referral_program_settings'),
  'Referral program settings table must exist for admin-configurable conservative defaults'
);
assert(
  allMigrations.includes('create table if not exists referral_rewards'),
  'Referral reward ledger must exist'
);
assert(
  allMigrations.includes('create table if not exists creator_credit_ledger'),
  'Creator platform-fee credit ledger must exist'
);
assert(
  allMigrations.includes('creator_credit_applied'),
  'Transactions must record applied creator credit'
);
assert(
  allMigrations.includes('unique (referred_client_id)'),
  'Referral rewards must be one reward per referred client'
);
assert(
  allMigrations.includes('grant_referral_credit_for_released_transaction'),
  'A database grant function must enforce exact-once referral credits after release'
);
assert(
  allMigrations.includes("status in ('pending_review', 'granted', 'rejected')"),
  'Referral reward statuses must include pending review, granted, and rejected'
);

assert(
  createPaymentIntent.includes('applyCreatorCredit') &&
  createPaymentIntent.includes('creator_credit_applied') &&
  createPaymentIntent.includes('creator_fee_before_credit'),
  'create-payment-intent must apply creator credit to future creator fees and record before/after amounts'
);
assert(
  createPaymentIntent.includes('Math.min(availableCreditCents, creatorFeeBeforeCreditCents)') ||
    createPaymentIntent.includes('Math.min(availableCreditCents, baseCreatorFeeAmountCents)'),
  'Creator credit must never exceed the creator fee'
);
assert(
  createPaymentIntent.includes('trustedClientFeePct = profile?.first_booking_fee_waived || profile?.next_booking_fee_waived ? 0 : 5'),
  'Client first-booking waiver must stay on the client fee only'
);
assert(
  createPaymentIntent.includes('creatorFeePctFor(listing.completed_projects, listing.next_project_fee_pct)'),
  'Creator loyalty fee math must remain sourced from completed projects'
);

assert(
  releasePayment.includes("rpc('grant_referral_credit_for_released_transaction'") &&
  stripeWebhook.includes("rpc('grant_referral_credit_for_released_transaction'"),
  'Referral credit grant must run after released payments in both release paths'
);
assert(
  stripeWebhook.includes('consumeAppliedCreatorCredit') &&
  stripeWebhook.includes("source: 'creator_fee_offset'") &&
  !createPaymentIntent.includes("source: 'creator_fee_offset'"),
  'Creator credit must be consumed only after a successful payment, not when the payment intent is created'
);
assert(
  !stripeWebhook.includes("reward_type === 'tier_boost'") &&
  !stripeWebhook.includes("reward_type === 'fee_reduction'"),
  'Old creator-to-creator or loyalty-like referral rewards must be removed'
);

const forbiddenCopy = [
  'affiliate',
  'ambassador',
  'downline',
  'passive income',
  'lifetime commission',
  'recurring commission',
  'fee drops from 10% to 7%',
  'refer a Creator',
  '3% of completed project value',
];
const publicCopy = [referralSection, supportChatbot, termsPage, termsModal].join('\n').toLowerCase();
for (const phrase of forbiddenCopy) {
  assert(!publicCopy.includes(phrase.toLowerCase()), `Forbidden invite-program language remains: ${phrase}`);
}

const policyLine = 'CreatorBridge does not pay rewards for signups, referrals of other creators, or recruiting activity. Credits are tied only to completed client projects.';
assert(referralSection.includes(policyLine), 'Referral section must show the policy line');
assert(termsPage.includes(policyLine), 'Terms page must show the policy line');
assert(termsModal.includes(policyLine), 'Terms modal must show the policy line');
assert(
  referralSection.includes('Invite new clients to book through CreatorBridge. New clients may receive a first-booking credit, and creators may receive a platform credit after a completed project.'),
  'Referral section must use the boring work-based invite copy'
);

console.log(JSON.stringify({
  ok: true,
  migrationRulesPresent: true,
  creatorCreditOffsetsFutureCreatorFee: true,
  clientFeeWaiverRemainsClientOnly: true,
  creditGrantAfterReleaseInBothPaths: true,
  pyramidRiskCopyRemoved: true,
}, null, 2));
