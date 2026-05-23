import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-secret',
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

  const rateLimited = checkRateLimit(req, { maxRequests: 5, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    if (!stripeKey.startsWith('sk_test')) {
      return jsonResponse({ error: 'Top-ups are only allowed in Stripe Test Mode.' }, 403);
    }

    const expectedSecret = Deno.env.get('TEST_TOPUP_SECRET') || Deno.env.get('PLATFORM_JOB_SECRET') || '';
    const suppliedSecret = req.headers.get('x-job-secret') || '';
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized test top-up request' }, 403);
    }

    const { amount = 200000, currency = 'usd', description = 'CreatorBridge QA balance top-up' } = await req.json();
    const safeAmount = Math.max(100, Math.min(2_000_000, Math.round(Number(amount || 0))));

    const topup = await stripe.topups.create({
      amount: safeAmount,
      currency,
      description,
      metadata: {
        source: 'creatorbridge_qa',
      },
    });

    return jsonResponse({ success: true, topupId: topup.id, amount: safeAmount, status: topup.status });
  } catch (err) {
    console.error('test-topup error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown top-up error' }, 500);
  }
});
