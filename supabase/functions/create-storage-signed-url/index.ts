import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const STORAGE_PREFIX = 'storage://';
const PUBLIC_PREVIEW_BUCKETS = new Set(['creator-portfolio']);
const PRIVATE_PARTY_BUCKETS = new Set(['contracts', 'signatures', 'call-recordings', 'call-transcripts']);

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

    if (!parsed || (!PUBLIC_PREVIEW_BUCKETS.has(parsed.bucket) && !PRIVATE_PARTY_BUCKETS.has(parsed.bucket))) {
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

    if (PRIVATE_PARTY_BUCKETS.has(parsed.bucket)) {
      if (!activeUserId) {
        return new Response(
          JSON.stringify({ error: 'Authentication is required for private agreement files' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: adminRow } = await supabaseAdmin
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', activeUserId)
        .maybeSingle();
      let authorized = !!adminRow;

      if (!authorized && parsed.bucket === 'contracts') {
        const { data: contract } = await supabaseAdmin
          .from('contracts')
          .select('client_id,creator_user_id,pdf_ref')
          .eq('pdf_ref', ref)
          .maybeSingle();
        authorized = !!contract && [contract.client_id, contract.creator_user_id].includes(activeUserId);
        if (!authorized) {
          const { data: changeOrder } = await supabaseAdmin
            .from('contract_change_orders')
            .select('client_id,creator_user_id,pdf_ref')
            .eq('pdf_ref', ref)
            .maybeSingle();
          authorized = !!changeOrder && [changeOrder.client_id, changeOrder.creator_user_id].includes(activeUserId);
        }
      }

      if (!authorized && parsed.bucket === 'signatures') {
        const { data: savedSignature } = await supabaseAdmin
          .from('saved_signatures')
          .select('user_id')
          .eq('signature_image_ref', ref)
          .maybeSingle();
        if (savedSignature?.user_id === activeUserId) authorized = true;

        if (!authorized) {
          const { data: contractSignature } = await supabaseAdmin
            .from('contract_signatures')
            .select('contract_id')
            .eq('signature_image_ref', ref)
            .maybeSingle();
          if (contractSignature?.contract_id) {
            const { data: contract } = await supabaseAdmin
              .from('contracts')
              .select('client_id,creator_user_id')
              .eq('id', contractSignature.contract_id)
              .maybeSingle();
            authorized = !!contract && [contract.client_id, contract.creator_user_id].includes(activeUserId);
          }
        }
        if (!authorized) {
          const { data: changeOrderSignature } = await supabaseAdmin
            .from('change_order_signatures')
            .select('change_order_id')
            .eq('signature_image_ref', ref)
            .maybeSingle();
          if (changeOrderSignature?.change_order_id) {
            const { data: changeOrder } = await supabaseAdmin
              .from('contract_change_orders')
              .select('client_id,creator_user_id')
              .eq('id', changeOrderSignature.change_order_id)
              .maybeSingle();
            authorized = !!changeOrder && [changeOrder.client_id, changeOrder.creator_user_id].includes(activeUserId);
          }
        }
      }

      if (!authorized && (parsed.bucket === 'call-recordings' || parsed.bucket === 'call-transcripts')) {
        const refColumn = parsed.bucket === 'call-recordings' ? 'recording_ref' : 'transcript_ref';
        const { data: call } = await supabaseAdmin
          .from('project_calls')
          .select('creator_id,client_id')
          .eq(refColumn, ref)
          .maybeSingle();
        authorized = !!call && [call.creator_id, call.client_id].includes(activeUserId);
      }

      if (!authorized) {
        return new Response(
          JSON.stringify({ error: 'Private agreement file access denied' }),
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
    }

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
