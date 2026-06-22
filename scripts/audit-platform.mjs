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

check('Interactive accessibility contracts', 'src/components/auth/AuthModal.jsx', [
  { label: 'auth dialog close control has an accessible name', test: includes('aria-label="Close account access"') },
  { label: 'password visibility control has an accessible name', test: includes("aria-label={showPass ? 'Hide password' : 'Show password'}") },
]);

check('Creator profile accessibility contracts', 'src/pages/CreatorProfilePage.jsx', [
  { label: 'featured intro control has an accessible name', test: includes('aria-label="Watch featured intro"') },
  { label: 'intro modal close control has an accessible name', test: includes('aria-label="Close intro"') },
]);

check('Creator profile live listing resolution', 'src/pages/CreatorProfilePage.jsx', [
  { label: 'loads requested creator listing from Supabase', test: includes(".from('creator_listings')") },
  { label: 'queries the exact route listing id', test: includes(".eq('id', id)") },
  { label: 'resolves private storage media for display', test: includes('getStorageDisplayUrl') },
  { label: 'does not substitute demo data for unknown profile ids', test: includes('Profile unavailable') },
  { label: 'handles approved listings with no packages without crashing', test: includes('packages[0] || null') },
]);

check('Directory accessibility contracts', 'src/components/CreatorDirectory.jsx', [
  { label: 'creator sorting control has an accessible name', test: includes('aria-label="Sort creators"') },
]);

check('Network accessibility contracts', 'src/pages/NetworkingPage.jsx', [
  { label: 'state selector has an accessible name', test: includes('aria-label="Choose another state"') },
]);

check('Smart Match reliability', 'src/utils/matchingAlgorithm.js', [
  { label: 'normalizes services before matching', test: includes('normalizeServiceId') },
  { label: 'excludes pending or unapproved creators', test: includes('isApprovedCreator') },
  { label: 'caps match percentages', test: includes('Math.min(99') },
  { label: 'can score Supabase-fetched creator availability maps', test: includes('availabilityMap') },
]);

check('Availability calendar hardening', 'src/components/AvailabilityCalendar.jsx', [
  { label: 'uses targeted availability upsert instead of broad replace', test: includes(".upsert(rows, { onConflict: 'listing_id,date' })") },
  { label: 'only deletes stale availability dates after successful save', test: includes('const staleDates') },
  { label: 'records availability source for synced data', test: includes('source,') },
]);

check('Creator dashboard availability completion', 'src/pages/CreatorDashboard.jsx', [
  { label: 'loads saved availability into dashboard profile state', test: includes('fetchAvailability') },
  { label: 'computes availability completion from real saved dates', test: includes("Object.keys(creator.availabilityMap || {}).length > 0") },
  { label: 'does not hard-code availability as incomplete', test: notIncludes("{ label: 'Availability set',             done: false }") },
]);

check('Creator dashboard contact protection', 'src/pages/CreatorDashboard.jsx', [
  { label: 'does not expose quote-request client email in the UI', test: notIncludes('{normalized.clientEmail}') },
  { label: 'does not create direct client mailto reply links', test: notIncludes('mailto:${normalized.clientEmail}') },
  { label: 'routes quote replies through platform messages', test: includes("params.set('with', quote.clientId)") },
  { label: 'routes profile corrections through in-platform reporting', test: includes('use Report an Issue and choose Account Access') },
]);

check('Google Calendar session sync', 'src/components/GoogleCalendarConnect.jsx', [
  { label: 'stores Google token in browser session storage', test: includes('sessionStorage.setItem') },
  { label: 'clears legacy local Google token on disconnect', test: includes('localStorage.removeItem(`gcal-token-${creatorId}`)') },
  { label: 'marks imported busy days as Google sourced', test: includes("source: 'google_busy'") },
]);

check('Availability database hardening', 'supabase/migrations/20260517101522_harden_availability_calendar_flow.sql', [
  { label: 'adds source tracking to availability rows', test: includes("source text not null default 'manual'") },
  { label: 'constrains allowed availability statuses', test: includes('availability_status_allowed') },
  { label: 'constrains allowed availability sources', test: includes('availability_source_allowed') },
  { label: 'keeps updated_at fresh on calendar edits', test: includes('set_availability_updated_at') },
]);

check('Checkout fee display', 'src/pages/CheckoutPage.jsx', [
  { label: 'uses loyalty tier fee percentage', test: includes('getLoyaltyTier') },
  { label: 'supports one-project creator referral fee reduction', test: includes('next_project_fee_pct') },
  { label: 'supports client referral booking fee waiver', test: includes('first_booking_fee_waived') },
  { label: 'sends payment type for retainer and final payments', test: includes('paymentType') },
]);

check('Checkout production lock', 'src/pages/CheckoutPage.jsx', [
  { label: 'blocks checkout when Stripe or Supabase is unavailable', test: includes('Secure checkout is temporarily unavailable') },
  { label: 'does not simulate payment success', test: notIncludes('Simulate Payment') },
  { label: 'does not create demo payment intent ids', test: notIncludes('demo_') },
  { label: 'does not write local payment transactions', test: notIncludes('cm-transactions') },
  { label: 'does not save browser-only payment records', test: notIncludes('saveLocalPaymentRecord') },
  { label: 'requires Supabase and Stripe before rendering card entry', test: includes('!stripeConfigured || !supabaseConfigured') },
]);

check('Auth route protection', 'src/App.jsx', [
  { label: 'protected route wrapper exists', test: includes('function AuthRequired') },
  { label: 'creator dashboard requires auth', test: includes('Sign in to manage your creator account') },
  { label: 'client profile requires auth', test: includes('Sign in to manage your client profile') },
  { label: 'messages require auth', test: includes('Sign in to view messages') },
  { label: 'checkout requires auth', test: includes('Sign in before payment') },
]);

checks.push(
  { name: 'Admin control hub page exists', pass: fileExists('src/pages/AdminDashboard.jsx')(), path: 'src/pages/AdminDashboard.jsx' },
);

check('Admin route protection', 'src/App.jsx', [
  { label: 'lazy loads admin dashboard', test: includes('AdminDashboard') },
  { label: 'registers protected admin route', test: includes('path="/admin"') },
  { label: 'uses owner-facing admin auth copy', test: includes('CreatorBridge admin visibility requires an authenticated owner account') },
]);

check('Admin dashboard access control', 'src/pages/AdminDashboard.jsx', [
  { label: 'checks database admin status before loading admin data', test: includes(".rpc('is_platform_admin'") },
  { label: 'loads admin platform summary through RPC', test: includes(".rpc('get_admin_platform_summary'") },
  { label: 'loads creator review queue through RPC', test: includes(".rpc('get_admin_creator_review_queue'") },
  { label: 'exposes creator review approval controls', test: includes('admin_approve_creator') },
  { label: 'exposes creator review rejection controls', test: includes('admin_reject_creator') },
  { label: 'exposes payment release action controls', test: includes('release-payment') },
]);

check('Admin database foundation', 'supabase/migrations/20260516235356_admin_control_hub_foundation.sql', [
  { label: 'creates separate admin roster instead of profile metadata authz', test: includes('create table if not exists public.platform_admins') },
  { label: 'seeds the CreatorBridge owner email as first admin', test: includes('drl33@creatorbridge.studio') },
  { label: 'creates admin check function', test: includes('create or replace function public.is_platform_admin') },
  { label: 'creates admin summary RPC', test: includes('create or replace function public.get_admin_platform_summary') },
  { label: 'creates creator review queue RPC', test: includes('create or replace function public.get_admin_creator_review_queue') },
  { label: 'grants admin RPCs only to authenticated users', test: includes('grant execute on function public.get_admin_platform_summary') },
  { label: 'adds admin read policy for creator listings', test: includes('Platform admins can read creator_listings') },
  { label: 'adds admin read policy for payment events', test: includes('Platform admins can read payment_events') },
]);

check('Creator collaboration authorization foundation', 'supabase/migrations/20260622212955_creator_capabilities_project_roles.sql', [
  { label: 'stores trusted account capabilities outside editable auth metadata', test: includes('create table if not exists public.account_capabilities') },
  { label: 'stores outside client, prime, and subcontractor project roles', test: includes("participant_role in ('outside_client', 'prime_contractor', 'subcontractor')") },
  { label: 'enables RLS on account capabilities', test: includes('alter table public.account_capabilities enable row level security') },
  { label: 'enables RLS on project participants', test: includes('alter table public.project_participants enable row level security') },
  { label: 'keeps authorization helpers in the private schema', test: includes('creatorbridge_private.has_account_capability') },
  { label: 'blocks ordinary users from granting capabilities', test: includes('revoke insert, update, delete on table public.account_capabilities from anon, authenticated') },
  { label: 'blocks ordinary users from writing project membership', test: includes('revoke insert, update, delete on table public.project_participants from anon, authenticated') },
]);

checks.push(
  { name: 'Shared input sanitizer exists', pass: fileExists('src/utils/inputSecurity.js')(), path: 'src/utils/inputSecurity.js' },
);

check('Message abuse prevention', 'src/pages/MessagesPage.jsx', [
  { label: 'sanitizes typed message text before storage', test: includes('sanitizeLongText(text, 1500)') },
  { label: 'filters new conversation starter text', test: includes('checkMessage(cleanMessage)') },
  { label: 'stores cleaned initial conversation text', test: matches(/text:\s*cleanText/) },
  { label: 'sends messages through Supabase RPC', test: includes(".rpc('send_creatorbridge_message'") },
  { label: 'does not directly insert messages from browser code', test: notIncludes(".from('messages')\n        .insert") },
]);

check('Privacy analytics boundary', 'src/pages/TermsPage.jsx', [
  { label: 'excludes private message contents from product analytics', test: includes('does not collect, read, or analyze direct-message or private-message contents') },
  { label: 'excludes creative files and external workspaces from analytics', test: includes('We do not analyze creative files or the contents of external project workspaces') },
  { label: 'limits platform intelligence to operational metadata', test: includes('actions, outcomes, categories, timings, and operational metadata') },
  { label: 'keeps automated filtering limited to safety enforcement', test: includes('message filtering remains limited to enforcing safety and contact-sharing rules') },
]);

check('Project board input hardening', 'src/pages/ProjectBoard.jsx', [
  { label: 'sanitizes posted project title', test: includes('sanitizePlainText(form.title, 120)') },
  { label: 'sanitizes posted project description', test: includes('sanitizeLongText(form.description, 4000)') },
  { label: 'blocks contact info in creator proposals', test: includes('checkMessage(cleanProposal)') },
  { label: 'submits client project briefs through Supabase RPC', test: includes("supabase.rpc('create_project_brief'") },
  { label: 'submits creator applications through Supabase RPC', test: includes("supabase.rpc('apply_to_project'") },
  { label: 'accepts project applications through Supabase RPC', test: includes("supabase.rpc('accept_project_application'") },
]);

check('Network input hardening', 'src/pages/NetworkingPage.jsx', [
  { label: 'sanitizes network post content', test: includes('sanitizeLongText(postContent, 500)') },
  { label: 'uses shared contact filter for posts', test: includes('checkMessage(cleanContent)') },
  { label: 'sanitizes live chat messages', test: includes('sanitizeLongText(chatInput, 300)') },
  { label: 'persists network replies through parent handler', test: includes('onReply?.(post.id, cleanReply)') },
  { label: 'loads stored network replies from Supabase', test: includes(".from('network_replies')") },
  { label: 'dedupes realtime chat inserts', test: includes('dedupeById([...prev, payload.new])') },
  { label: 'reports failed network post writes', test: includes('Network post could not be saved') },
]);

check('Quote and chatbot input hardening', 'src/components/RequestQuoteModal.jsx', [
  { label: 'sanitizes quote project title', test: includes('sanitizePlainText(form.projectTitle, 120)') },
  { label: 'sanitizes quote description', test: includes('sanitizeLongText(form.description, 4000)') },
  { label: 'sanitizes quote request before local and remote storage', test: includes('const cleanForm = buildCleanQuoteForm()') },
  { label: 'submits quote requests through Supabase RPC', test: includes("supabase.rpc('submit_quote_request'") },
]);

check('Chatbot input hardening', 'src/components/SupportChatbot.jsx', [
  { label: 'sanitizes booking records before storage', test: includes('const cleanBookingData = sanitizeBookingData(bookingData)') },
  { label: 'sanitizes free text chat input', test: includes('sanitizeLongText(input, 1500)') },
  { label: 'keeps AI prompt input bounded and cleaned', test: includes('content: sanitizeLongText(m.content, 1500)') },
  { label: 'injects system prompt into future assistant calls', test: includes("{ role: 'system', content: SYSTEM_PROMPT }") },
  { label: 'limits assistant history sent to future AI calls', test: includes('ASSISTANT_HISTORY_LIMIT') },
  { label: 'blocks prompt injection requests', test: includes('isPromptInjectionAttempt(text)') },
  { label: 'never auto-opens the chatbot on mobile or coarse touch screens', test: includes('setMobileNudge(true)') && includes('(pointer: coarse) and (max-width: 1024px)') },
  { label: 'blocks contact info in chatbot booking and quote text', test: includes('blockUnsafeText(text, `chatbot_booking_${def.field}`)') },
  { label: 'submits chatbot bookings through Supabase RPC', test: includes("supabase.rpc('submit_quote_request'") },
]);

check('Quote and booking database hardening', 'supabase/migrations/20260516143200_secure_quote_booking_flow.sql', [
  { label: 'creates authenticated project brief RPC', test: includes('create or replace function public.create_project_brief') },
  { label: 'creates authenticated quote request RPC', test: includes('create or replace function public.submit_quote_request') },
  { label: 'requires authenticated user before creating booking records', test: includes('v_user_id is null') },
  { label: 'removes direct quote request insert policy', test: includes('drop policy if exists "Authenticated clients can send quote requests"') },
  { label: 'removes broad project manage policy', test: includes('drop policy if exists "Clients can manage own projects"') },
  { label: 'grants creation RPCs only to authenticated users', test: includes('grant execute on function public.submit_quote_request') },
]);

check('Message database hardening', 'supabase/migrations/20260516170242_secure_message_send_flow.sql', [
  { label: 'creates authenticated message send RPC', test: includes('create or replace function public.send_creatorbridge_message') },
  { label: 'removes direct browser message insert policy', test: includes('drop policy if exists "Authenticated users can send messages"') },
  { label: 'requires authenticated sender before inserting messages', test: includes('v_user_id is null') },
  { label: 'blocks contact details in database layer', test: includes('Contact details must stay inside CreatorBridge until a booking is active') },
  { label: 'blocks written phone-number workarounds', test: includes('zero|one|two|three|four|five|six|seven|eight|nine') },
  { label: 'grants message send RPC only to authenticated users', test: includes('grant execute on function public.send_creatorbridge_message') },
]);

check('Network database hardening', 'supabase/migrations/20260517112238_harden_network_page_flow.sql', [
  { label: 'creates persisted network replies', test: includes('create table if not exists public.network_replies') },
  { label: 'enables RLS on network posts', test: includes('alter table public.network_posts enable row level security') },
  { label: 'enables RLS on network replies', test: includes('alter table public.network_replies enable row level security') },
  { label: 'keeps network posts publicly readable but filtered', test: includes('Anyone can view network posts') },
  { label: 'keeps network replies tied to visible posts', test: includes('Anyone can view replies') },
  { label: 'keeps likes unique per user and post', test: includes('unique(post_id, user_id)') },
  { label: 'refreshes like counts with trigger', test: includes('refresh_network_post_like_count') },
  { label: 'refreshes reply counts with trigger', test: includes('refresh_network_post_reply_count') },
  { label: 'hardens state chat messages with RLS', test: includes('alter table public.state_chat_messages enable row level security') },
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
  { label: 'grants invite credits only after completed paid work', test: includes('grant_referral_credit_for_released_transaction') },
  { label: 'consumes client fee waiver after retainer payment', test: includes('consumeClientFeeWaiver') },
  { label: 'consumes applied creator credit after successful payment', test: includes('consumeAppliedCreatorCredit') },
]);

check('Payment release hardening', 'supabase/functions/release-payment/index.ts', [
  { label: 'requires authenticated client or trusted job secret', test: includes('PLATFORM_JOB_SECRET') },
  { label: 'verifies the paying client or admin before release', test: includes('Only the paying client or a platform admin can release this payment') },
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

check('Project application flow hardening', 'supabase/migrations/20260516113000_secure_project_application_flow.sql', [
  { label: 'creates guarded project application RPC', test: includes('create or replace function public.apply_to_project') },
  { label: 'requires authenticated creator before applying', test: includes('v_user_id uuid := auth.uid()') },
  { label: 'verifies project is open before accepting applications', test: includes("This project is no longer accepting applications") },
  { label: 'verifies listing belongs to the active user', test: includes('and user_id = v_user_id') },
  { label: 'creates guarded application acceptance RPC', test: includes('create or replace function public.accept_project_application') },
  { label: 'verifies project owner before accepting application', test: includes('Only the project owner can accept an application') },
  { label: 'declines sibling pending applications after acceptance', test: includes("when status = 'pending' then 'declined'") },
  { label: 'grants project application RPC only to authenticated users', test: includes('grant execute on function public.apply_to_project') },
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
  { label: 'uses a date-versioned cache name', test: matches(/creatorbridge-v\d{4}-\d{2}-\d{2}/) },
  { label: 'supports immediate activation message', test: includes('SKIP_WAITING') },
  { label: 'refreshes navigations from network first', test: includes("fetch(request, { cache: 'reload' })") },
  { label: 'uses fresh cache after mobile icon refresh', test: includes('network-icons-v9') },
  { label: 'bypasses manifest and icon caching', test: includes("url.pathname === '/manifest.json'") && includes("url.pathname.startsWith('/icons/')") },
]);

check('PWA manifest integrity', 'public/manifest.json', [
  { label: 'references cache-busted 192 PNG app icon', test: includes('/icons/icon-192-v9.png') },
  { label: 'references cache-busted 512 PNG app icon', test: includes('/icons/icon-512-v9.png') },
  { label: 'keeps maskable icon for saved website installs', test: includes('"purpose": "maskable"') },
]);

checks.push(
  { name: 'PWA icon file exists: 192 v8 PNG', pass: fileExists('public/icons/icon-192-v8.png')(), path: 'public/icons/icon-192-v8.png' },
  { name: 'PWA icon file exists: 512 v8 PNG', pass: fileExists('public/icons/icon-512-v8.png')(), path: 'public/icons/icon-512-v8.png' },
  { name: 'PWA icon file exists: Apple touch v8 PNG', pass: fileExists('public/icons/apple-touch-icon-v8.png')(), path: 'public/icons/apple-touch-icon-v8.png' },
  { name: 'PWA icon file exists: 192 v9 PNG', pass: fileExists('public/icons/icon-192-v9.png')(), path: 'public/icons/icon-192-v9.png' },
  { name: 'PWA icon file exists: 512 v9 PNG', pass: fileExists('public/icons/icon-512-v9.png')(), path: 'public/icons/icon-512-v9.png' },
  { name: 'PWA icon file exists: Apple touch v9 PNG', pass: fileExists('public/icons/apple-touch-icon-v9.png')(), path: 'public/icons/apple-touch-icon-v9.png' },
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
