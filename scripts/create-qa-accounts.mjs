import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import {
  buildQaCreatorListingPayload,
  buildQaCreatorPortfolioItems,
} from './lib/qaFixtures.mjs';
import { createQaCleanupTracker } from './lib/qaCleanup.mjs';

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
    password: env.CREATORBRIDGE_QA_CREATOR_PASSWORD || env.QA_CREATOR_PASS || password('Creator'),
    fullName: 'CreatorBridge QA Creator',
    role: 'creator',
  },
  client: {
    email: 'drl33+client@creatorbridge.studio',
    password: env.CREATORBRIDGE_QA_CLIENT_PASSWORD || env.QA_CLIENT_PASS || password('Client'),
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
  const now = new Date().toISOString();
  const { error } = await admin.from('client_profiles').upsert({
    user_id: user.id,
    display_name: 'Avery Thompson',
    company_name: 'Sonoran Launch Group',
    phone: '+14805550142',
    email_verified: true,
    phone_verified: true,
    phone_verified_at: now,
    payment_method_on_file: false,
    spam_score: 0,
    avg_rating: 0,
    total_projects_completed: 0,
    cancellation_rate: 0,
    total_reviews: 0,
    fast_match_count: 0,
    tos_accepted_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function seedCreator(user) {
  const now = new Date().toISOString();
  const listingPayload = buildQaCreatorListingPayload({
    userId: user.id,
    email: accounts.creator.email,
    now,
  });

  const existing = await admin
    .from('creator_listings')
    .select('id, review_status, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (existing.error) throw existing.error;

  const existingListings = existing.data || [];
  let listingId = (
    existingListings.find(listing => listing.review_status === 'approved') ||
    existingListings[0]
  )?.id;
  if (listingId) {
    const { error } = await admin.from('creator_listings').update(listingPayload).eq('id', listingId);
    if (error) throw error;
  } else {
    const { data, error } = await admin.from('creator_listings').insert(listingPayload).select('id').single();
    if (error) throw error;
    listingId = data.id;
  }

  const reset = createQaCleanupTracker('QA creator fixture reset');
  await reset.check('delete creator services', admin.from('creator_services').delete().eq('listing_id', listingId));
  await reset.check('delete portfolio items', admin.from('portfolio_items').delete().eq('listing_id', listingId));
  await reset.check('delete packages', admin.from('packages').delete().eq('listing_id', listingId));
  reset.assertComplete();

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

  const portfolio = buildQaCreatorPortfolioItems(listingId);
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
    passwordConfigured: Boolean(account.password),
    userId: user.id,
  };
  if (kind === 'client') await upsertClient(user);
  if (kind === 'creator') output[kind].listingId = await seedCreator(user);
}

console.log(JSON.stringify(output, null, 2));
