import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.QA_CREATOR_EMAIL || process.env.CREATORBRIDGE_QA_CREATOR_EMAIL || 'drl33+creator@creatorbridge.studio';
const password = process.env.QA_CREATOR_PASS || process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD;

if (!url || !anonKey || !serviceKey || !password) {
  throw new Error('Supabase and QA creator environment values are required.');
}

const creator = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: auth, error: authError } = await creator.auth.signInWithPassword({ email, password });
if (authError) throw authError;

const { data: listing, error: listingError } = await service
  .from('creator_listings')
  .select('*')
  .eq('user_id', auth.user.id)
  .eq('review_status', 'approved')
  .limit(1)
  .single();
if (listingError) throw listingError;

const { data: ownItem, error: ownItemError } = await service
  .from('portfolio_items')
  .select('*')
  .eq('listing_id', listing.id)
  .limit(1)
  .single();
if (ownItemError) throw ownItemError;

let validPostId = null;
let temporaryUserId = null;
let temporaryListingId = null;
let temporaryItemId = null;
const cleanupFailures = [];
try {
  const base = {
    state_code: 'AZ',
    user_id: auth.user.id,
    post_type: 'portfolio',
    content: 'QA portfolio feedback verification post.',
    user_display_name: 'QA Creator',
    user_verification_status: 'verified',
    creator_listing_id: listing.id,
  };

  const { data: validPost, error: validError } = await creator
    .from('network_posts')
    .insert({ ...base, portfolio_item_id: ownItem.id })
    .select('id')
    .single();
  if (validError) throw new Error(`Owner portfolio share failed: ${validError.message}`);
  validPostId = validPost.id;

  let { data: foreignItem } = await service
    .from('portfolio_items')
    .select('id, listing_id')
    .neq('listing_id', listing.id)
    .limit(1)
    .maybeSingle();

  if (!foreignItem) {
    const temporaryEmail = `qa-cross-owner-${crypto.randomUUID()}@example.invalid`;
    const { data: temporaryAuth, error: temporaryAuthError } = await service.auth.admin.createUser({
      email: temporaryEmail,
      email_confirm: true,
      user_metadata: { role: 'creator', full_name: 'QA Cross Owner' },
    });
    if (temporaryAuthError) throw temporaryAuthError;
    temporaryUserId = temporaryAuth.user.id;

    const listingCopy = { ...listing };
    for (const key of ['id', 'created_at', 'updated_at', 'search_vector']) delete listingCopy[key];
    Object.assign(listingCopy, {
      user_id: temporaryUserId,
      name: 'QA Cross Owner',
      business_name: 'QA Cross Owner Studio',
      email: temporaryEmail,
      phone: null,
      stripe_account_id: null,
    });
    const { data: temporaryListing, error: temporaryListingError } = await service
      .from('creator_listings')
      .insert(listingCopy)
      .select('id')
      .single();
    if (temporaryListingError) throw temporaryListingError;
    temporaryListingId = temporaryListing.id;

    const itemCopy = { ...ownItem };
    for (const key of ['id', 'created_at']) delete itemCopy[key];
    Object.assign(itemCopy, {
      listing_id: temporaryListing.id,
      title: 'QA cross-owner guard fixture',
    });
    const { data: temporaryItem, error: temporaryItemError } = await service
      .from('portfolio_items')
      .insert(itemCopy)
      .select('id, listing_id')
      .single();
    if (temporaryItemError) throw temporaryItemError;
    temporaryItemId = temporaryItem.id;
    foreignItem = temporaryItem;
  }

  const { error: crossOwnerError } = await creator.from('network_posts').insert({
    ...base,
    creator_listing_id: foreignItem.listing_id,
    portfolio_item_id: foreignItem.id,
  });
  const crossOwnerBlocked = Boolean(crossOwnerError);
  if (!crossOwnerBlocked) throw new Error('Cross-owner portfolio share was not blocked.');

  console.log(JSON.stringify({ ok: true, ownerShareWorked: true, crossOwnerBlocked }, null, 2));
} finally {
  // Cleanup must fail loudly: every delete result is checked, child rows are
  // removed before their parents, and any failure exits non-zero so leftover
  // QA rows can never hide behind a passing run.
  if (validPostId) {
    const { error } = await service.from('network_posts').delete().eq('id', validPostId);
    if (error) cleanupFailures.push(`network_posts ${validPostId}: ${error.message}`);
  }
  if (temporaryItemId) {
    const { error } = await service.from('portfolio_items').delete().eq('id', temporaryItemId);
    if (error) cleanupFailures.push(`portfolio_items ${temporaryItemId}: ${error.message}`);
  }
  if (temporaryListingId) {
    const { error } = await service.from('creator_listings').delete().eq('id', temporaryListingId);
    if (error) cleanupFailures.push(`creator_listings ${temporaryListingId}: ${error.message}`);
  }
  if (temporaryUserId) {
    const { error } = await service.auth.admin.deleteUser(temporaryUserId);
    if (error) cleanupFailures.push(`auth user ${temporaryUserId}: ${error.message}`);
  }
  await creator.auth.signOut();
  if (cleanupFailures.length > 0) {
    console.error('Cleanup failed; QA rows remain in the database:');
    for (const failure of cleanupFailures) console.error(`- ${failure}`);
    process.exitCode = 1;
  }
}
