import { buildQaCreatorListingPayload } from './qaFixtures.mjs';

// Provision only the explicitly configured QA account. Incomplete media keeps
// this disposable listing out of the public directory even when approved.
export async function provisionQaListing(admin, user, { stripe = null } = {}) {
  const qaEmail = process.env.CREATORBRIDGE_QA_CREATOR_EMAIL;
  if (!qaEmail || user.email?.toLowerCase() !== qaEmail.toLowerCase()) {
    throw new Error('Listing fixtures require the configured QA creator account');
  }
  const { data: existing, error } = await admin.from('creator_listings')
    .select('*').eq('user_id', user.id).limit(1).maybeSingle();
  if (error) throw error;
  if (existing && (!stripe || existing.stripe_account_id)) return { listing: existing, cleanup: async () => {} };
  let payoutAccount = null;
  if (stripe) {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('QA payouts require Stripe test mode');
    for await (const account of stripe.accounts.list({ limit: 100 })) {
      if (account.email?.toLowerCase() === qaEmail.toLowerCase() && account.capabilities?.transfers === 'active') {
        payoutAccount = account.id;
        break;
      }
    }
    if (!payoutAccount) throw new Error('An active dedicated QA Stripe test payout account is required');
  }
  if (existing) {
    if (existing.name !== 'CreatorBridge QA Creator') throw new Error('Refusing to change a non-QA payout profile');
    const { data: listing, error: updateError } = await admin.from('creator_listings')
      .update({ stripe_account_id: payoutAccount }).eq('id', existing.id).select('*').single();
    if (updateError) throw updateError;
    return { listing, async cleanup() {
      const { error: restoreError } = await admin.from('creator_listings')
        .update({ stripe_account_id: existing.stripe_account_id }).eq('id', existing.id);
      if (restoreError) throw restoreError;
    } };
  }
  const { data: listing, error: insertError } = await admin.from('creator_listings').insert({
    ...buildQaCreatorListingPayload({ userId: user.id, email: qaEmail, now: new Date().toISOString() }),
    business_name: 'CreatorBridge Automated QA',
    stripe_account_id: payoutAccount,
  }).select('*').single();
  if (insertError) throw insertError;
  return {
    listing,
    async cleanup() {
      const { error: deleteError } = await admin.from('creator_listings').delete().eq('id', listing.id).eq('user_id', user.id);
      if (deleteError) throw deleteError;
    },
  };
}
