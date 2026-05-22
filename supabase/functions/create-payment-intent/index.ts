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
  const totalCreatorFeeAmountCents = Math.round(total * (creatorFeePct / 100));
  const totalClientFeeAmountCents = Math.round(total * (clientFeePct / 100));
  const chargeClientFeeAmountCents = Math.round(base * (clientFeePct / 100));

  return {
    projectAmountCents: total,
    retainerAmountCents: retainerBase,
    finalAmountCents: finalBase,
    chargeAmountCents: base + chargeClientFeeAmountCents,
    platformFeeCents: totalCreatorFeeAmountCents + totalClientFeeAmountCents,
    creatorFeeAmountCents: totalCreatorFeeAmountCents,
    clientFeeAmountCents: totalClientFeeAmountCents,
    chargeClientFeeAmountCents,
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
      creatorId,
      clientId,
      paymentType = 'retainer',  // 'retainer' | 'final'
    } = await req.json();

    const normalizedPaymentType = paymentType === 'final' ? 'final' : 'retainer';

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
      .select('id, client_id, budget_min, budget_max, accepted_creator_id, accepted_application_id, status')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !project || project.client_id !== clientId) {
      return new Response(
        JSON.stringify({ error: 'Project ownership could not be verified' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project.accepted_creator_id || project.accepted_creator_id !== creatorId) {
      return new Response(
        JSON.stringify({ error: 'A creator must be accepted for this project before payment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectStatus = String(project.status || '').toLowerCase();

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

    const { data: existingTxn } = await supabaseAdmin
      .from('transactions')
      .select('id, retainer_status, final_status, retainer_payment_intent, final_payment_intent')
      .eq('project_id', projectId)
      .eq('creator_id', creatorId)
      .eq('client_id', clientId)
      .maybeSingle();

    const existingPaymentIntentId = normalizedPaymentType === 'final'
      ? existingTxn?.final_payment_intent
      : existingTxn?.retainer_payment_intent;
    const existingPaymentStatus = normalizedPaymentType === 'final'
      ? existingTxn?.final_status
      : existingTxn?.retainer_status;

    if (['paid', 'released'].includes(existingPaymentStatus || '')) {
      return new Response(
        JSON.stringify({ error: `${normalizedPaymentType} payment has already been completed` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (normalizedPaymentType === 'retainer' && !['accepted'].includes(projectStatus)) {
      return new Response(
        JSON.stringify({ error: 'Retainer payment is only available after a project application is accepted' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (normalizedPaymentType === 'final') {
      if (!['paid', 'released'].includes(existingTxn?.retainer_status || '')) {
        return new Response(
          JSON.stringify({ error: 'The retainer must be paid before final payment can be created' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['delivered', 'approved'].includes(projectStatus)) {
        return new Response(
          JSON.stringify({ error: 'Final payment is only available after the creator has delivered the project' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (existingPaymentIntentId && existingPaymentStatus === 'pending') {
      const existingIntent = await stripe.paymentIntents.retrieve(existingPaymentIntentId);
      if (existingIntent?.client_secret && !['canceled', 'succeeded'].includes(existingIntent.status)) {
        return new Response(
          JSON.stringify({ clientSecret: existingIntent.client_secret, paymentIntentId: existingIntent.id, reused: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_booking_fee_waived, next_booking_fee_waived')
      .eq('id', clientId)
      .maybeSingle();

    let trustedProjectAmount = Number(project.budget_max ?? project.budget_min ?? 0);
    if (project.accepted_application_id) {
      const { data: acceptedApplication, error: acceptedApplicationError } = await supabaseAdmin
        .from('project_applications')
        .select('id, project_id, listing_id, status, proposed_rate')
        .eq('id', project.accepted_application_id)
        .eq('project_id', projectId)
        .eq('listing_id', creatorId)
        .maybeSingle();

      if (acceptedApplicationError || !acceptedApplication) {
        return new Response(
          JSON.stringify({ error: 'Accepted proposal amount could not be verified' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (acceptedApplication.status !== 'accepted') {
        return new Response(
          JSON.stringify({ error: 'Accepted proposal is not ready for payment' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      trustedProjectAmount = Number(acceptedApplication.proposed_rate || 0);
      if (!Number.isFinite(trustedProjectAmount) || trustedProjectAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'Accepted proposal must include a positive project rate before payment' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const trustedProjectAmountCents = Math.round(trustedProjectAmount * 100);
    const trustedCreatorFeePct = creatorFeePctFor(listing.completed_projects, listing.next_project_fee_pct);
    const trustedClientFeePct = profile?.first_booking_fee_waived || profile?.next_booking_fee_waived ? 0 : 5;
    const trustedFees = calculateTrustedFees(
      trustedProjectAmountCents,
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
      metadata: {
        projectId:   projectId ?? '',
        paymentType: normalizedPaymentType,
        creatorId:   creatorId ?? '',
        clientId:    clientId  ?? '',
        paymentFlow: 'platform_charge_then_transfer',
      },
    }, {
      idempotencyKey: `cb_${projectId}_${creatorId}_${clientId}_${normalizedPaymentType}`,
    });

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
      payment_flow:        'platform_charge_then_transfer',
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
