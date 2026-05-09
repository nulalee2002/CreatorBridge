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

function creatorFeePctFor(completedProjects: number, nextProjectFeePct?: number | null) {
  const completed = Number(completedProjects || 0);
  const loyaltyPct = completed >= 25 ? 6 : completed >= 10 ? 8 : 10;
  return nextProjectFeePct != null ? Math.min(Number(nextProjectFeePct), loyaltyPct) : loyaltyPct;
}

function calculateTrustedFees(projectAmountCents: number, paymentType: 'retainer' | 'final', creatorFeePct: number, clientFeePct: number) {
  const total = Math.max(0, Math.round(Number(projectAmountCents || 0)));
  const retainerBase = Math.round(total * 0.5);
  const finalBase = total - retainerBase;
  const base = paymentType === 'final' ? finalBase : retainerBase;
  const creatorFeeAmountCents = Math.round(base * (creatorFeePct / 100));
  const clientFeeAmountCents = Math.round(base * (clientFeePct / 100));

  return {
    projectAmountCents: total,
    retainerAmountCents: retainerBase,
    finalAmountCents: finalBase,
    chargeAmountCents: base + clientFeeAmountCents,
    platformFeeCents: creatorFeeAmountCents + clientFeeAmountCents,
    creatorFeeAmountCents,
    clientFeeAmountCents,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const {
      projectId,
      amountCents,
      retainerAmountCents,   // base retainer amount, kept for older clients
      projectAmountCents,
      creatorId,
      clientId,
      paymentType = 'retainer',  // 'retainer' | 'final'
    } = await req.json();

    const normalizedPaymentType = paymentType === 'final' ? 'final' : 'retainer';
    const requestedAmountCents = Number(amountCents ?? retainerAmountCents);

    if (!requestedAmountCents || requestedAmountCents <= 0) {
      return new Response(
        JSON.stringify({ error: 'amountCents is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!projectId || !creatorId || !clientId) {
      return new Response(
        JSON.stringify({ error: 'projectId, creatorId, and clientId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: { user: null }, error: new Error('Missing authorization token') };

    if (authError || !authData.user || authData.user.id !== clientId) {
      return new Response(
        JSON.stringify({ error: 'Client authentication is required for payment creation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, client_id, budget_min, budget_max, accepted_creator_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project || project.client_id !== clientId) {
      return new Response(
        JSON.stringify({ error: 'Project ownership could not be verified' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (project.accepted_creator_id && project.accepted_creator_id !== creatorId) {
      return new Response(
        JSON.stringify({ error: 'Creator is not accepted for this project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: listing, error: listingError } = await supabaseAdmin
      .from('creator_listings')
      .select('id, stripe_account_id, completed_projects, next_project_fee_pct')
      .eq('id', creatorId)
      .maybeSingle();

    const trustedCreatorStripeAccountId = listing?.stripe_account_id;
    if (listingError || !listing || !trustedCreatorStripeAccountId) {
      return new Response(
        JSON.stringify({ error: 'Creator payout account could not be verified' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_booking_fee_waived, next_booking_fee_waived')
      .eq('id', clientId)
      .maybeSingle();

    const trustedProjectAmountCents = Math.round(Number(
      project.budget_max ?? project.budget_min ?? (projectAmountCents ? Number(projectAmountCents) / 100 : 0)
    ) * 100);
    const trustedCreatorFeePct = creatorFeePctFor(listing.completed_projects, listing.next_project_fee_pct);
    const trustedClientFeePct = profile?.first_booking_fee_waived || profile?.next_booking_fee_waived ? 0 : 5;
    const trustedFees = calculateTrustedFees(
      trustedProjectAmountCents || Number(projectAmountCents || 0),
      normalizedPaymentType,
      trustedCreatorFeePct,
      trustedClientFeePct
    );

    if (!trustedFees.chargeAmountCents || trustedFees.chargeAmountCents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Project amount could not be verified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   trustedFees.chargeAmountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: trustedFees.platformFeeCents,
      transfer_data: {
        destination: trustedCreatorStripeAccountId,
      },
      metadata: {
        projectId:   projectId ?? '',
        paymentType: normalizedPaymentType,
        creatorId:   creatorId ?? '',
        clientId:    clientId  ?? '',
      },
    });

    const { data: existingTxn } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('project_id', projectId)
      .eq('creator_id', creatorId)
      .eq('client_id', clientId)
      .maybeSingle();

    const transactionPatch = {
      project_id:          projectId,
      creator_id:          creatorId,
      client_id:           clientId,
      project_amount:      trustedFees.projectAmountCents,
      retainer_amount:     trustedFees.retainerAmountCents,
      final_amount:        trustedFees.finalAmountCents,
      creator_fee_pct:     trustedCreatorFeePct,
      client_fee_pct:      trustedClientFeePct,
      creator_fee_amount:  trustedFees.creatorFeeAmountCents,
      client_fee_amount:   trustedFees.clientFeeAmountCents,
      platform_revenue:    trustedFees.platformFeeCents,
      updated_at:          new Date().toISOString(),
      ...(normalizedPaymentType === 'final'
        ? { final_status: 'pending', final_payment_intent: paymentIntent.id }
        : { retainer_status: 'pending', retainer_payment_intent: paymentIntent.id }),
    };

    if (existingTxn?.id) {
      await supabaseAdmin
        .from('transactions')
        .update(transactionPatch)
        .eq('id', existingTxn.id);
    } else {
      await supabaseAdmin
        .from('transactions')
        .insert(transactionPatch);
    }

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('create-payment-intent error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
