import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 8, windowMs: 60_000 }); if (limited) return limited;
  try {
    const { collaborationId } = await req.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return reply({ error: 'Authentication required' }, 401);
    const { data: collaboration } = await admin.from('creator_collaborations').select('*, collaborator:creator_listings!collaborator_listing_id(stripe_account_id)').eq('id', collaborationId).single();
    if (!collaboration || collaboration.prime_user_id !== auth.user.id) return reply({ error: 'Only the hiring creator can fund this collaboration' }, 403);
    if (!['accepted','funding_pending'].includes(collaboration.status)) return reply({ error: 'The collaborator must accept before funding' }, 409);
    const { count } = await admin.from('transactions').select('id', { count: 'exact', head: true }).eq('creator_id', collaboration.collaborator_listing_id).eq('final_status', 'released');
    const feePct = (count ?? 0) >= 25 ? 6 : (count ?? 0) >= 10 ? 8 : 10;
    const base = Number(collaboration.amount_cents);
    const platformFee = Math.max(500, Math.round(base * feePct / 100));
    const processingCost = Math.min(500, Math.round(base * 0.008));
    const charge = base + processingCost;
    const destination = collaboration.collaborator?.stripe_account_id;
    if (!destination) return reply({ error: 'Collaborator payout account is not ready' }, 409);
    const key = `collaboration:${collaboration.id}:ach:v1`;
    const intent = await stripe.paymentIntents.create({ amount: charge, currency: 'usd', payment_method_types: ['us_bank_account'], application_fee_amount: platformFee + processingCost, transfer_data: { destination }, metadata: { paymentType: 'creator_collaboration', collaborationId: collaboration.id, primeUserId: collaboration.prime_user_id, collaboratorUserId: collaboration.collaborator_user_id } }, { idempotencyKey: key });
    await admin.from('collaboration_payments').upsert({ collaboration_id: collaboration.id, prime_user_id: collaboration.prime_user_id, collaborator_user_id: collaboration.collaborator_user_id, base_amount_cents: base, ach_processing_cost_cents: processingCost, buyer_platform_fee_cents: 0, creator_fee_pct: feePct, platform_fee_cents: platformFee, collaborator_net_cents: base-platformFee, prime_charge_cents: charge, stripe_payment_intent_id: intent.id, idempotency_key: key, status: 'processing' }, { onConflict: 'idempotency_key' });
    await admin.from('creator_collaborations').update({ status: 'funding_pending', updated_at: new Date().toISOString() }).eq('id', collaboration.id);
    return reply({ clientSecret: intent.client_secret, paymentIntentId: intent.id, baseAmountCents: base, processingCostCents: processingCost, primeChargeCents: charge, creatorFeePct: feePct, platformFeeCents: platformFee, buyerPlatformFeeCents: 0, message: 'Do not begin work until funded.' });
  } catch (error) { return reply({ error: error.message ?? 'Payment creation failed' }, 400); }
});
