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

/**
 * release-payment
 * Called when:
 *   1. Client clicks "Approve Delivery"
 *   2. Auto-approve triggers after PLATFORM_FEES.autoApproveDays days
 *
 * Body: { transactionId, autoApprove?: boolean }
 *
 * Logic:
 *   - Creates one Stripe Transfer for the creator's net project payout
 *   - Requires both retainer and final payments to be paid first
 *   - Updates transaction final_status to 'released'
 *   - Logs a payment_event
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const { transactionId, autoApprove = false } = await req.json();

    if (!transactionId) {
      return new Response(
        JSON.stringify({ error: 'transactionId is required' }),
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

    const jobSecret = Deno.env.get('PLATFORM_JOB_SECRET') ?? '';
    const suppliedJobSecret = req.headers.get('x-creatorbridge-job-secret') ?? '';
    const isTrustedJob = Boolean(autoApprove && jobSecret && suppliedJobSecret === jobSecret);

    if (!isTrustedJob && (authError || !authData.user)) {
      return new Response(
        JSON.stringify({ error: 'Authentication is required to release payment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transaction, then fetch creator Stripe account separately. The schema stores
    // creator_id as text for compatibility with local/demo ids, so do not rely on an FK join.
    const { data: txn, error: txnErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txnErr || !txn) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isTrustedJob && authData.user?.id !== txn.client_id) {
      return new Response(
        JSON.stringify({ error: 'Only the paying client can release this payment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (txn.retainer_status !== 'paid' || txn.final_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: 'Both retainer and final payment must be paid before creator payout release' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (txn.final_status === 'released' || txn.final_transfer_id) {
      return new Response(
        JSON.stringify({ error: 'Payment already released' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: creatorListing } = await supabaseAdmin
      .from('creator_listings')
      .select('stripe_account_id')
      .eq('id', txn.creator_id)
      .single();

    const creatorStripeAccountId = creatorListing?.stripe_account_id;
    if (!creatorStripeAccountId) {
      return new Response(
        JSON.stringify({ error: 'Creator has no connected Stripe account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Net to creator: full project amount minus the creator platform fee.
    const netToCreator = Number(txn.project_amount || 0) - Number(txn.creator_fee_amount || 0);

    if (!netToCreator || netToCreator <= 0) {
      return new Response(
        JSON.stringify({ error: 'Creator payout amount could not be verified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe Transfer to creator
    const transfer = await stripe.transfers.create({
      amount:      netToCreator,
      currency:    'usd',
      destination: creatorStripeAccountId,
      metadata: {
        transactionId,
        paymentType: 'final_release',
        autoApprove: String(autoApprove),
        paymentFlow: 'platform_charge_then_transfer',
      },
    }, {
      idempotencyKey: `cb_release_${transactionId}`,
    });

    // Update transaction
    await supabaseAdmin
      .from('transactions')
      .update({
        final_status:       'released',
        final_transfer_id:  transfer.id,
        final_released_at:  new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .eq('id', transactionId);

    // Log payment event
    await supabaseAdmin.from('payment_events').insert({
      transaction_id: transactionId,
      event_type:     autoApprove ? 'auto_approved_and_released' : 'client_approved_and_released',
      actor_id:       isTrustedJob ? null : authData.user?.id ?? null,
      metadata: {
        transferId:    transfer.id,
        amount:        netToCreator,
        autoApprove,
      },
    });

    return new Response(
      JSON.stringify({ success: true, transferId: transfer.id, netToCreator }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('release-payment error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
