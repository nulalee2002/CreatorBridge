import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { projectChangeOrderFinalsPaid, releasePaidChangeOrders } from '../_shared/changeOrderRelease.ts';
import { isIdentityEventType, processIdentityEvent } from '../_shared/identityEventProcessor.js';
// stripe-webhook is validated via Stripe signature, not rate limited

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

function calculateCreatorTier(completedProjects: number, rating = 0, completionRate = 100) {
  if (completedProjects >= 50 && rating >= 4.7 && completionRate >= 95) return 'elite';
  if (completedProjects >= 25 && rating >= 4.5 && completionRate >= 90) return 'signature';
  if (completedProjects >= 10 && rating >= 4.0 && completionRate >= 80) return 'proven';
  return 'launch';
}

async function markInviteReferralCompleted(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('referrals')
    .update({
      status: 'completed',
      completed_at: now,
      completed_project_id: txn.project_id,
      completed_transaction_id: txn.id,
      review_reason: 'creator_credit_grants_after_released_project',
    })
    .eq('referred_user_id', txn.client_id)
    .eq('reward_type', 'creator_platform_credit')
    .eq('reward_issued', false);
}

async function grantReferralCreditForReleasedTransaction(
  supabaseAdmin: ReturnType<typeof createClient>,
  transactionId: string
) {
  const { error } = await supabaseAdmin.rpc('grant_referral_credit_for_released_transaction', {
    p_transaction_id: transactionId,
  });
  if (error) {
    console.warn('stripe-webhook: referral credit grant skipped', error.message);
  }
}

async function paymentFingerprintFromIntent(pi: Stripe.PaymentIntent) {
  const paymentMethod = pi.payment_method;
  if (!paymentMethod) {
    return { paymentMethodId: null, fingerprint: null };
  }

  if (typeof paymentMethod === 'string') {
    try {
      const retrieved = await stripe.paymentMethods.retrieve(paymentMethod);
      return {
        paymentMethodId: paymentMethod,
        fingerprint: retrieved.card?.fingerprint ?? null,
      };
    } catch (error) {
      console.warn('stripe-webhook: payment method fingerprint unavailable', error.message);
      return { paymentMethodId: paymentMethod, fingerprint: null };
    }
  }

  return {
    paymentMethodId: paymentMethod.id ?? null,
    fingerprint: paymentMethod.card?.fingerprint ?? null,
  };
}

async function markProjectCompleted(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  if (!(await projectChangeOrderFinalsPaid(supabaseAdmin, txn.project_id))) return;
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

  await markInviteReferralCompleted(supabaseAdmin, txn);
}

async function releaseCreatorPayout(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  if (txn.final_transfer_id || txn.final_status === 'released') return;
  if (txn.retainer_status !== 'paid' || txn.final_status !== 'paid') return;
  if (!(await projectChangeOrderFinalsPaid(supabaseAdmin, txn.project_id))) return;

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

  const retainerChargeId = await paymentIntentChargeId(txn.retainer_payment_intent);
  const finalChargeId = await paymentIntentChargeId(txn.final_payment_intent);
  const retainerTransferAmount = Math.min(netToCreator, Math.max(0, Number(txn.retainer_amount || 0)));
  const finalTransferAmount = netToCreator - retainerTransferAmount;

  if (!retainerChargeId || !finalChargeId || retainerTransferAmount <= 0 || finalTransferAmount <= 0) {
    throw new Error('Creator payout source charges could not be verified');
  }

  const retainerTransfer = await stripe.transfers.create({
    amount: retainerTransferAmount,
    currency: 'usd',
    destination: creatorStripeAccountId,
    source_transaction: retainerChargeId,
    metadata: {
      transactionId: txn.id,
      projectId: txn.project_id,
      paymentFlow: 'platform_charge_then_transfer',
      paymentType: 'creator_release_retainer_source',
    },
  }, {
    idempotencyKey: `cb_webhook_release_${txn.id}_retainer`,
  });

  const finalTransfer = await stripe.transfers.create({
    amount: finalTransferAmount,
    currency: 'usd',
    destination: creatorStripeAccountId,
    source_transaction: finalChargeId,
    metadata: {
      transactionId: txn.id,
      projectId: txn.project_id,
      paymentFlow: 'platform_charge_then_transfer',
      paymentType: 'creator_release_final_source',
    },
  }, {
    idempotencyKey: `cb_webhook_release_${txn.id}_final`,
  });

  await supabaseAdmin
    .from('transactions')
    .update({
      final_status: 'released',
      retainer_transfer_id: retainerTransfer.id,
      final_transfer_id: finalTransfer.id,
      final_released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.id)
    .is('final_transfer_id', null);

  await supabaseAdmin.from('payment_events').insert({
    transaction_id: txn.id,
    event_type: 'creator_payout_released',
    metadata: {
      retainerTransferId: retainerTransfer.id,
      finalTransferId: finalTransfer.id,
      amount: netToCreator,
      paymentFlow: 'platform_charge_then_transfer',
    },
  });

  await grantReferralCreditForReleasedTransaction(supabaseAdmin, txn.id);
}

async function paymentIntentChargeId(paymentIntentId?: string | null) {
  if (!paymentIntentId) return null;

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const latestCharge = paymentIntent.latest_charge;

  if (typeof latestCharge === 'string') return latestCharge;
  return latestCharge?.id ?? null;
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

async function consumeAppliedCreatorCredit(supabaseAdmin: ReturnType<typeof createClient>, txn: Record<string, any>) {
  const appliedCents = Math.max(0, Number(txn.creator_credit_applied || 0));
  if (!appliedCents || !txn.creator_id || !txn.id) return;

  const { data: creatorListing } = await supabaseAdmin
    .from('creator_listings')
    .select('user_id')
    .eq('id', txn.creator_id)
    .maybeSingle();

  if (!creatorListing?.user_id) return;

  await supabaseAdmin
    .from('creator_credit_ledger')
    .insert({
      creator_user_id: creatorListing.user_id,
      amount_cents: -appliedCents,
      source: 'creator_fee_offset',
      transaction_id: txn.id,
      reason: 'applied_to_creator_fee',
    });
}

async function triggerWebhookEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  txn: Record<string, any>,
  template: 'retainer_paid' | 'final_paid'
) {
  try {
    const { data: creator } = await supabaseAdmin
      .from('creator_listings')
      .select('email, name')
      .eq('id', txn.creator_id)
      .maybeSingle();

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id', txn.project_id)
      .maybeSingle();

    if (!creator?.email) {
      console.warn('Cannot send webhook email: creator email not found', txn.creator_id);
      return;
    }

    const creatorEmail = creator.email;
    const creatorName = creator.name || 'Creator';
    const projectTitle = project?.title || 'your project';

    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    let emailData: Record<string, any> = {};
    if (template === 'retainer_paid') {
      const retainerAmt = Number(txn.retainer_amount || 0) / 100;
      emailData = {
        creator_name: creatorName,
        project_title: projectTitle,
        retainer_amount: retainerAmt,
      };
    } else if (template === 'final_paid') {
      const projectAmount = Math.max(0, Number(txn.project_amount || 0));
      const creatorFee = Math.max(0, Number(txn.creator_fee_amount || 0));
      const netToCreator = projectAmount - creatorFee;
      const retainerTransferAmount = Math.min(netToCreator, Math.max(0, Number(txn.retainer_amount || 0)));
      const finalTransferAmount = netToCreator - retainerTransferAmount;
      const payoutAmt = finalTransferAmount / 100;
      emailData = {
        creator_name: creatorName,
        project_title: projectTitle,
        payout_amount: payoutAmt,
      };
    }

    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        to: creatorEmail,
        template,
        data: emailData,
      }),
    });

    if (!res.ok) {
      console.error(`Failed to send email notification inside webhook: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('Error triggering webhook email:', err);
  }
}

async function notifyRevisionPurchaseClient(
  supabaseAdmin: ReturnType<typeof createClient>,
  purchase: Record<string, any>,
  outcome: 'succeeded' | 'failed'
) {
  const title = outcome === 'succeeded'
    ? 'Additional revision unlocked'
    : 'Additional revision payment needs attention';
  const body = outcome === 'succeeded'
    ? 'Your $50 payment is confirmed. You can now submit one additional revision request.'
    : 'The $50 payment was not completed, so no additional revision was unlocked.';

  const { error: notificationError } = await supabaseAdmin.rpc('create_platform_notification', {
    p_recipient_id: purchase.client_id,
    p_type: 'system',
    p_title: title,
    p_body: body,
    p_action_url: `/projects/${purchase.project_id}`,
    p_metadata: { project_id: purchase.project_id, revision_purchase_id: purchase.id },
    p_actor_id: null,
    p_response_due_at: null,
  });
  if (notificationError) console.error('Paid-revision notification failed:', notificationError.message);

  try {
    const [{ data: authUser }, { data: project }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(purchase.client_id),
      supabaseAdmin.from('projects').select('title').eq('id', purchase.project_id).maybeSingle(),
    ]);
    if (!authUser?.user?.email) return;
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
      },
      body: JSON.stringify({
        to: authUser.user.email,
        template: outcome === 'succeeded' ? 'revision_purchase_succeeded' : 'revision_purchase_failed',
        data: { project_title: project?.title || 'your project' },
      }),
    });
    if (!response.ok) console.error('Paid-revision email failed:', response.status);
  } catch (error) {
    console.error('Paid-revision email dispatch failed:', error instanceof Error ? error.message : error);
  }
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
    if (isIdentityEventType(event.type)) {
      return await processIdentityEvent({ event, stripe, admin: supabaseAdmin });
    }

    const { data: processedEvent } = await supabaseAdmin
      .from('payment_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (processedEvent) {
      if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.paymentType === 'final') {
          const { data: txn } = await supabaseAdmin
            .from('transactions')
            .select('*')
            .eq('final_payment_intent', pi.id)
            .maybeSingle();

          if (txn && txn.retainer_status === 'paid' && txn.final_status === 'paid' && !txn.final_transfer_id) {
            await releaseCreatorPayout(supabaseAdmin, txn);
          }
        }
      }

      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    switch (event.type) {

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentFlow = pi.metadata?.paymentFlow;
        if (paymentFlow === 'paid_revision') {
          if (
            pi.metadata?.paymentType !== 'project_revision'
            || !pi.metadata?.revisionPurchaseId
            || pi.currency !== 'usd'
            || pi.amount !== 5_000
          ) {
            throw new Error('Invalid paid-revision payment metadata or amount');
          }

          const { data: purchase, error: purchaseError } = await supabaseAdmin
            .from('project_revision_purchases')
            .select('id, project_id, client_id, creator_listing_id, gross_amount_cents, client_fee_cents, payment_status')
            .eq('id', pi.metadata.revisionPurchaseId)
            .eq('stripe_payment_intent_id', pi.id)
            .maybeSingle();
          if (purchaseError) throw purchaseError;
          if (!purchase) throw new Error('Trusted paid-revision ledger not found');
          if (Number(purchase.gross_amount_cents) !== 5_000 || Number(purchase.client_fee_cents) !== 0) {
            throw new Error('Paid-revision ledger amount mismatch');
          }

          const settledAt = new Date().toISOString();
          const { data: settled, error: settleError } = await supabaseAdmin
            .from('project_revision_purchases')
            .update({
              payment_status: 'succeeded',
              entitlement_status: 'available',
              stripe_event_id: event.id,
              failure_code: null,
              paid_at: settledAt,
              updated_at: settledAt,
            })
            .eq('id', purchase.id)
            .eq('payment_status', 'pending')
            .eq('entitlement_status', 'pending')
            .select('id')
            .maybeSingle();
          if (settleError) throw settleError;

          if (settled) {
            const { data: creator } = await supabaseAdmin
              .from('creator_listings')
              .select('user_id')
              .eq('id', purchase.creator_listing_id)
              .maybeSingle();
            await Promise.all([
              notifyRevisionPurchaseClient(supabaseAdmin, purchase, 'succeeded'),
              creator?.user_id
                ? supabaseAdmin.rpc('create_platform_notification', {
                    p_recipient_id: creator.user_id,
                    p_type: 'system',
                    p_title: 'Client purchased an additional revision',
                    p_body: 'One paid revision is available for this project. You will be notified when the client submits the request.',
                    p_action_url: `/projects/${purchase.project_id}`,
                    p_metadata: { project_id: purchase.project_id, revision_purchase_id: purchase.id },
                    p_actor_id: null,
                    p_response_due_at: null,
                  })
                : Promise.resolve(),
            ]);
          }
          break;
        }
        if (paymentFlow === 'change_order') {
          const phase = pi.metadata?.paymentType === 'change_order_retainer'
            ? 'retainer'
            : pi.metadata?.paymentType === 'change_order_final'
              ? 'final'
              : null;
          if (!phase || !pi.metadata?.changeOrderId || pi.currency !== 'usd') {
            throw new Error('Invalid change-order payment metadata');
          }
          const { data: ledger } = await supabaseAdmin
            .from('change_order_payments')
            .select('*')
            .eq('change_order_id', pi.metadata.changeOrderId)
            .eq(phase === 'retainer' ? 'retainer_payment_intent' : 'final_payment_intent', pi.id)
            .maybeSingle();
          if (!ledger) throw new Error('Trusted change-order payment ledger not found');
          const expectedAmount = phase === 'retainer'
            ? Number(ledger.retainer_amount_cents)
            : Number(ledger.final_amount_cents) + Math.round(Number(ledger.added_amount_cents) * Number(ledger.client_fee_pct) / 100);
          if (pi.amount !== expectedAmount) throw new Error('Change-order payment amount mismatch');
          const now = new Date().toISOString();
          const patch = phase === 'retainer'
            ? { retainer_status: 'paid', retainer_paid_at: now, retainer_stripe_event_id: event.id, updated_at: now }
            : { final_status: 'paid', final_paid_at: now, final_stripe_event_id: event.id, updated_at: now };
          await supabaseAdmin.from('change_order_payments').update(patch).eq('id', ledger.id);
          if (phase === 'retainer') {
            await supabaseAdmin.from('contract_change_orders')
              .update({ status: 'active', activated_at: now, updated_at: now })
              .eq('id', ledger.change_order_id)
              .eq('status', 'awaiting_additional_retainer');
          } else {
            const { data: txn } = await supabaseAdmin.from('transactions').select('*')
              .eq('project_id', ledger.project_id).maybeSingle();
            if (txn && await projectChangeOrderFinalsPaid(supabaseAdmin, ledger.project_id)) {
              const { data: listing } = await supabaseAdmin.from('creator_listings')
                .select('stripe_account_id').eq('id', ledger.creator_id).maybeSingle();
              if (listing?.stripe_account_id) {
                await releasePaidChangeOrders(supabaseAdmin, stripe, ledger.project_id, listing.stripe_account_id);
              }
              await markProjectCompleted(supabaseAdmin, txn);
              await releaseCreatorPayout(supabaseAdmin, txn);
            }
          }
          break;
        }
        if (pi.metadata?.paymentType === 'creator_collaboration') {
          const settledAt = new Date().toISOString();
          const { data: payment } = await supabaseAdmin.from('collaboration_payments').update({ status: 'succeeded', stripe_event_id: event.id, settled_at: settledAt, updated_at: settledAt }).eq('stripe_payment_intent_id', pi.id).select('collaboration_id').maybeSingle();
          if (payment?.collaboration_id) {
            await supabaseAdmin.from('creator_collaborations').update({ status: 'funded', funded_at: settledAt, updated_at: settledAt }).eq('id', payment.collaboration_id).eq('status', 'funding_pending');
          }
          break;
        }
        const { projectId, paymentType, creatorId, clientId } = pi.metadata;

        if (paymentType === 'retainer') {
          const paymentAudit = await paymentFingerprintFromIntent(pi);
          await supabaseAdmin
            .from('transactions')
            .update({
              retainer_status:         'paid',
              retainer_payment_intent: pi.id,
              retainer_paid_at:        new Date().toISOString(),
              client_payment_method_id: paymentAudit.paymentMethodId,
              client_payment_fingerprint: paymentAudit.fingerprint,
              updated_at:              new Date().toISOString(),
            })
            .eq('retainer_payment_intent', pi.id);
        } else if (paymentType === 'final') {
          const paymentAudit = await paymentFingerprintFromIntent(pi);
          await supabaseAdmin
            .from('transactions')
            .update({
              final_status:         'paid',
              final_payment_intent: pi.id,
              final_paid_at:        new Date().toISOString(),
              client_payment_method_id: paymentAudit.paymentMethodId,
              client_payment_fingerprint: paymentAudit.fingerprint,
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
          if (paymentType === 'final') {
            await markProjectCompleted(supabaseAdmin, txn);
            await releaseCreatorPayout(supabaseAdmin, {
              ...txn,
              final_status: 'paid',
              final_paid_at: new Date().toISOString(),
            });
            await triggerWebhookEmail(supabaseAdmin, txn, 'final_paid');
          }

          await supabaseAdmin.from('payment_events').insert({
            transaction_id: txn.id,
            event_type:     `${paymentType}_payment_succeeded`,
            stripe_event_id: event.id,
            metadata:       { paymentIntentId: pi.id, amount: pi.amount },
          });

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
            await consumeAppliedCreatorCredit(supabaseAdmin, txn);
            await triggerWebhookEmail(supabaseAdmin, txn, 'retainer_paid');
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentFlow = pi.metadata?.paymentFlow;
        if (paymentFlow === 'paid_revision') {
          if (pi.metadata?.revisionPurchaseId && pi.metadata?.paymentType === 'project_revision') {
            const { data: purchase } = await supabaseAdmin
              .from('project_revision_purchases')
              .update({
                payment_status: 'failed',
                failure_code: pi.last_payment_error?.code ?? 'payment_failed',
                stripe_event_id: event.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', pi.metadata.revisionPurchaseId)
              .eq('stripe_payment_intent_id', pi.id)
              .eq('payment_status', 'pending')
              .eq('entitlement_status', 'pending')
              .select('id, project_id, client_id')
              .maybeSingle();
            if (purchase) await notifyRevisionPurchaseClient(supabaseAdmin, purchase, 'failed');
          }
          break;
        }
        if (paymentFlow === 'change_order') {
          const phase = pi.metadata?.paymentType === 'change_order_retainer'
            ? 'retainer'
            : pi.metadata?.paymentType === 'change_order_final'
              ? 'final'
              : null;
          if (phase && pi.metadata?.changeOrderId) {
            await supabaseAdmin.from('change_order_payments')
              .update({
                [phase === 'retainer' ? 'retainer_status' : 'final_status']: 'failed',
                updated_at: new Date().toISOString(),
              })
              .eq('change_order_id', pi.metadata.changeOrderId)
              .eq(phase === 'retainer' ? 'retainer_payment_intent' : 'final_payment_intent', pi.id);
          }
          break;
        }
        if (pi.metadata?.paymentType === 'creator_collaboration') {
          await supabaseAdmin.from('collaboration_payments').update({ status: 'failed', stripe_event_id: event.id, updated_at: new Date().toISOString() }).eq('stripe_payment_intent_id', pi.id);
          await supabaseAdmin.from('creator_collaborations').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', pi.metadata.collaborationId).eq('status', 'funding_pending');
          break;
        }
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

      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.paymentFlow === 'paid_revision'
          && pi.metadata?.paymentType === 'project_revision'
          && pi.metadata?.revisionPurchaseId) {
          const { data: purchase } = await supabaseAdmin
            .from('project_revision_purchases')
            .update({
              payment_status: 'canceled',
              failure_code: pi.cancellation_reason ?? 'canceled',
              stripe_event_id: event.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', pi.metadata.revisionPurchaseId)
            .eq('stripe_payment_intent_id', pi.id)
            .eq('payment_status', 'pending')
            .eq('entitlement_status', 'pending')
            .select('id, project_id, client_id')
            .maybeSingle();
          if (purchase) await notifyRevisionPurchaseClient(supabaseAdmin, purchase, 'failed');
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
