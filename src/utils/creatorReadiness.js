const BUNNY_REF_PREFIX = 'bunny:';

export function isPublicBunnyVideoRef(value = '') {
  return String(value || '').trim().startsWith(BUNNY_REF_PREFIX);
}

export function hasPublicProfilePhoto(value) {
  const raw = String(value || '').trim();
  return Boolean(
    raw &&
    raw !== '🎬' &&
    raw.length > 3 &&
    (
      raw.startsWith('storage://') ||
      raw.startsWith('/') ||
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('data:') ||
      raw.startsWith('blob:')
    )
  );
}

export function requiredPortfolioMediaType(primaryPillar, subNicheId = '') {
  if (primaryPillar === 'photography' || String(subNicheId).startsWith('ph_')) return 'image';
  if (subNicheId === 'pp_photo_retouch') return 'image';
  return 'video';
}

export function getCreatorPortfolioItems(listing) {
  if (Array.isArray(listing?.portfolio_items)) return listing.portfolio_items;
  if (Array.isArray(listing?.portfolio)) return listing.portfolio;
  return [];
}

export function getCreatorPackages(listing) {
  return Array.isArray(listing?.packages) ? listing.packages : [];
}

export function publicPortfolioItemComplete(item, primaryPillar) {
  const subNicheId = item?.service_id || item?.subNicheId || item?.serviceId || '';
  const mediaType = item?.media_type || item?.mediaType || (item?.bunny_video_id || item?.bunnyVideoId || item?.videoRef ? 'video' : 'image');
  const requiredMediaType = requiredPortfolioMediaType(primaryPillar, subNicheId);
  const hasMedia = mediaType === 'video'
    ? Boolean(item?.bunny_video_id || item?.bunnyVideoId || isPublicBunnyVideoRef(item?.videoRef || item?.video_url || ''))
    : Boolean(item?.image_url || item?.imageUrl);

  return Boolean(
    mediaType === requiredMediaType &&
    hasMedia &&
    String(item?.title || '').trim() &&
    String(item?.description || '').trim()
  );
}

export function getPublicProfileReadiness(creator) {
  const portfolioItems = getCreatorPortfolioItems(creator);
  const matchingPortfolioCount = portfolioItems
    .filter(item => publicPortfolioItemComplete(item, creator?.primary_pillar))
    .length;
  const packages = getCreatorPackages(creator);
  const subNiches = creator?.sub_niches || creator?.subNiches || [];
  const services = creator?.services || creator?.creator_services || [];

  return {
    profilePhotoMet: hasPublicProfilePhoto(creator?.avatar),
    introVideoMet: isPublicBunnyVideoRef(creator?.video_intro_url || creator?.videoIntroUrl || ''),
    primaryPillarMet: Boolean(creator?.primary_pillar),
    specialtiesMet: Array.isArray(subNiches) && subNiches.length > 0,
    matchingPortfolioCount,
    portfolioMet: matchingPortfolioCount >= 3,
    packagesMet: packages.some(pkg => Number(pkg?.price || 0) > 0 && String(pkg?.name || '').trim()),
    verificationMet: ['verified', 'pro_verified'].includes(creator?.verification_status),
    legacyServicesPresent: Array.isArray(services) && services.length > 0,
  };
}

export function getPublicProfileReadinessChecks(creator) {
  const readiness = getPublicProfileReadiness(creator);
  return [
    { label: 'Real profile photo', done: readiness.profilePhotoMet, action: 'Repair Listing' },
    { label: 'Intro video', done: readiness.introVideoMet, action: 'Video Intro' },
    { label: 'Primary pillar', done: readiness.primaryPillarMet, action: 'Repair Listing' },
    { label: 'Specialties selected', done: readiness.specialtiesMet, action: 'Repair Listing' },
    { label: '3 matching portfolio samples', done: readiness.portfolioMet, action: 'Repair Listing', detail: `${readiness.matchingPortfolioCount}/3 ready` },
    { label: 'Packages', done: readiness.packagesMet, action: 'Packages' },
    { label: 'Verification', done: readiness.verificationMet, action: 'Verification' },
  ];
}

export function creatorListingMeetsPublicRules(creator, { allowDemoSeed = false } = {}) {
  if (allowDemoSeed && String(creator?.id || '').startsWith('seed-')) return true;
  const readiness = getPublicProfileReadiness(creator);
  return Boolean(
    readiness.profilePhotoMet &&
    readiness.introVideoMet &&
    readiness.primaryPillarMet &&
    readiness.specialtiesMet &&
    readiness.portfolioMet &&
    readiness.packagesMet &&
    readiness.verificationMet
  );
}
