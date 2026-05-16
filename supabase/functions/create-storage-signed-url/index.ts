import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const STORAGE_PREFIX = 'storage://';
const PUBLIC_PREVIEW_BUCKETS = new Set(['creator-portfolio']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseStorageReference(value = '') {
  if (!value.startsWith(STORAGE_PREFIX)) return null;
  const withoutPrefix = value.slice(STORAGE_PREFIX.length);
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex < 1) return null;
  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    path: withoutPrefix.slice(slashIndex + 1),
  };
}

function clampExpiresIn(value: unknown) {
  const requested = Number(value || 3600);
  if (!Number.isFinite(requested)) return 3600;
  return Math.min(Math.max(Math.round(requested), 60), 3600);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const { ref, expiresIn } = await req.json();
    const parsed = parseStorageReference(String(ref || ''));

    if (!parsed || !PUBLIC_PREVIEW_BUCKETS.has(parsed.bucket)) {
      return new Response(
        JSON.stringify({ error: 'Unsupported storage reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: authData } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: { user: null } };
    const activeUserId = authData?.user?.id || null;

    const { data: portfolioItem, error: portfolioError } = await supabaseAdmin
      .from('portfolio_items')
      .select('id, listing_id, image_url')
      .eq('image_url', ref)
      .maybeSingle();

    if (portfolioError || !portfolioItem?.listing_id) {
      return new Response(
        JSON.stringify({ error: 'Portfolio media could not be verified' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('creator_listings')
      .select('id, user_id, verified, verification_status, review_status')
      .eq('id', portfolioItem.listing_id)
      .maybeSingle();

    const isOwner = activeUserId && listing?.user_id === activeUserId;
    const isPublicApproved = !!(
      listing?.verified ||
      listing?.verification_status === 'verified' ||
      listing?.verification_status === 'pro_verified' ||
      listing?.review_status === 'approved'
    );

    if (listingError || !listing || (!isOwner && !isPublicApproved)) {
      return new Response(
        JSON.stringify({ error: 'Portfolio media is not available' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data, error } = await supabaseAdmin
      .storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, clampExpiresIn(expiresIn));

    if (error || !data?.signedUrl) {
      return new Response(
        JSON.stringify({ error: 'Signed URL could not be created' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid signed URL request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
