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

const app = source('src/App.jsx');
assert(!app.includes("navigate('/creator/demo')"), 'Public navigation must not link to the fabricated sample profile');

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
