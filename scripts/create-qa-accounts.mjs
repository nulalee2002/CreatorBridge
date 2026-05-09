import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      if (env[key]) continue;
      env[key] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

function password(label) {
  return `CB-${label}-${crypto.randomBytes(6).toString('base64url')}!26`;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('This script needs the service role key so QA users can be confirmed and fully seeded.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const accounts = {
  creator: {
    email: 'drl33+creator@creatorbridge.studio',
    password: password('Creator'),
    fullName: 'Marcus Reed',
    role: 'creator',
  },
  client: {
    email: 'drl33+client@creatorbridge.studio',
    password: password('Client'),
    fullName: 'Avery Thompson',
    role: 'client',
  },
};

async function getOrCreateUser(account) {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
      role: account.role,
    },
  });

  if (!created.error) return created.data.user;

  if (!/already|registered|exists/i.test(created.error.message)) {
    throw new Error(`${account.email}: ${created.error.message}`);
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const existing = data.users.find(user => user.email?.toLowerCase() === account.email.toLowerCase());
  if (!existing) throw new Error(`${account.email}: user exists but could not be loaded`);

  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password: account.password,
    email_confirm: true,
    user_metadata: {
      full_name: account.fullName,
      role: account.role,
    },
  });
  if (updated.error) throw updated.error;
  return updated.data.user;
}

async function upsertProfile(user, account) {
  const { error } = await admin.from('profiles').upsert({
    id: user.id,
    role: account.role,
    full_name: account.fullName,
    referral_code: user.id.replaceAll('-', '').slice(0, 8).toUpperCase(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertClient(user) {
  const { error } = await admin.from('client_profiles').upsert({
    user_id: user.id,
    display_name: 'Avery Thompson',
    company_name: 'Sonoran Launch Group',
    phone: '480-555-0142',
    email_verified: true,
    phone_verified: false,
    payment_method_on_file: false,
    spam_score: 0,
    avg_rating: 0,
    total_projects_completed: 0,
    cancellation_rate: 0,
    total_reviews: 0,
    fast_match_count: 0,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function seedCreator(user) {
  const now = new Date().toISOString();
  const listingPayload = {
    user_id: user.id,
    name: 'Marcus Reed',
    business_name: 'Copper Line Media',
    avatar: 'CB',
    bio: 'Phoenix based commercial videographer and production lead with 8 years of paid experience helping small businesses, nonprofits, and event teams turn practical briefs into polished video, photo, and podcast content. This QA profile is fully filled out to test CreatorBridge onboarding, service packaging, portfolio review, quote requests, and client booking flows from end to end.',
    experience: 'senior',
    years_experience: 8,
    tags: ['Corporate', 'Brand Film', 'Podcast', 'Event Coverage', 'Editing'],
    availability: 'available',
    verified: true,
    verification_status: 'verified',
    review_status: 'approved',
    plan: 'pro',
    city: 'Phoenix',
    state: 'AZ',
    country: 'US',
    zip: '85004',
    region_key: 'us-tier2',
    email: accounts.creator.email,
    phone: '480-555-0188',
    website: 'https://creatorbridge.studio',
    instagram: '@copperlinemedia_test',
    rating: 4.9,
    review_count: 12,
    completed_projects: 14,
    tier: 'proven',
    completion_rate: 96,
    video_intro_url: 'https://example.com/creatorbridge-test/60-second-intro-video',
    updated_at: now,
  };

  const existing = await admin
    .from('creator_listings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing.error) throw existing.error;

  let listingId = existing.data?.id;
  if (listingId) {
    const { error } = await admin.from('creator_listings').update(listingPayload).eq('id', listingId);
    if (error) throw error;
  } else {
    const { data, error } = await admin.from('creator_listings').insert(listingPayload).select('id').single();
    if (error) throw error;
    listingId = data.id;
  }

  await admin.from('creator_services').delete().eq('listing_id', listingId);
  await admin.from('portfolio_items').delete().eq('listing_id', listingId);
  await admin.from('packages').delete().eq('listing_id', listingId);

  const services = [
    {
      listing_id: listingId,
      service_id: 'video',
      subtypes: ['Corporate Brand Film', 'Event Recap', 'Interview Setup'],
      description: 'Full-service production for polished business videos, interviews, and launch content.',
      rates: { halfDay: 950, fullDay: 1800, editHourly: 95, corporateProject: 4200 },
    },
    {
      listing_id: listingId,
      service_id: 'photography',
      subtypes: ['Event Photography', 'Commercial Portraits', 'Brand Stills'],
      description: 'Commercial and event photography for brands that need clean, usable assets.',
      rates: { hourlyEvent: 175, dayRateCommercial: 1400, editingPerPhoto: 35 },
    },
    {
      listing_id: listingId,
      service_id: 'podcast',
      subtypes: ['Studio Setup', 'Episode Recording', 'Podcast Editing'],
      description: 'Podcast recording and post-production support for founders, coaches, and branded shows.',
      rates: { episodeEdit: 275, recordingSession: 650, monthlyRetainer: 1800 },
    },
  ];
  const serviceInsert = await admin.from('creator_services').insert(services);
  if (serviceInsert.error) throw serviceInsert.error;

  const portfolio = [
    {
      listing_id: listingId,
      service_id: 'video',
      title: 'Founder Story Brand Film',
      description: 'Test portfolio item for a 90-second founder story with interview lighting, b-roll, music, color, and captions.',
      link: 'https://example.com/creatorbridge-test/founder-story-brand-film',
      display_order: 0,
    },
    {
      listing_id: listingId,
      service_id: 'photography',
      title: 'Corporate Event Photo Set',
      description: 'Test portfolio item for conference coverage, speaker photos, candid networking, and sponsor deliverables.',
      link: 'https://example.com/creatorbridge-test/corporate-event-photo-set',
      display_order: 1,
    },
    {
      listing_id: listingId,
      service_id: 'podcast',
      title: 'Podcast Launch Package',
      description: 'Test portfolio item for a branded podcast trailer, three edited episodes, show notes, and social clips.',
      link: 'https://example.com/creatorbridge-test/podcast-launch-package',
      display_order: 2,
    },
  ];
  const portfolioInsert = await admin.from('portfolio_items').insert(portfolio);
  if (portfolioInsert.error) throw portfolioInsert.error;

  const packages = [
    {
      listing_id: listingId,
      service_id: 'video',
      name: 'Brand Film Starter',
      description: 'Half-day shoot, one 60 to 90 second edit, captions, and one revision.',
      price: 2200,
      deliverables: ['Pre-production call', 'Half-day production', 'Edited brand film', 'Caption file'],
      turnaround_days: 10,
      revisions: 1,
      display_order: 0,
    },
    {
      listing_id: listingId,
      service_id: 'podcast',
      name: 'Podcast Launch Kit',
      description: 'Recording support, trailer edit, three episode edits, intro/outro polish, and show notes.',
      price: 1800,
      deliverables: ['Trailer edit', '3 edited episodes', 'Audio cleanup', 'Show notes'],
      turnaround_days: 14,
      revisions: 2,
      display_order: 1,
    },
  ];
  const packageInsert = await admin.from('packages').insert(packages);
  if (packageInsert.error) throw packageInsert.error;

  return listingId;
}

const output = {};

for (const [kind, account] of Object.entries(accounts)) {
  const user = await getOrCreateUser(account);
  await upsertProfile(user, account);
  output[kind] = {
    email: account.email,
    password: account.password,
    userId: user.id,
  };
  if (kind === 'client') await upsertClient(user);
  if (kind === 'creator') output[kind].listingId = await seedCreator(user);
}

console.log(JSON.stringify(output, null, 2));
