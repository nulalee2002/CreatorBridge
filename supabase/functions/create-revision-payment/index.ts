import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const PAID_REVISION_PRICE_CENTS = 5_000;
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function creatorFeePct(completedProjects: number) {
  if (completedProjects >= 25) return 6;
  if (completedProjects >= 10) return 8;
  return 10;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = await checkRateLimit(req, { maxRequests: 10, windowMs: 60_000, failClosed: true });
  if (limited) return limited;

  try {
    const { projectId, idempotencyKey } = await req.json();
    if (!projectId || !idempotencyKey || String(idempotencyKey).trim().length < 8) {
      return reply({ error: 'projectId and a valid idempotencyKey are required' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ error: 'Authentication required' }, 401);

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id, client_id, accepted_creator_id, status')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return reply({ error: 'Project not found' }, 404);
    if (project.client_id !== authData.user.id) {
      return reply({ error: 'Only the project client can purchase a revision' }, 403);
    }
    if (!project.accepted_creator_id || ['open', 'accepted', 'cancelled', 'completed', 'final_paid'].includes(project.status)) {
      return reply({ error: 'This project is not eligible for an additional revision' }, 409);
    }

    const { data: creator, error: creatorError } = await admin
      .from('creator_listings')
      .select('id, completed_projects')
      .eq('id', project.accepted_creator_id)
      .maybeSingle();
    if (creatorError) throw creatorError;
    if (!creator) return reply({ error: 'Accepted creator could not be verified' }, 409);

    const creator_fee_pct = creatorFeePct(Number(creator.completed_projects || 0));
    const creator_fee_cents = Math.round(PAID_REVISION_PRICE_CENTS * creator_fee_pct / 100);
    const creator_net_cents = PAID_REVISION_PRICE_CENTS - creator_fee_cents;
    const key = String(idempotencyKey).trim().slice(0, 200);

    let { data: purchase } = await admin
      .from('project_revision_purchases')
      .select('*')
      .eq('project_id', project.id)
      .eq('client_id', authData.user.id)
      .eq('idempotency_key', key)
      .maybeSingle();

    if (purchase?.payment_status === 'succeeded') {
      return reply({ error: 'This revision purchase is already paid', purchaseId: purchase.id }, 409);
    }
    if (purchase?.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(purchase.stripe_payment_intent_id);
      if (existing.client_secret && !['canceled', 'succeeded'].includes(existing.status)) {
        return reply({
          purchaseId: purchase.id,
          clientSecret: existing.client_secret,
          paymentIntentId: existing.id,
          amountCents: PAID_REVISION_PRICE_CENTS,
          creatorNetCents: creator_net_cents,
          platformFeeCents: creator_fee_cents,
          reused: true,
        });
      }
    }

    if (!purchase) {
      const { data: inserted, error: insertError } = await admin
        .from('project_revision_purchases')
        .insert({
          project_id: project.id,
          client_id: authData.user.id,
          creator_listing_id: creator.id,
          gross_amount_cents: PAID_REVISION_PRICE_CENTS,
          client_fee_cents: 0,
          creator_fee_pct,
          creator_fee_cents,
          creator_net_cents,
          idempotency_key: key,
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      purchase = inserted;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: PAID_REVISION_PRICE_CENTS,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        paymentFlow: 'paid_revision',
        paymentType: 'project_revision',
        revisionPurchaseId: purchase.id,
        projectId: project.id,
        clientId: authData.user.id,
      },
    }, { idempotencyKey: `cb_revision_${purchase.id}` });

    const { error: updateError } = await admin
      .from('project_revision_purchases')
      .update({ stripe_payment_intent_id: paymentIntent.id, updated_at: new Date().toISOString() })
      .eq('id', purchase.id)
      .eq('payment_status', 'pending');
    if (updateError) throw updateError;

    return reply({
      purchaseId: purchase.id,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountCents: PAID_REVISION_PRICE_CENTS,
      creatorNetCents: creator_net_cents,
      platformFeeCents: creator_fee_cents,
    });
  } catch (error) {
    console.error('create-revision-payment error:', error);
    return reply({ error: error.message || 'Revision payment could not be created' }, 500);
  }
});
