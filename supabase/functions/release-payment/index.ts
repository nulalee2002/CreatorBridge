import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

// Compatibility tombstone. Creator payouts used to be manually releasable from
// this endpoint. That path is intentionally closed: only a signature-verified
// payment_intent.succeeded event in stripe-webhook may mark a final payment paid
// and execute the idempotent creator transfer.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const rateLimited = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const { data: authData, error: authError } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null }, error: new Error('Missing authorization token') };

  if (authError || !authData.user) return json({ error: 'Authentication is required' }, 403);

  return json({
    error: 'Manual payout release is disabled. Creator payout is released only after CreatorBridge verifies Stripe’s signed final-payment webhook.',
    code: 'SIGNED_STRIPE_WEBHOOK_REQUIRED',
  }, 410);
});
