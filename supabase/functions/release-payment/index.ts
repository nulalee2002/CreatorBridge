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
 * Body: { transactionId, actorId, autoApprove?: boolean }
 *
 * Logic:
 *   - Creates a Stripe Transfer of the final net amount to the creator's connected account
 *   - Deducts 10% creator fee (already factored into the transfer amount)
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
    const { transactionId, actorId, autoApprove = false } = await req.json();

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

    if (txn.final_status === 'released') {
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

    // Net to creator: final_amount minus creator_fee_amount (both in cents)
    const netToCreator = txn.final_amount - (txn.creator_fee_amount ?? 0);

    // Create Stripe Transfer to creator
    const transfer = await stripe.transfers.create({
      amount:      netToCreator,
      currency:    'usd',
      destination: creatorStripeAccountId,
      metadata: {
        transactionId,
        paymentType: 'final_release',
        autoApprove: String(autoApprove),
      },
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
      actor_id:       actorId ?? null,
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
