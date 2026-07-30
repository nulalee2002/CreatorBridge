import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = path => readFileSync(join(root, path), 'utf8');

const readinessModuleUrl = pathToFileURL(join(root, 'src/utils/creatorReadiness.js')).href;
const {
  creatorListingMeetsPublicRules,
  getPublicProfileReadiness,
  requiredPortfolioMediaType,
} = await import(`${readinessModuleUrl}?verify-public-readiness=1`);
const matchingModuleUrl = pathToFileURL(join(root, 'src/utils/matchingAlgorithm.js')).href;
const { scoreCreator } = await import(`${matchingModuleUrl}?verify-public-readiness=1`);

function completeVideoCreator(overrides = {}) {
  return {
    id: 'live-ready-video',
    avatar: 'storage://creator-portfolio/avatar.jpg',
    video_intro_url: 'bunny:intro-video-id',
    primary_pillar: 'video_production',
    sub_niches: ['vp_brand_films'],
    review_status: 'approved',
    verified: true,
    is_suspended: false,
    verification_status: 'verified',
    stripe_account_id: 'acct_test_ready',
    stripe_onboarded: true,
    payouts_enabled: true,
    portfolio_items: [
      { title: 'Brand film 1', description: 'Finished campaign edit.', service_id: 'vp_brand_films', media_type: 'video', bunny_video_id: 'v1' },
      { title: 'Brand film 2', description: 'Finished campaign edit.', service_id: 'vp_brand_films', media_type: 'video', bunny_video_id: 'v2' },
      { title: 'Brand film 3', description: 'Finished campaign edit.', service_id: 'vp_brand_films', media_type: 'video', bunny_video_id: 'v3' },
    ],
    packages: [{ name: 'Production day', price: 1200 }],
    ...overrides,
  };
}

const complete = completeVideoCreator();
assert(creatorListingMeetsPublicRules(complete), 'Complete video creator must pass the public readiness gate');

const missingIntro = completeVideoCreator({ video_intro_url: '' });
assert(!creatorListingMeetsPublicRules(missingIntro), 'Creator without Bunny intro video must not pass');

const missingPillar = completeVideoCreator({ primary_pillar: '' });
assert(!creatorListingMeetsPublicRules(missingPillar), 'Creator without primary pillar must not pass');

const missingPayoutReadiness = completeVideoCreator({
  stripe_account_id: null,
  stripe_onboarded: false,
  payouts_enabled: false,
});
assert(!creatorListingMeetsPublicRules(missingPayoutReadiness), 'Creator without completed payout onboarding must not pass');

const missingAdminApproval = completeVideoCreator({
  review_status: 'pending_review',
  verified: false,
});
assert(!creatorListingMeetsPublicRules(missingAdminApproval), 'Creator without admin approval must not pass');

const suspendedCreator = completeVideoCreator({ is_suspended: true });
assert(!creatorListingMeetsPublicRules(suspendedCreator), 'Suspended creator must not pass');

const mismatchedPortfolio = completeVideoCreator({
  portfolio_items: [
    { title: 'Photo 1', description: 'Wrong media for video.', service_id: 'vp_brand_films', media_type: 'image', image_url: 'storage://one.jpg' },
    { title: 'Photo 2', description: 'Wrong media for video.', service_id: 'vp_brand_films', media_type: 'image', image_url: 'storage://two.jpg' },
    { title: 'Photo 3', description: 'Wrong media for video.', service_id: 'vp_brand_films', media_type: 'image', image_url: 'storage://three.jpg' },
  ],
});
assert(!creatorListingMeetsPublicRules(mismatchedPortfolio), 'Video creator must not pass with photo-only portfolio samples');

const photoCreator = completeVideoCreator({
  id: 'live-ready-photo',
  primary_pillar: 'photography',
  sub_niches: ['ph_brand_commercial'],
  portfolio_items: [
    { title: 'Photo 1', description: 'Finished photo set.', service_id: 'ph_brand_commercial', media_type: 'image', image_url: 'storage://one.jpg' },
    { title: 'Photo 2', description: 'Finished photo set.', service_id: 'ph_brand_commercial', media_type: 'image', image_url: 'storage://two.jpg' },
    { title: 'Photo 3', description: 'Finished photo set.', service_id: 'ph_brand_commercial', media_type: 'image', image_url: 'storage://three.jpg' },
  ],
});
assert(creatorListingMeetsPublicRules(photoCreator), 'Photography creator must pass with image portfolio samples');
assert(requiredPortfolioMediaType('post_production', 'pp_photo_retouch') === 'image', 'Photo retouching portfolio samples must be image-based');

const readiness = getPublicProfileReadiness(complete);
assert(readiness.profilePhotoMet && readiness.introVideoMet && readiness.portfolioMet && readiness.packagesMet && readiness.approvalMet && readiness.notSuspended && readiness.verificationMet && readiness.payoutReadyMet, 'Readiness details must expose each gate');

const matchableCreator = completeVideoCreator({
  rating: 4.9,
  completion_rate: 100,
  availability: 'available',
});
const signatureScore = scoreCreator({ ...matchableCreator, tier: 'signature' }, {});
const eliteScore = scoreCreator({ ...matchableCreator, tier: 'elite' }, {});
assert(eliteScore > signatureScore, 'Smart Match must rank Elite above Signature when all other signals are equal');
const verifiedScore = scoreCreator({ ...matchableCreator, tier: 'proven', verification_status: 'verified' }, {});
const legacyProVerifiedScore = scoreCreator({ ...matchableCreator, tier: 'proven', verification_status: 'pro_verified' }, {});
assert(verifiedScore === legacyProVerifiedScore, 'Smart Match must not create a hidden Pro Verified advantage');

const directory = source('src/components/CreatorDirectory.jsx');
assert(directory.includes("import { creatorListingMeetsPublicRules } from '../utils/creatorReadiness.js';"), 'Directory must import the shared readiness rule');
assert(directory.includes("select('*, creator_services(*), portfolio_items(*), packages(*)')"), 'Directory must load live creators with portfolio and package relationships');
assert(directory.includes('isPublicDiscoverableCreator'), 'Directory must use the public discoverability wrapper');
assert(!directory.includes('|| creator.user_id === user?.id'), 'Directory must not show incomplete own listings in public discovery');
assert(!directory.includes('PILLAR_TO_LEGACY'), 'Public directory pillar filters must use one primary pillar, not legacy multi-service fallback counts');

const profile = source('src/pages/CreatorProfilePage.jsx');
assert(profile.includes("import { creatorListingMeetsPublicRules } from '../utils/creatorReadiness.js';"), 'Public profile page must import the shared readiness rule');
assert(profile.includes("import { SEED_CREATORS, SHOW_DEMO_CREATORS } from '../data/seedCreators.js';"), 'Public profile page must respect the launch demo-creator flag');
assert(profile.includes("if (SHOW_DEMO_CREATORS && (id === 'demo' || id === 'seed-2'))"), 'Sample profile must be development-only');
assert(profile.includes('if (supabaseConfigured) return null;'), 'Configured public profiles must load from Supabase instead of local cache');
assert(profile.includes('if (!isUuid(id)) return null;'), 'Public profile routes must reject malformed listing ids before querying Supabase');
assert(profile.includes('title="Profile unavailable"'), 'Unavailable creator profiles must set a stable document title');

const app = source('src/App.jsx');
assert(!app.includes("navigate('/creator/demo')"), 'Public navigation must not link to the fabricated sample profile');
for (const title of [
  'Collaboration Payment | CreatorBridge',
  'Secure Checkout | CreatorBridge',
  'Creator Matches | CreatorBridge',
  'Join CreatorBridge | CreatorBridge',
  'Reset Password | CreatorBridge',
  'Page Not Found | CreatorBridge',
]) {
  assert(app.includes(title), `Application route titles must include: ${title}`);
}
assert(
  app.includes("pathname.startsWith('/calculator') || pathname.startsWith('/rate-calculator')"),
  'Rate calculator aliases must share the same document title',
);

const projectBoard = source('src/pages/ProjectBoard.jsx');
const projectTimeline = source('src/components/ProjectTimeline.jsx');
assert(
  projectBoard.includes('enabled={Boolean(user?.id && localProject.status !=='),
  'Public Project Board must not enable protected lifecycle reads for signed-out visitors',
);
assert(
  projectTimeline.includes('if (!projectId || !enabled)'),
  'Project timeline must stop before protected lifecycle reads when disabled',
);

const authModal = source('src/components/auth/AuthModal.jsx');
assert(
  authModal.includes('role="dialog"') && authModal.includes('aria-modal="true"'),
  'Account access must expose an accessible modal dialog',
);
assert(
  authModal.includes('max-h-[calc(100dvh-2rem)]') && authModal.includes('overflow-y-auto'),
  'Account access must remain vertically scrollable on compact phones',
);
assert(
  authModal.includes('aria-hidden="true"') && authModal.includes('tabIndex={-1}'),
  'The signup honeypot must stay out of the accessibility and keyboard trees',
);
assert(
  authModal.includes('min-h-8 min-w-8') && authModal.includes('items-center justify-center'),
  'Password visibility controls must keep a usable desktop hit area',
);

const handoffStyles = source('src/styles/creatorbridge-handoff.css');
assert(
  handoffStyles.includes('@media (pointer:coarse) and (max-width:767px)'),
  'Coarse-pointer phone layouts must define a dedicated touch-target rule',
);
assert(
  handoffStyles.includes('min-height:44px !important') && handoffStyles.includes('min-width:44px !important'),
  'Phone controls must provide a 44px minimum touch target in both dimensions',
);
assert(
  handoffStyles.includes('footer.site button') && handoffStyles.includes('input:not([type="checkbox"])'),
  'Phone touch rules must outrank compact footer controls and include form fields',
);

const handoffPage = source('src/components/HandoffPage.jsx');
assert(
  handoffPage.includes('useLayoutEffect') && handoffPage.includes('root.innerHTML = page.html'),
  'Generated handoff pages must initialize from a fresh DOM tree during React layout effects',
);
assert(
  handoffPage.includes('root.replaceChildren()') && !handoffPage.includes('dangerouslySetInnerHTML'),
  'Generated handoff cleanup must remove bound DOM instead of relying on a replay guard',
);
for (const label of [
  'US market',
  'Number of locations',
  'Number of deliverables',
  'Crew size',
  'Revision rounds',
  'Usage rights',
]) {
  assert(handoffPage.includes(label), `Rate calculator control missing accessible name: ${label}`);
}
assert(
  handoffPage.includes("setAttribute('aria-label', label)"),
  'Generated handoff controls must receive their accessible names before interaction',
);

const resetPassword = source('src/pages/ResetPasswordPage.jsx');
assert(resetPassword.includes('sessionChecked'), 'Password reset must distinguish an invalid link from an in-progress session check');
assert(resetPassword.includes('Reset link unavailable'), 'Password reset must explain when a recovery link is missing or expired');
assert(resetPassword.includes('<h1'), 'Password reset must expose a page-level heading');

const messagesPage = source('src/pages/MessagesPage.jsx');
assert(
  messagesPage.includes('aria-label="Open conversation"'),
  'The icon-only Messages action must expose an accessible name',
);

const clientProfile = source('src/pages/ClientProfilePage.jsx');
assert(
  clientProfile.includes(".from('client_profiles')") &&
    clientProfile.includes('.limit(1)') &&
    clientProfile.includes('profile = data?.[0] || null'),
  'Creator hiring view must load an optional client profile without a 406 response',
);
const clientReputation = source('src/components/ClientReputationBadge.jsx');
assert(
  clientReputation.includes('.limit(1)') && clientReputation.includes('const profile = data?.[0]'),
  'Optional client reputation reads must not request a singular response for a new creator',
);

const collaborationCheckout = source('src/pages/CollaborationCheckoutPage.jsx');
assert(
  collaborationCheckout.includes('if (!isUuid(collaborationId))'),
  'Collaboration checkout must reject malformed identifiers before invoking its payment function',
);

const checkoutPage = source('src/pages/CheckoutPage.jsx');
assert(
  checkoutPage.includes('const retainerBlockedByCreator') &&
    checkoutPage.includes('Choose a creator before checkout.'),
  'Project checkout must block an open project before creator acceptance',
);
assert(
  checkoutPage.includes("(!contract || contract.status !== 'countersigned')"),
  'Project checkout must block retainers until a countersigned contract exists',
);
assert(
  !checkoutPage.includes('Demo fallback only before a project has an accepted creator.'),
  'Project checkout must never substitute a demo creator for an unaccepted project',
);

const dashboard = source('src/pages/CreatorDashboard.jsx');
assert(dashboard.includes('getPublicProfileReadinessChecks'), 'Dashboard readiness strip must use the shared readiness checks');

const staleLockPattern = /(90-Day profile Lock|90-Day Profile Lock|90-day profile lock|Profile information is locked for 90 days|locked for 90 days)/i;
for (const file of [
  'supabase/functions/chatbot/index.ts',
  'supabase/functions/send-notification-email/index.ts',
  'src/components/SupportChatbot.jsx',
  'src/pages/CreatorDashboard.jsx',
  'src/pages/CreatorAgreement.jsx',
]) {
  assert(!staleLockPattern.test(source(file)), `${file} must not contain stale 90-day profile lock policy`);
}

console.log(JSON.stringify({
  ok: true,
  sharedReadinessRule: true,
  liveDirectorySource: true,
  staleNinetyDayLockRemoved: true,
}, null, 2));
