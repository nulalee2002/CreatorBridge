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

check('Auth route protection', 'src/App.jsx', [
  { label: 'protected route wrapper exists', test: includes('function AuthRequired') },
  { label: 'creator dashboard requires auth', test: includes('Sign in to manage your creator account') },
  { label: 'client profile requires auth', test: includes('Sign in to manage your client profile') },
  { label: 'messages require auth', test: includes('Sign in to view messages') },
  { label: 'checkout requires auth', test: includes('Sign in before payment') },
]);

checks.push(
  { name: 'Shared input sanitizer exists', pass: fileExists('src/utils/inputSecurity.js')(), path: 'src/utils/inputSecurity.js' },
);

check('Message abuse prevention', 'src/pages/MessagesPage.jsx', [
  { label: 'sanitizes typed message text before storage', test: includes('sanitizeLongText(text, 1500)') },
  { label: 'filters new conversation starter text', test: includes('checkMessage(cleanMessage)') },
  { label: 'stores cleaned initial conversation text', test: matches(/text:\s*cleanText/) },
]);

check('Project board input hardening', 'src/pages/ProjectBoard.jsx', [
  { label: 'sanitizes posted project title', test: includes('sanitizePlainText(form.title, 120)') },
  { label: 'sanitizes posted project description', test: includes('sanitizeLongText(form.description, 4000)') },
  { label: 'blocks contact info in creator proposals', test: includes('checkMessage(cleanProposal)') },
]);

check('Network input hardening', 'src/pages/NetworkingPage.jsx', [
  { label: 'sanitizes network post content', test: includes('sanitizeLongText(postContent, 500)') },
  { label: 'uses shared contact filter for posts', test: includes('checkMessage(cleanContent)') },
  { label: 'sanitizes live chat messages', test: includes('sanitizeLongText(chatInput, 300)') },
]);

check('Quote and chatbot input hardening', 'src/components/RequestQuoteModal.jsx', [
  { label: 'sanitizes quote project title', test: includes('sanitizePlainText(form.projectTitle, 120)') },
  { label: 'sanitizes quote description', test: includes('sanitizeLongText(form.description, 4000)') },
  { label: 'sanitizes quote request before local and remote storage', test: includes('const cleanForm = buildCleanQuoteForm()') },
]);

check('Chatbot input hardening', 'src/components/SupportChatbot.jsx', [
  { label: 'sanitizes booking records before storage', test: includes('const cleanBookingData = sanitizeBookingData(bookingData)') },
  { label: 'sanitizes free text chat input', test: includes('sanitizeLongText(input, 1500)') },
  { label: 'keeps AI prompt input bounded and cleaned', test: includes('content: sanitizeLongText(m.content, 1500)') },
  { label: 'injects system prompt into future assistant calls', test: includes("{ role: 'system', content: SYSTEM_PROMPT }") },
  { label: 'limits assistant history sent to future AI calls', test: includes('ASSISTANT_HISTORY_LIMIT') },
  { label: 'blocks prompt injection requests', test: includes('isPromptInjectionAttempt(text)') },
  { label: 'blocks contact info in chatbot booking and quote text', test: includes('blockUnsafeText(text, `chatbot_booking_${def.field}`)') },
]);

check('Payment function hardening', 'supabase/functions/create-payment-intent/index.ts', [
  { label: 'verifies authenticated client owns the payment request', test: includes('authData.user.id !== clientId') },
  { label: 'verifies project ownership from Supabase', test: includes('Project ownership could not be verified') },
  { label: 'requires an accepted creator before payment', test: includes('A creator must be accepted for this project before payment') },
  { label: 'uses creator Stripe account from listing only', test: includes('const trustedCreatorStripeAccountId = listing?.stripe_account_id') },
  { label: 'does not trust browser supplied creatorStripeAccountId', test: notIncludes('creatorStripeAccountId,') },
  { label: 'does not use Stripe destination charges for protected payments', test: notIncludes('transfer_data') },
  { label: 'uses Stripe idempotency keys for payment creation', test: includes('idempotencyKey') },
  { label: 'calculates trusted Stripe charge and platform fee server side', test: includes('calculateTrustedFees') },
]);

check('Stripe webhook completion path', 'supabase/functions/stripe-webhook/index.ts', [
  { label: 'marks final-paid projects complete after Stripe success', test: includes('markProjectCompleted') },
  { label: 'releases creator payout after confirmed final payment', test: includes('releaseCreatorPayout') },
  { label: 'records Stripe event ids to prevent replay processing', test: includes('stripe_event_id') },
  { label: 'issues referral rewards after completed paid work', test: includes('issueReferralRewards') },
  { label: 'consumes client fee waiver after retainer payment', test: includes('consumeClientFeeWaiver') },
  { label: 'supports creator one-project fee reduction reward', test: includes("referral.reward_type === 'fee_reduction'") },
]);

check('Payment release hardening', 'supabase/functions/release-payment/index.ts', [
  { label: 'requires authenticated client or trusted job secret', test: includes('PLATFORM_JOB_SECRET') },
  { label: 'verifies the paying client before release', test: includes('Only the paying client can release this payment') },
  { label: 'requires both payments before payout release', test: includes('Both retainer and final payment must be paid') },
  { label: 'uses Stripe idempotency key for payout transfer', test: includes('idempotencyKey') },
]);

check('Supabase schema source', 'supabase/schema.sql', [
  { label: 'profile referral code is stored', test: includes('referral_code text unique') },
  { label: 'client fee waiver flags are stored on profiles', test: includes('first_booking_fee_waived boolean') },
  { label: 'creator one-project fee reduction column exists', test: includes('next_project_fee_pct numeric') },
  { label: 'referral reward completion transaction is tracked', test: includes('completed_transaction_id uuid') },
  { label: 'policies are idempotent with drop and create pattern', test: includes('DROP POLICY IF EXISTS') },
  { label: 'public listing browse is limited to approved listings', test: includes('Approved listings are viewable by everyone') },
  { label: 'public project browse is limited to open projects', test: includes('Open projects viewable by everyone') },
  { label: 'project participants retain private project access', test: includes('Project participants can view projects') },
  { label: 'transactions are not client-insertable', test: source => !/CREATE POLICY "Users can insert transactions"/.test(source) },
]);

check('Marketplace RLS tightening', 'supabase/migrations/20260514094138_tighten_marketplace_rls.sql', [
  { label: 'limits public creator listing browse to approved listings', test: includes('Approved listings are viewable by everyone') },
  { label: 'allows creators to view their own listings', test: includes('Creators can view own listings') },
  { label: 'limits public project browse to open projects', test: includes('Open projects viewable by everyone') },
  { label: 'allows project participants to view private project records', test: includes('Project participants can view projects') },
  { label: 'drops direct client transaction insert policy', test: includes('drop policy if exists "Users can insert transactions"') },
]);

check('Supabase storage hardening', 'supabase/migrations/20260514115348_secure_storage_foundation.sql', [
  { label: 'keeps creator portfolio uploads private', test: matches(/'creator-portfolio'[\s\S]*false/) },
  { label: 'keeps project delivery uploads private', test: matches(/'project-deliveries'[\s\S]*false/) },
  { label: 'requires user id folder ownership for uploads', test: includes('(storage.foldername(name))[1] = (select auth.uid())::text') },
  { label: 'allows upsert only with own-object update policy', test: includes('Users can update own CreatorBridge storage objects') },
  { label: 'prevents cross-account object deletion', test: includes('Users can delete own CreatorBridge storage objects') },
]);

check('Storage readiness docs', 'docs/ENVIRONMENT_READINESS.md', [
  { label: 'documents private user upload buckets', test: includes('CreatorBridge user uploads must stay private by default') },
  { label: 'documents signed URL requirement before broad file access', test: includes('signed URLs or a server function') },
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
