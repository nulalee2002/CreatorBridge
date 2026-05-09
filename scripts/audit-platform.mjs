import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

const checks = [];

function check(name, path, assertions) {
  const source = read(path);
  for (const assertion of assertions) {
    checks.push({
      name: `${name}: ${assertion.label}`,
      pass: assertion.test(source),
      path,
    });
  }
}

function includes(text) {
  return source => source.includes(text);
}

function matches(pattern) {
  return source => pattern.test(source);
}

function notIncludes(text) {
  return source => !source.includes(text);
}

function fileExists(path) {
  return () => existsSync(resolve(root, path));
}

check('Auth referral capture', 'src/contexts/AuthContext.jsx', [
  { label: 'reads stored referral code during signup', test: includes("sessionStorage.getItem('cm-referral-code')") },
  { label: 'passes referral_code into Supabase auth metadata', test: includes('referral_code: referralCode || undefined') },
]);

check('Creator approval gates', 'src/components/CreatorDirectory.jsx', [
  { label: 'keeps canPublish as a multi-condition gate', test: matches(/const\s+canPublish\s*=\s*[\s\S]*videoIntroMet[\s\S]*portfolioMet[\s\S]*aiOriginalWorkConfirm/) },
  { label: 'requires original work confirmation', test: includes('original work created by me') },
  { label: 'requires video intro during creator registration', test: includes('videoIntroUrl') },
  { label: 'hides unapproved creator listings from public browse', test: includes('review_status') },
]);

check('Guest contact protection', 'src/pages/CreatorProfilePage.jsx', [
  { label: 'keeps direct contact protection path', test: includes('contactUnlocked') },
  { label: 'prompts guests to create a client account', test: includes('Create a free client account to contact creators') },
]);

check('Smart Match reliability', 'src/utils/matchingAlgorithm.js', [
  { label: 'normalizes services before matching', test: includes('normalizeServiceId') },
  { label: 'excludes pending or unapproved creators', test: includes('isApprovedCreator') },
  { label: 'caps match percentages', test: includes('Math.min(99') },
]);

check('Checkout fee display', 'src/pages/CheckoutPage.jsx', [
  { label: 'uses loyalty tier fee percentage', test: includes('getLoyaltyTier') },
  { label: 'supports one-project creator referral fee reduction', test: includes('next_project_fee_pct') },
  { label: 'supports client referral booking fee waiver', test: includes('first_booking_fee_waived') },
  { label: 'sends payment type for retainer and final payments', test: includes('paymentType') },
]);

check('Payment function hardening', 'supabase/functions/create-payment-intent/index.ts', [
  { label: 'verifies authenticated client owns the payment request', test: includes('authData.user.id !== clientId') },
  { label: 'verifies project ownership from Supabase', test: includes('Project ownership could not be verified') },
  { label: 'verifies accepted creator before payment', test: includes('Creator is not accepted for this project') },
  { label: 'uses creator Stripe account from listing only', test: includes('const trustedCreatorStripeAccountId = listing?.stripe_account_id') },
  { label: 'does not trust browser supplied creatorStripeAccountId', test: notIncludes('creatorStripeAccountId,') },
  { label: 'calculates trusted Stripe charge and platform fee server side', test: includes('calculateTrustedFees') },
]);

check('Stripe webhook completion path', 'supabase/functions/stripe-webhook/index.ts', [
  { label: 'marks final-paid projects complete after Stripe success', test: includes('markProjectCompleted') },
  { label: 'issues referral rewards after completed paid work', test: includes('issueReferralRewards') },
  { label: 'consumes client fee waiver after retainer payment', test: includes('consumeClientFeeWaiver') },
  { label: 'supports creator one-project fee reduction reward', test: includes("referral.reward_type === 'fee_reduction'") },
]);

check('Supabase schema source', 'supabase/schema.sql', [
  { label: 'profile referral code is stored', test: includes('referral_code text unique') },
  { label: 'client fee waiver flags are stored on profiles', test: includes('first_booking_fee_waived boolean') },
  { label: 'creator one-project fee reduction column exists', test: includes('next_project_fee_pct numeric') },
  { label: 'referral reward completion transaction is tracked', test: includes('completed_transaction_id uuid') },
  { label: 'policies are idempotent with drop and create pattern', test: includes('DROP POLICY IF EXISTS') },
]);

check('Supabase migration package', 'supabase/migrations/20260508130000_prelaunch_platform_hardening.sql', [
  { label: 'migration file enables pgcrypto for gen_random_uuid', test: includes('create extension if not exists "pgcrypto"') },
  { label: 'migration file contains signup trigger hardening', test: includes('create or replace function handle_new_user()') },
  { label: 'migration file contains referral reward tracking', test: includes('completed_transaction_id uuid') },
  { label: 'migration file contains project workflow fields', test: includes('accepted_creator_id') },
  { label: 'migration file contains payment RLS refresh', test: includes('Participants can view payment events') },
]);

checks.push(
  { name: 'Backend release plan exists', pass: fileExists('docs/BACKEND_RELEASE_PLAN.md')(), path: 'docs/BACKEND_RELEASE_PLAN.md' },
);

check('QA account seed script', 'scripts/create-qa-accounts.mjs', [
  { label: 'uses creator domain alias', test: includes('drl33+creator@creatorbridge.studio') },
  { label: 'uses client domain alias', test: includes('drl33+client@creatorbridge.studio') },
  { label: 'requires service role for confirmed users', test: includes('SUPABASE_SERVICE_ROLE_KEY') },
  { label: 'seeds creator services', test: includes('creator_services') },
  { label: 'seeds creator portfolio', test: includes('portfolio_items') },
]);

checks.push(
  { name: 'QA test account plan exists', pass: fileExists('docs/QA_TEST_ACCOUNTS.md')(), path: 'docs/QA_TEST_ACCOUNTS.md' },
);

check('Deployment cache safety', 'vercel.json', [
  { label: 'service worker revalidates on deploy', test: includes('"source": "/sw.js"') },
  { label: 'hashed assets can be cached immutably', test: includes('"source": "/assets/(.*)"') },
]);

check('Service worker update safety', 'public/sw.js', [
  { label: 'uses a date-versioned cache name', test: includes('creatorbridge-v2026-05-08') },
  { label: 'supports immediate activation message', test: includes('SKIP_WAITING') },
  { label: 'refreshes navigations from network first', test: includes("fetch(request, { cache: 'reload' })") },
]);

check('PWA manifest integrity', 'public/manifest.json', [
  { label: 'does not reference missing PNG icons', test: notIncludes('.png') },
  { label: 'references existing 192 SVG icon', test: includes('/icons/icon-192.svg') },
  { label: 'references existing 512 SVG icon', test: includes('/icons/icon-512.svg') },
]);

checks.push(
  { name: 'PWA icon file exists: 192 SVG', pass: fileExists('public/icons/icon-192.svg')(), path: 'public/icons/icon-192.svg' },
  { name: 'PWA icon file exists: 512 SVG', pass: fileExists('public/icons/icon-512.svg')(), path: 'public/icons/icon-512.svg' },
);

const failed = checks.filter(check => !check.pass);

if (failed.length > 0) {
  console.error('\nCreatorBridge platform audit failed:\n');
  for (const item of failed) {
    console.error(`- ${item.name} (${item.path})`);
  }
  process.exit(1);
}

console.log(`CreatorBridge platform audit passed: ${checks.length} checks.`);
