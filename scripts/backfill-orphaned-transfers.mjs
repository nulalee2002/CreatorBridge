import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      if (env[key]) continue;
      env[key] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
  console.error('Error: Missing environment variables. The script requires:');
  console.error('- SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('- STRIPE_SECRET_KEY');
  console.error('\nPlease add these to your .env file or export them before running the script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
});

const ORPHANED_IDS = [
  '38e19b23-f476-49f6-89a0-81a12aa9e9ff',
  '4d278d89-3a7f-47bb-9ffb-3a85b2f27e07'
];

async function paymentIntentChargeId(paymentIntentId) {
  if (!paymentIntentId) return null;
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
    const latestCharge = paymentIntent.latest_charge;
    if (typeof latestCharge === 'string') return latestCharge;
    return latestCharge?.id ?? null;
  } catch (err) {
    console.error(`Stripe error retrieving payment intent ${paymentIntentId}:`, err.message);
    return null;
  }
}

async function backfillTransaction(txnId, dryRun = true) {
  console.log(`\n=== Processing Transaction: ${txnId} (Dry Run: ${dryRun}) ===`);
  
  const { data: txn, error: txnErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', txnId)
    .single();

  if (txnErr || !txn) {
    console.error(`- Transaction not found or could not be loaded:`, txnErr?.message || 'null');
    return;
  }

  console.log(`- Status: retainer=${txn.retainer_status}, final=${txn.final_status}`);
  console.log(`- Transfers: retainer=${txn.retainer_transfer_id}, final=${txn.final_transfer_id}`);

  if (txn.final_transfer_id || txn.final_status === 'released') {
    console.log(`- Skip: Payout already released.`);
    return;
  }

  if (txn.retainer_status !== 'paid' || txn.final_status !== 'paid') {
    console.error(`- Skip: Both payments must be marked 'paid' to release payout.`);
    return;
  }

  const { data: creatorListing, error: listingErr } = await supabase
    .from('creator_listings')
    .select('stripe_account_id')
    .eq('id', txn.creator_id)
    .single();

  const creatorStripeAccountId = creatorListing?.stripe_account_id;
  if (listingErr || !creatorStripeAccountId) {
    console.error(`- Skip: Creator profile has no connected Stripe account:`, listingErr?.message || 'null');
    return;
  }
  console.log(`- Creator Stripe Account ID: ${creatorStripeAccountId}`);

  const projectAmount = Math.max(0, Number(txn.project_amount || 0));
  const creatorFee = Math.max(0, Number(txn.creator_fee_amount || 0));
  const netToCreator = projectAmount - creatorFee;

  if (!netToCreator || netToCreator <= 0) {
    console.error(`- Skip: Invalid creator payout amount: ${netToCreator}`);
    return;
  }
  console.log(`- Payout Net Amount: $${(netToCreator / 100).toFixed(2)} (Project: $${(projectAmount / 100).toFixed(2)}, Fee: $${(creatorFee / 100).toFixed(2)})`);

  console.log(`- Resolving charge IDs from Stripe payment intents...`);
  const retainerChargeId = await paymentIntentChargeId(txn.retainer_payment_intent);
  const finalChargeId = await paymentIntentChargeId(txn.final_payment_intent);
  
  console.log(`  * Retainer PI: ${txn.retainer_payment_intent} -> Charge: ${retainerChargeId}`);
  console.log(`  * Final PI: ${txn.final_payment_intent} -> Charge: ${finalChargeId}`);

  const retainerTransferAmount = Math.min(netToCreator, Math.max(0, Number(txn.retainer_amount || 0)));
  const finalTransferAmount = netToCreator - retainerTransferAmount;

  if (!retainerChargeId || !finalChargeId || retainerTransferAmount <= 0 || finalTransferAmount <= 0) {
    console.error(`- Skip: Source charges or transfer amounts could not be verified.`);
    return;
  }

  console.log(`  * Retainer transfer amount: $${(retainerTransferAmount / 100).toFixed(2)}`);
  console.log(`  * Final transfer amount: $${(finalTransferAmount / 100).toFixed(2)}`);

  if (dryRun) {
    console.log(`- Dry Run success: Transaction is ready to be backfilled.`);
    return;
  }

  try {
    console.log(`- Creating Stripe retainer transfer...`);
    const retainerTransfer = await stripe.transfers.create({
      amount: retainerTransferAmount,
      currency: 'usd',
      destination: creatorStripeAccountId,
      source_transaction: retainerChargeId,
      metadata: {
        transactionId: txn.id,
        projectId: txn.project_id,
        paymentFlow: 'platform_charge_then_transfer',
        paymentType: 'creator_backfill_retainer_source',
      },
    }, {
      idempotencyKey: `cb_backfill_release_${txn.id}_retainer`,
    });
    console.log(`  * Retainer transfer created: ${retainerTransfer.id}`);

    console.log(`- Creating Stripe final transfer...`);
    const finalTransfer = await stripe.transfers.create({
      amount: finalTransferAmount,
      currency: 'usd',
      destination: creatorStripeAccountId,
      source_transaction: finalChargeId,
      metadata: {
        transactionId: txn.id,
        projectId: txn.project_id,
        paymentFlow: 'platform_charge_then_transfer',
        paymentType: 'creator_backfill_final_source',
      },
    }, {
      idempotencyKey: `cb_backfill_release_${txn.id}_final`,
    });
    console.log(`  * Final transfer created: ${finalTransfer.id}`);

    console.log(`- Updating database transaction record...`);
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        final_status: 'released',
        retainer_transfer_id: retainerTransfer.id,
        final_transfer_id: finalTransfer.id,
        final_released_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', txn.id);

    if (updateErr) {
      throw new Error(`DB Update failed: ${updateErr.message}`);
    }
    console.log(`  * Transaction successfully marked as released.`);

    console.log(`- Inserting payment event...`);
    const { error: eventErr } = await supabase.from('payment_events').insert({
      transaction_id: txn.id,
      event_type: 'backfilled_and_released',
      actor_id: null,
      metadata: {
        retainerTransferId: retainerTransfer.id,
        finalTransferId: finalTransfer.id,
        amount: netToCreator,
        backfill: true,
      },
    });

    if (eventErr) {
      console.warn(`  * Warning: Payment event logging failed: ${eventErr.message}`);
    } else {
      console.log(`  * Payment event logged successfully.`);
    }

    console.log(`- Backfill completed successfully for transaction: ${txn.id}`);
  } catch (err) {
    console.error(`- Backfill failed for transaction ${txn.id}:`, err.message);
  }
}

async function run() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('CreatorBridge Orphaned Payouts Backfill Tool');
  console.log('============================================');
  if (dryRun) {
    console.log('NOTE: Running in DRY RUN mode. Pass --execute to apply changes to Stripe and Supabase.');
  } else {
    console.log('WARNING: RUNNING IN ACTIVE MODE. This will create real Stripe transfers and update database rows.');
  }

  for (const id of ORPHANED_IDS) {
    await backfillTransaction(id, dryRun);
  }
}

run().catch(err => {
  console.error('Fatal backfill error:', err);
  process.exit(1);
});
