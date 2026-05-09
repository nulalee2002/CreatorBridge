# CreatorBridge Prelaunch QA

This checklist is for the final verification pass before any production push or live Supabase edge function deployment.

## Hard Rule

Do not push to `main`, deploy edge functions, or apply live schema changes until this checklist has a clean pass in a Vercel preview and the Stripe test flow has been confirmed.

## Local Verification

Run:

```bash
npm run qa
```

This runs the production build and the platform audit checks. The audit is intentionally focused on the fragile areas that have been updated during the system audit: creator approval gates, guest contact protection, Smart Match, checkout fee logic, Stripe payment hardening, webhook completion, referrals, and schema source.

## Test Accounts To Create

Create one client QA account and one creator QA account in Supabase Auth. Do not use real client or creator identities for the first pass.

Client account requirements:

- Role is `client`
- Client profile exists in `client_profiles`
- Can create a quote request
- Can create a project
- Can accept a creator proposal
- Can complete retainer checkout with Stripe test card `4242 4242 4242 4242`
- Can complete final payment after delivery approval

Creator account requirements:

- Role is `creator`
- Creator listing exists in `creator_listings`
- Creator profile passes the approval gate only after required fields are complete
- Creator has at least 3 portfolio samples
- Creator has a 60 to 90 second intro video URL
- Creator has Stripe onboarding completed in test mode
- Creator can submit a proposal, deliver work, and receive final-payment status updates

## Manual Browser Flow

1. Visit the homepage as a guest and confirm the premium layout, background animation, service rail, and chatbot placement.
2. Browse creator cards as a guest and confirm contact details stay locked.
3. Click contact, message, quote, and social/contact actions as a guest and confirm the client signup prompt appears.
4. Sign in as the client and create a quote request.
5. Confirm Smart Match shows approved creators only.
6. Sign in as the creator and submit a proposal to the client project.
7. Sign in as the client and accept the proposal.
8. Complete retainer checkout with Stripe test card `4242 4242 4242 4242`.
9. Sign in as the creator and submit delivery.
10. Sign in as the client and complete final payment.
11. Confirm the project, transaction, creator tier, and referral reward state update correctly.

## Supabase Checks

Before applying schema or edge function changes live, verify these areas in a Supabase preview or a carefully controlled live maintenance pass:

- `profiles.referral_code`
- `profiles.first_booking_fee_waived`
- `profiles.next_booking_fee_waived`
- `client_profiles.first_booking_fee_waived`
- `client_profiles.next_booking_fee_waived`
- `creator_listings.next_project_fee_pct`
- `referrals.completed_project_id`
- `referrals.completed_transaction_id`
- RLS policies on `projects`, `project_applications`, `quote_requests`, `transactions`, `payment_events`, `disputes`, and `referrals`
- Edge functions `create-payment-intent`, `stripe-webhook`, `create-connect-account`, `check-connect-status`, and `release-payment`

## Vercel Preview

Use a preview deployment before production. Confirm the preview uses the intended environment variables and that `STRIPE_ACCOUNT_ID` remains present anywhere Vercel environment variables are touched.

Do not assume `creatormatch.studio` redirects. That redirect is still a separate pending launch task.
