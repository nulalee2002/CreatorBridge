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
  .select('id')
  .eq('user_id', auth.user.id)
  .eq('review_status', 'approved')
  .limit(1)
  .single();
if (listingError) throw listingError;

const { data: ownItem, error: ownItemError } = await service
  .from('portfolio_items')
  .select('id, listing_id')
  .eq('listing_id', listing.id)
  .limit(1)
  .single();
if (ownItemError) throw ownItemError;

let validPostId = null;
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

  const { data: foreignItem } = await service
    .from('portfolio_items')
    .select('id, listing_id')
    .neq('listing_id', listing.id)
    .limit(1)
    .maybeSingle();

  let crossOwnerBlocked = null;
  if (foreignItem) {
    const { error } = await creator.from('network_posts').insert({
      ...base,
      creator_listing_id: foreignItem.listing_id,
      portfolio_item_id: foreignItem.id,
    });
    crossOwnerBlocked = Boolean(error);
    if (!crossOwnerBlocked) throw new Error('Cross-owner portfolio share was not blocked.');
  }

  console.log(JSON.stringify({ ok: true, ownerShareWorked: true, crossOwnerBlocked }, null, 2));
} finally {
  if (validPostId) await service.from('network_posts').delete().eq('id', validPostId);
  await creator.auth.signOut();
}
