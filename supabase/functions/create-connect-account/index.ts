import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const { userId, email, listingId } = await req.json();

    if (!userId || !listingId) {
      return jsonResponse({ error: 'userId and listingId are required' }, 400);
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey) return jsonResponse({ error: 'Stripe secret key is not configured for CreatorBridge payments' }, 500);
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Supabase service credentials are not configured for CreatorBridge payments' }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: { user: null }, error: new Error('Missing authorization token') };

    if (authError || !authData.user || authData.user.id !== userId) {
      return jsonResponse({ error: 'Creator authentication is required to connect Stripe payments' }, 403);
    }

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('creator_listings')
      .select('id,user_id,stripe_account_id')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError) return jsonResponse({ error: listingError.message }, 500);
    if (!listing || listing.user_id !== userId) {
      return jsonResponse({ error: 'Creator listing ownership could not be verified' }, 403);
    }

    let stripeAccountId = listing.stripe_account_id;
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || authData.user.email || undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        metadata: { userId, listingId },
      });
      stripeAccountId = account.id;

      const { error: updateError } = await supabaseAdmin
        .from('creator_listings')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', listingId)
        .eq('user_id', userId);

      if (updateError) return jsonResponse({ error: updateError.message }, 500);
    }

    // Generate onboarding link
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5174';
    const accountLink = await stripe.accountLinks.create({
      account:     stripeAccountId,
      refresh_url: `${siteUrl}/dashboard?stripe=refresh`,
      return_url:  `${siteUrl}/dashboard?stripe=success`,
      type:        'account_onboarding',
    });

    return jsonResponse({ url: accountLink.url, accountId: stripeAccountId, stripeAccountId });
  } catch (err) {
    console.error('create-connect-account error:', err);
    return jsonResponse({ error: err.message }, 500);
  }
});
