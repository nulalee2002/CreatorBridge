import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// stripe-webhook is validated via Stripe signature, not rate limited

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

function calculateCreatorTier(completedProjects: number, rating = 0, completionRate = 100) {
  if (completedProjects >= 50 && rating >= 4.7 && completionRate >= 95) return 'signature';
  if (completedProjects >= 20 && rating >= 4.5 && completionRate >= 90) return 'elite';
  if (completedProjects >= 5 && rating >= 4.0 && completionRate >= 80) return 'proven';
  return 'launch';
}

async function issueReferralRewards(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  const now = new Date().toISOString();
  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('referred_user_id', txn.client_id)
    .eq('reward_issued', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!referral) return;

  if (referral.reward_type === 'tier_boost') {
    const { data: listing } = await supabaseAdmin
      .from('creator_listings')
      .select('id, completed_projects, rating, completion_rate')
      .eq('user_id', referral.referrer_id)
      .maybeSingle();

    if (listing?.id) {
      const completed = Number(listing.completed_projects || 0) + 1;
      await supabaseAdmin
        .from('creator_listings')
        .update({
          completed_projects: completed,
          tier: calculateCreatorTier(completed, Number(listing.rating || 0), Number(listing.completion_rate || 100)),
        })
        .eq('id', listing.id);
    }
  }

  if (referral.reward_type === 'booking_fee_waived') {
    await supabaseAdmin
      .from('profiles')
      .update({ next_booking_fee_waived: true })
      .eq('id', referral.referrer_id);
    await supabaseAdmin
      .from('client_profiles')
      .update({ next_booking_fee_waived: true })
      .eq('user_id', referral.referrer_id);
  }

  if (referral.reward_type === 'fee_reduction') {
    await supabaseAdmin
      .from('creator_listings')
      .update({ next_project_fee_pct: 7 })
      .eq('user_id', referral.referrer_id);
  }

  await supabaseAdmin
    .from('referrals')
    .update({
      status: 'completed',
      reward_issued: true,
      reward_issued_at: now,
      completed_at: now,
      completed_project_id: txn.project_id,
      completed_transaction_id: txn.id,
    })
    .eq('id', referral.id);
}

async function markProjectCompleted(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  const now = new Date().toISOString();
  const { data: listing } = await supabaseAdmin
    .from('creator_listings')
    .select('id, completed_projects, rating, completion_rate, next_project_fee_pct')
    .eq('id', txn.creator_id)
    .maybeSingle();

  if (listing?.id) {
    const completed = Number(listing.completed_projects || 0) + 1;
    await supabaseAdmin
      .from('creator_listings')
      .update({
        completed_projects: completed,
        tier: calculateCreatorTier(completed, Number(listing.rating || 0), Number(listing.completion_rate || 100)),
        ...(listing.next_project_fee_pct != null ? { next_project_fee_pct: null } : {}),
      })
      .eq('id', listing.id);
  }

  await supabaseAdmin
    .from('projects')
    .update({ status: 'final_paid', approved_at: now })
    .eq('id', txn.project_id);

  await issueReferralRewards(supabaseAdmin, txn);
}

async function releaseCreatorPayout(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  if (txn.final_transfer_id || txn.final_status === 'released') return;
  if (txn.retainer_status !== 'paid' || txn.final_status !== 'paid') return;

  const { data: creatorListing } = await supabaseAdmin
    .from('creator_listings')
    .select('stripe_account_id')
    .eq('id', txn.creator_id)
    .single();

  const creatorStripeAccountId = creatorListing?.stripe_account_id;
  if (!creatorStripeAccountId) {
    throw new Error('Creator has no connected Stripe account for payout release');
  }

  const projectAmount = Math.max(0, Number(txn.project_amount || 0));
  const creatorFee = Math.max(0, Number(txn.creator_fee_amount || 0));
  const netToCreator = projectAmount - creatorFee;

  if (!netToCreator || netToCreator <= 0) {
    throw new Error('Creator payout amount could not be verified');
  }

  const transfer = await stripe.transfers.create({
    amount: netToCreator,
    currency: 'usd',
    destination: creatorStripeAccountId,
    metadata: {
      transactionId: txn.id,
      projectId: txn.project_id,
      paymentFlow: 'platform_charge_then_transfer',
      paymentType: 'full_creator_release',
    },
  }, {
    idempotencyKey: `cb_webhook_release_${txn.id}`,
  });

  await supabaseAdmin
    .from('transactions')
    .update({
      final_status: 'released',
      final_transfer_id: transfer.id,
      final_released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.id)
    .is('final_transfer_id', null);

  await supabaseAdmin.from('payment_events').insert({
    transaction_id: txn.id,
    event_type: 'creator_payout_released',
    metadata: {
      transferId: transfer.id,
      amount: netToCreator,
      paymentFlow: 'platform_charge_then_transfer',
    },
  });
}

async function consumeClientFeeWaiver(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  if (Number(txn.client_fee_pct ?? 5) !== 0 || !txn.client_id) return;

  await supabaseAdmin
    .from('profiles')
    .update({ first_booking_fee_waived: false, next_booking_fee_waived: false })
    .eq('id', txn.client_id);

  await supabaseAdmin
    .from('client_profiles')
    .update({ first_booking_fee_waived: false, next_booking_fee_waived: false })
    .eq('user_id', txn.client_id);
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: processedEvent } = await supabaseAdmin
      .from('payment_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (processedEvent) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { projectId, paymentType, creatorId, clientId } = pi.metadata;

        if (paymentType === 'retainer') {
          await supabaseAdmin
            .from('transactions')
            .update({
              retainer_status:         'paid',
              retainer_payment_intent: pi.id,
              retainer_paid_at:        new Date().toISOString(),
              updated_at:              new Date().toISOString(),
            })
            .eq('retainer_payment_intent', pi.id);
        } else if (paymentType === 'final') {
          await supabaseAdmin
            .from('transactions')
            .update({
              final_status:         'paid',
              final_payment_intent: pi.id,
              final_paid_at:        new Date().toISOString(),
              updated_at:           new Date().toISOString(),
            })
            .eq('final_payment_intent', pi.id);
        }

        const { data: txn } = await supabaseAdmin
          .from('transactions')
          .select('*')
          .eq(paymentType === 'retainer' ? 'retainer_payment_intent' : 'final_payment_intent', pi.id)
          .single();

        if (txn) {
          await supabaseAdmin.from('payment_events').insert({
            transaction_id: txn.id,
            event_type:     `${paymentType}_payment_succeeded`,
            stripe_event_id: event.id,
            metadata:       { paymentIntentId: pi.id, amount: pi.amount },
          });

          if (paymentType === 'final') {
            await markProjectCompleted(supabaseAdmin, txn);
            await releaseCreatorPayout(supabaseAdmin, {
              ...txn,
              final_status: 'paid',
              final_paid_at: new Date().toISOString(),
            });
          }

          if (paymentType === 'retainer') {
            // Move project from accepted → retainer_paid now that the retainer is secured
            if (txn.project_id) {
              await supabaseAdmin
                .from('projects')
                .update({ status: 'retainer_paid' })
                .eq('id', txn.project_id)
                .eq('status', 'accepted');
            }
            await consumeClientFeeWaiver(supabaseAdmin, txn);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const { paymentType } = pi.metadata;

        // Find and log
        const { data: txn } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq(paymentType === 'retainer' ? 'retainer_payment_intent' : 'final_payment_intent', pi.id)
          .single();

        if (txn) {
          await supabaseAdmin.from('payment_events').insert({
            transaction_id: txn.id,
            event_type:     `${paymentType}_payment_failed`,
            stripe_event_id: event.id,
            metadata:       {
              paymentIntentId:  pi.id,
              failureReason:    pi.last_payment_error?.message ?? 'Unknown',
            },
          });
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await supabaseAdmin
          .from('creator_listings')
          .update({
            stripe_onboarded: account.details_submitted && account.charges_enabled,
            payouts_enabled:  account.payouts_enabled,
          })
          .eq('stripe_account_id', account.id);
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        // Log the transfer against the transaction using the source_transaction
        const { data: txn } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .or(`retainer_payment_intent.eq.${transfer.source_transaction},final_payment_intent.eq.${transfer.source_transaction}`)
          .single();

        if (txn) {
          await supabaseAdmin.from('payment_events').insert({
            transaction_id: txn.id,
            event_type:     'transfer_created',
            stripe_event_id: event.id,
            metadata:       {
              transferId:   transfer.id,
              amount:       transfer.amount,
              destination:  transfer.destination,
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response(`Handler error: ${err.message}`, { status: 500 });
  }
});
