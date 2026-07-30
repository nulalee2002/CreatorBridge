import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.CREATORBRIDGE_QA_ADMIN_EMAIL;
const adminPassword = process.env.CREATORBRIDGE_QA_ADMIN_PASSWORD;

if (!url || !anonKey || !serviceRoleKey || !adminEmail || !adminPassword) {
  throw new Error('Missing Supabase or CreatorBridge QA admin credentials.');
}

const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const creatorClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const adminClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `drl33+onboarding-${stamp}@creatorbridge.studio`;
const password = `CB-Onboarding-${stamp}!`;
const phoneE164 = `+1480${String(Date.now()).slice(-7)}`;
let userId = null;
let listingId = null;

const validApplication = {
  name: 'CreatorBridge Onboarding QA',
  business_name: 'CreatorBridge QA Studio',
  avatar: `storage://creator-portfolio/${stamp}/profile.jpg`,
  bio: 'This temporary creator profile validates that CreatorBridge saves a complete application, portfolio evidence, and legal acceptance together without leaving partial records when a request fails.',
  experience: 'mid',
  years_experience: 4,
  tags: ['Brand film', 'Commercial production'],
  city: 'Phoenix',
  state: 'AZ',
  country: 'US',
  zip: '85004',
  region_key: 'us-tier2',
  email,
  phone: phoneE164,
  video_intro_url: `bunny:onboarding-intro-${stamp}`,
  primary_pillar: 'video_production',
  sub_niches: ['vp_brand_films'],
  portfolio: [1, 2, 3].map(index => ({
    service_id: 'vp_brand_films',
    title: `Onboarding QA brand film ${index}`,
    description: `Temporary portfolio proof ${index} used only for the CreatorBridge atomic onboarding verification.`,
    image_url: null,
    media_type: 'video',
    bunny_video_id: `onboarding-portfolio-${stamp}-${index}`,
  })),
};

async function countRows(table, filters = []) {
  let query = service.from(table).select('*', { count: 'exact', head: true });
  for (const [column, value] of filters) query = query.eq(column, value);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function cleanup() {
  if (listingId) {
    await service.from('portfolio_items').delete().eq('listing_id', listingId);
    await service.from('packages').delete().eq('listing_id', listingId);
    await service.from('creator_listings').delete().eq('id', listingId);
  }
  if (userId) {
    await service.from('legal_acceptances').delete().eq('user_id', userId);
    await service.from('profiles').delete().eq('id', userId);
    await service.auth.admin.deleteUser(userId);
  }
}

try {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: validApplication.name, role: 'creator' },
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const profile = await service.from('profiles').upsert({
    id: userId,
    role: 'creator',
    full_name: validApplication.name,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profile.error) throw profile.error;

  const signedIn = await creatorClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  const unverifiedPhoneSubmission = await creatorClient.rpc('submit_creator_application', {
    p_application: validApplication,
    p_document_version: '1.0',
  });
  if (!unverifiedPhoneSubmission.error || !/phone verification is required/i.test(unverifiedPhoneSubmission.error.message)) {
    throw new Error('Creator application was not blocked before Twilio phone verification.');
  }

  const phoneVerification = await service.from('account_phone_verifications').upsert({
    user_id: userId,
    phone_e164: phoneE164,
    status: 'verified',
    verified_at: new Date().toISOString(),
    provider: 'twilio',
    provider_service_reference: 'automated_qa',
    attempt_count: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (phoneVerification.error) throw phoneVerification.error;

  const unverifiedIdentitySubmission = await creatorClient.rpc('submit_creator_application', {
    p_application: validApplication,
    p_document_version: '1.0',
  });
  if (!unverifiedIdentitySubmission.error || !/identity verification is required/i.test(unverifiedIdentitySubmission.error.message)) {
    throw new Error('Creator application was not blocked before human identity verification.');
  }

  const identityConsent = await service.from('identity_consents').insert({
    user_id: userId,
    consent_version: 'creatorbridge-identity-consent-v1',
    purpose: 'creator_application',
    user_agent: 'CreatorBridge automated QA',
  }).select('id').single();
  if (identityConsent.error) throw identityConsent.error;

  const identityVerification = await service.from('identity_verifications').insert({
    user_id: userId,
    consent_id: identityConsent.data.id,
    provider: 'stripe_identity',
    provider_session_id: `vs_qa_onboarding_${stamp}`,
    purpose: 'creator_application',
    status: 'verified',
    adult_verified: true,
    document_status: 'verified',
    selfie_status: 'verified',
    risk_label: 'clear',
    verified_at: new Date().toISOString(),
  });
  if (identityVerification.error) throw identityVerification.error;

  const malformed = {
    ...validApplication,
    portfolio: validApplication.portfolio.slice(0, 2),
  };
  const failedSubmission = await creatorClient.rpc('submit_creator_application', {
    p_application: malformed,
    p_document_version: '1.0',
  });
  if (!failedSubmission.error) throw new Error('Malformed application unexpectedly succeeded.');

  const rowsAfterFailure = {
    listings: await countRows('creator_listings', [['user_id', userId]]),
    legalAcceptances: await countRows('legal_acceptances', [['user_id', userId]]),
  };
  if (rowsAfterFailure.listings !== 0 || rowsAfterFailure.legalAcceptances !== 0) {
    throw new Error('Malformed application left partial database records.');
  }

  const submitted = await creatorClient.rpc('submit_creator_application', {
    p_application: validApplication,
    p_document_version: '1.0',
  });
  if (submitted.error) throw submitted.error;
  listingId = submitted.data.id;

  const savedCounts = {
    listings: await countRows('creator_listings', [['user_id', userId]]),
    portfolio: await countRows('portfolio_items', [['listing_id', listingId]]),
    legalAcceptances: await countRows('legal_acceptances', [['user_id', userId]]),
  };
  if (savedCounts.listings !== 1 || savedCounts.portfolio !== 3 || savedCounts.legalAcceptances !== 1) {
    throw new Error(`Atomic application counts were incorrect: ${JSON.stringify(savedCounts)}`);
  }

  const duplicate = await creatorClient.rpc('submit_creator_application', {
    p_application: validApplication,
    p_document_version: '1.0',
  });
  if (!duplicate.error || !/already have/i.test(duplicate.error.message)) {
    throw new Error('Duplicate creator application was not blocked.');
  }

  const adminSignIn = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminSignIn.error) throw adminSignIn.error;
  const prematureApproval = await adminClient.rpc('admin_approve_creator', {
    p_listing_id: listingId,
  });
  if (!prematureApproval.error || !/not ready for approval/i.test(prematureApproval.error.message)) {
    throw new Error('Admin approval did not reject the incomplete creator profile.');
  }

  const readiness = await service.rpc('creator_listing_meets_approval_requirements', {
    p_listing_id: listingId,
  });
  if (readiness.error) throw readiness.error;
  if (readiness.data !== false) throw new Error('Creator was ready before package and payout setup.');

  console.log(JSON.stringify({
    ok: true,
    rollbackOnInvalidApplication: true,
    phoneGateBlockedUnverifiedApplication: true,
    identityGateBlockedUnverifiedApplication: true,
    atomicApplicationCounts: savedCounts,
    duplicateBlocked: true,
    prematureAdminApprovalBlocked: true,
    cleanup: 'pending',
  }, null, 2));
} finally {
  await creatorClient.auth.signOut();
  await adminClient.auth.signOut();
  await cleanup();
}

const remainingUsers = userId
  ? await service.auth.admin.getUserById(userId)
  : { data: { user: null }, error: null };
if (!remainingUsers.error && remainingUsers.data.user) {
  throw new Error('Temporary onboarding user was not removed.');
}
console.log(JSON.stringify({ cleanup: 'complete' }));
