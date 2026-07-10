// End-to-end booking money-path test, Stripe TEST MODE ONLY.
// Exercises the real deployed functions and DB: accepted project -> retainer
// intent (created by the deployed create-payment-intent) -> Stripe test
// confirm -> webhook marks retainer paid -> delivery -> final intent (charges
// the one-time 5% client fee) -> confirm -> webhook marks paid + auto-releases
// transfers to the creator's connected account.
// Run: node --env-file=.env scripts/verify-booking-e2e.mjs
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const cfg = {
  url: process.env.VITE_SUPABASE_URL,
  anon: process.env.VITE_SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  stripe: process.env.STRIPE_SECRET_KEY,
  clientEmail: process.env.CREATORBRIDGE_QA_CLIENT_EMAIL,
  clientPassword: process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD,
  creatorEmail: process.env.CREATORBRIDGE_QA_CREATOR_EMAIL,
  creatorPassword: process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD,
};
const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.log(`SKIP: missing env ${missing.join(', ')}`); process.exit(0); }

// HARD GUARD: never run this against live Stripe.
if (!cfg.stripe.startsWith('sk_test_')) {
  console.error('ABORT: STRIPE_SECRET_KEY is not a test-mode key. This script only runs in test mode.');
  process.exit(1);
}

const PROJECT_RATE_DOLLARS = 500;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(cfg.url, cfg.service, opts);
const clientSb = createClient(cfg.url, cfg.anon, opts);
const creatorSb = createClient(cfg.url, cfg.anon, opts);
const stripe = new Stripe(cfg.stripe);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function pollTxn(projectId, predicate, label, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin.from('transactions').select('*').eq('project_id', projectId).maybeSingle();
    if (data && predicate(data)) return data;
    await sleep(4000);
  }
  throw new Error(`Timed out waiting for ${label} (webhook may not be configured for test events)`);
}

let projectId, appId, listingBefore, retainerIntentId, finalIntentId;
const summary = { mode: 'stripe_test', steps: [] };
const step = (name, detail) => { summary.steps.push({ name, ...detail }); console.log(`OK  ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`); };

try {
  // 1. Sign in both QA accounts
  const { data: clientAuth, error: cae } = await clientSb.auth.signInWithPassword({ email: cfg.clientEmail, password: cfg.clientPassword });
  if (cae) throw cae;
  const clientId = clientAuth.user.id;
  const { data: creatorAuth, error: cre } = await creatorSb.auth.signInWithPassword({ email: cfg.creatorEmail, password: cfg.creatorPassword });
  if (cre) throw cre;
  step('signed in QA client + creator');

  // 2. QA creator listing (approved + payout account)
  const { data: listing, error: le } = await admin.from('creator_listings')
    .select('id, user_id, stripe_account_id, completed_projects, rating, completion_rate, next_project_fee_pct')
    .eq('user_id', creatorAuth.user.id).eq('review_status', 'approved').limit(1).single();
  if (le) throw le;
  assert(listing.stripe_account_id, 'QA creator has no Stripe payout account');
  listingBefore = { ...listing };
  const expectedFeePct = listing.completed_projects >= 25 ? 6 : listing.completed_projects >= 10 ? 8 : 10;
  step('found QA creator listing', { completed_projects: listing.completed_projects, expectedFeePct });

  // 3. Accepted project + accepted application (the state after brief -> match -> accept)
  const { data: project, error: pe } = await admin.from('projects').insert({
    client_id: clientId,
    title: 'QA E2E booking verification',
    description: 'Temporary end-to-end money-path verification project. Safe to delete.',
    service_id: 'video',
    budget_min: PROJECT_RATE_DOLLARS,
    budget_max: PROJECT_RATE_DOLLARS,
    status: 'accepted',
    accepted_creator_id: listing.id,
  }).select('id').single();
  if (pe) throw pe;
  projectId = project.id;
  const { data: app, error: ae } = await admin.from('project_applications').insert({
    project_id: projectId, listing_id: listing.id, status: 'accepted',
    proposed_rate: PROJECT_RATE_DOLLARS, message: 'QA E2E accepted proposal',
  }).select('id').single();
  if (ae) throw ae;
  appId = app.id;
  await admin.from('projects').update({ accepted_application_id: appId }).eq('id', projectId);
  step('created accepted project + proposal', { projectId });

  // 4. Retainer intent via the DEPLOYED function, as the client
  const { data: retainer, error: rfe } = await clientSb.functions.invoke('create-payment-intent', {
    body: { projectId, creatorId: listing.id, clientId, paymentType: 'retainer' },
  });
  if (rfe || retainer?.error) throw new Error(retainer?.error || rfe?.message || 'retainer intent failed');
  retainerIntentId = retainer.paymentIntentId;
  const retainerPi = await stripe.paymentIntents.retrieve(retainerIntentId);
  assert(retainerPi.amount === PROJECT_RATE_DOLLARS * 100 * 0.5,
    `retainer must be 50% with NO client fee (got ${retainerPi.amount})`);
  step('retainer intent amount correct', { cents: retainerPi.amount });

  // 5. Confirm with the standard Stripe test payment method
  const confirmedRetainer = await stripe.paymentIntents.confirm(retainerIntentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://www.creatorbridge.studio/projects',
  });
  assert(confirmedRetainer.status === 'succeeded', `retainer confirm status ${confirmedRetainer.status}`);
  step('retainer charged (test card)');

  // 6. Webhook settles the retainer
  const txnAfterRetainer = await pollTxn(projectId, t => t.retainer_status === 'paid', 'retainer_status=paid');
  assert(Number(txnAfterRetainer.creator_fee_pct) === expectedFeePct,
    `creator_fee_pct must be ${expectedFeePct}, got ${txnAfterRetainer.creator_fee_pct}`);
  assert(Number(txnAfterRetainer.client_fee_pct) === 5, `client_fee_pct must be 5, got ${txnAfterRetainer.client_fee_pct}`);
  step('webhook marked retainer paid', { creator_fee_pct: txnAfterRetainer.creator_fee_pct });

  // 7. Creator delivers
  await admin.from('projects').update({
    status: 'delivered', delivered_at: new Date().toISOString(),
    delivery_link: 'https://iframe.mediadelivery.net/qa-e2e-placeholder', delivery_notes: 'QA E2E delivery',
  }).eq('id', projectId);
  step('project delivered');

  // 8. Final intent: 50% + the one-time 5% client fee on the WHOLE total
  const { data: fin, error: ffe } = await clientSb.functions.invoke('create-payment-intent', {
    body: { projectId, creatorId: listing.id, clientId, paymentType: 'final' },
  });
  if (ffe || fin?.error) throw new Error(fin?.error || ffe?.message || 'final intent failed');
  finalIntentId = fin.paymentIntentId;
  const finalPi = await stripe.paymentIntents.retrieve(finalIntentId);
  const expectedFinalCents = PROJECT_RATE_DOLLARS * 100 * 0.5 + PROJECT_RATE_DOLLARS * 100 * 0.05;
  assert(finalPi.amount === expectedFinalCents,
    `final must be 50% + 5% once (${expectedFinalCents}), got ${finalPi.amount}`);
  step('final intent amount correct', { cents: finalPi.amount });

  const confirmedFinal = await stripe.paymentIntents.confirm(finalIntentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://www.creatorbridge.studio/projects',
  });
  assert(confirmedFinal.status === 'succeeded', `final confirm status ${confirmedFinal.status}`);
  step('final charged (test card)');

  // 9. Webhook marks final paid, then auto-releases transfers to the creator
  const released = await pollTxn(projectId,
    t => t.final_status === 'released' && t.retainer_transfer_id && t.final_transfer_id,
    'final_status=released with both transfers');
  const retainerTransfer = await stripe.transfers.retrieve(released.retainer_transfer_id);
  const finalTransfer = await stripe.transfers.retrieve(released.final_transfer_id);
  assert(retainerTransfer.destination === listing.stripe_account_id, 'retainer transfer went to the wrong account');
  assert(finalTransfer.destination === listing.stripe_account_id, 'final transfer went to the wrong account');
  const totalToCreatorCents = retainerTransfer.amount + finalTransfer.amount;
  const expectedCreatorCents = PROJECT_RATE_DOLLARS * 100 * (1 - expectedFeePct / 100);
  assert(totalToCreatorCents === expectedCreatorCents,
    `creator payout must be ${expectedCreatorCents} cents, got ${totalToCreatorCents}`);
  step('payment released to creator', {
    creatorReceivedCents: totalToCreatorCents,
    platformRevenueCents: released.platform_revenue,
  });

  summary.ok = true;
  console.log('\n' + JSON.stringify({ ...summary, feePct: expectedFeePct, creatorReceivedCents: totalToCreatorCents }, null, 2));
} catch (err) {
  summary.ok = false;
  console.error('\nE2E FAILED:', err.message);
  process.exitCode = 1;
} finally {
  // Cleanup: cancel unconfirmed intents, remove QA rows, restore listing counters
  for (const id of [retainerIntentId, finalIntentId]) {
    if (id) { try { const pi = await stripe.paymentIntents.retrieve(id); if (!['succeeded', 'canceled'].includes(pi.status)) await stripe.paymentIntents.cancel(id); } catch {} }
  }
  if (projectId) await admin.from('transactions').delete().eq('project_id', projectId);
  if (appId) await admin.from('project_applications').delete().eq('id', appId);
  if (projectId) await admin.from('projects').delete().eq('id', projectId);
  if (listingBefore) {
    await admin.from('creator_listings').update({
      completed_projects: listingBefore.completed_projects,
      rating: listingBefore.rating,
      completion_rate: listingBefore.completion_rate,
      next_project_fee_pct: listingBefore.next_project_fee_pct,
    }).eq('id', listingBefore.id);
  }
  console.log('Cleanup complete (QA rows removed, listing counters restored).');
}
