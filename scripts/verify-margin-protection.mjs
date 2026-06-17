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
const feesConfig = readFileSync(join(root, 'src/config/fees.js'), 'utf8');
const marginsConfig = readFileSync(join(root, 'src/config/margins.js'), 'utf8');
const requestQuoteModal = readFileSync(join(root, 'src/components/RequestQuoteModal.jsx'), 'utf8');
const supportChatbot = readFileSync(join(root, 'src/components/SupportChatbot.jsx'), 'utf8');
const packageBuilder = readFileSync(join(root, 'src/components/PackageBuilder.jsx'), 'utf8');
const projectBoard = readFileSync(join(root, 'src/pages/ProjectBoard.jsx'), 'utf8');
const projectStorage = readFileSync(join(root, 'src/utils/projectStorage.js'), 'utf8');

const clientNote = "Projects on CreatorBridge start at $250. Every booking is backed by secure escrow payment and dispute protection, and the minimum keeps each project worth a verified creator's time and those protections viable for both sides.";
const clientError = "Projects start at $250 on CreatorBridge. Please set your budget to $250 or more so your project is worth a professional creator's time and fully covered by our protected payment process.";
const creatorNote = "CreatorBridge projects start at $250. Set your packages and proposals at $250 or more, it keeps your work worth your time and keeps the escrow and payment protection viable on every booking.";
const creatorError = "Packages and proposals start at $250 on CreatorBridge. Please set this at $250 or more.";

assert(
  allMigrations.includes('create table if not exists public.platform_margin_settings'),
  'Platform margin settings table must exist'
);
assert(allMigrations.includes('minimum_project_budget_cents integer not null default 25000'), 'Default project floor must be $250');
assert(allMigrations.includes('minimum_platform_fee_cents integer not null default 500'), 'Default platform fee floor must be $5');
assert(allMigrations.includes('create or replace function public.get_platform_margin_settings()'), 'Settings read RPC must exist');
assert(allMigrations.includes('create or replace function public.create_project_brief'), 'create_project_brief must be overridden');
assert(allMigrations.includes('create or replace function public.submit_quote_request'), 'submit_quote_request must be overridden');
assert(allMigrations.includes('create or replace function public.apply_to_project'), 'apply_to_project must be overridden');
assert(allMigrations.includes('create or replace function public.enforce_package_margin_floor()'), 'Package price trigger must enforce the floor');
assert(allMigrations.includes('create or replace function public.enforce_listing_margin_floor()'), 'Creator listing minimum trigger must enforce the floor');
assert(
  allMigrations.includes('Projects start at $250 on CreatorBridge. Please set your budget to $250 or more') &&
    allMigrations.includes('fully covered by our protected payment process.'),
  'Client-facing server rejection copy must be present in migration'
);
assert(allMigrations.includes(creatorError), 'Creator-facing server rejection copy must be present in migration');
assert(allMigrations.includes('minimum_platform_fee_applied'), 'Transactions must record when the fee floor added protection');

assert(
  createPaymentIntent.includes('loadPlatformMarginSettings') &&
  createPaymentIntent.includes('minimumProjectBudgetCents') &&
  createPaymentIntent.includes('minimumPlatformFeeCents'),
  'Checkout must load admin-configured margin settings'
);
assert(createPaymentIntent.includes('trustedProjectAmountCents < marginSettings.minimumProjectBudgetCents'), 'Checkout must reject projects below the budget floor');
assert(createPaymentIntent.includes('minimumPlatformFeeAppliedCents'), 'Checkout must calculate the minimum fee top-up');
assert(createPaymentIntent.includes('creator_fee_before_credit') && createPaymentIntent.includes('creator_credit_applied'), 'Creator credit ledger math must stay intact');
assert(
  createPaymentIntent.includes('trustedClientFeePct = profile?.first_booking_fee_waived || profile?.next_booking_fee_waived ? 0 : 5'),
  'Client invite waiver must still waive only the client fee'
);

assert(feesConfig.includes('minProjects: 0') && feesConfig.includes('feePct: 10'), 'Starter loyalty tier must remain at 10%');
assert(feesConfig.includes('minProjects: 10') && feesConfig.includes('feePct: 8'), '10-booking loyalty tier must remain at 8%');
assert(feesConfig.includes('minProjects: 25') && feesConfig.includes('feePct: 6'), '25-booking loyalty tier must remain at 6%');

assert(marginsConfig.includes(clientNote), 'Client minimum-budget note must live in shared margin copy');
assert(marginsConfig.includes(clientError), 'Client minimum-budget rejection must live in shared margin copy');
assert(marginsConfig.includes(creatorNote), 'Creator minimum-budget note must live in shared margin copy');
assert(marginsConfig.includes(creatorError), 'Creator minimum-budget rejection must live in shared margin copy');
for (const source of [requestQuoteModal, projectBoard]) {
  assert(source.includes('CLIENT_MINIMUM_PROJECT_NOTE'), 'Client minimum-budget note must be shown in client-facing budget UI');
  assert(source.includes('CLIENT_MINIMUM_PROJECT_ERROR'), 'Client minimum-budget rejection must be wired into client-facing budget UI');
}
for (const source of [packageBuilder, projectBoard]) {
  assert(source.includes('CREATOR_MINIMUM_PROJECT_NOTE'), 'Creator minimum-budget note must be shown in creator-facing pricing UI');
  assert(source.includes('CREATOR_MINIMUM_PROJECT_ERROR'), 'Creator minimum-budget rejection must be wired into creator-facing pricing UI');
}
assert(supportChatbot.includes('CLIENT_MINIMUM_PROJECT_ERROR'), 'Chatbot booking path must reject below-floor budgets');
assert(projectStorage.includes('MINIMUM_PROJECT_BUDGET_DOLLARS'), 'Local project fallback must use the platform floor');

const projectAmountCents = 25000;
const goldCreatorFeeCents = Math.round(projectAmountCents * 0.06);
const retainerChargeCents = Math.round(projectAmountCents * 0.5);
const finalChargeCents = projectAmountCents - retainerChargeCents;
const stripeFeesCents =
  Math.round(retainerChargeCents * 0.029 + 30) +
  Math.round(finalChargeCents * 0.029 + 30);
assert(goldCreatorFeeCents - stripeFeesCents > 0, 'A $250 Gold booking with client fee waived must still clear Stripe processing costs');

console.log(JSON.stringify({
  ok: true,
  platformMinimumProjectBudgetCents: 25000,
  minimumPlatformFeeCents: 500,
  goldWaivedClientFeeNetAfterStripeCents: goldCreatorFeeCents - stripeFeesCents,
  serverFloors: ['create_project_brief', 'submit_quote_request', 'apply_to_project', 'packages', 'creator_listings', 'checkout'],
  loyaltyTiersUntouched: true,
  referralWaiverUntouched: true,
}, null, 2));
