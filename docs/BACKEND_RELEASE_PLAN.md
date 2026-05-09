# CreatorBridge Backend Release Plan

This plan is for the backend changes created during the system audit. It is not a command to deploy now.

## Release Order

1. Create a Vercel preview from the current branch and confirm the frontend build.
2. Verify environment names using `docs/ENVIRONMENT_READINESS.md`.
3. Apply the Supabase migration in `supabase/migrations/20260508130000_prelaunch_platform_hardening.sql` to a safe target first.
4. Deploy edge functions after the migration is present, because the payment and webhook functions expect the newer columns and policies.
5. Create one client QA account and one creator QA account.
6. Run the full checklist in `docs/PRELAUNCH_QA.md`.
7. Only after Lee approves the preview and QA flow, push or promote the production deployment.

## Supabase Migration

Migration file:

```bash
supabase/migrations/20260508130000_prelaunch_platform_hardening.sql
```

This migration is intentionally idempotent. It adds or refreshes the database pieces used by the rebuilt platform:

- referral codes and referral reward tracking
- client booking fee waiver flags
- creator one-project fee reduction flag
- creator approval/review fields
- project workflow fields for proposal acceptance, delivery, and approval
- quote-request fields used by Smart Match and dashboards
- client profile and review tables
- payment event, transaction, dispute policy coverage
- RLS policy refreshes for project, quote, referral, transaction, and profile access
- signup trigger hardening with role validation and referral capture

## Edge Functions To Deploy After Migration

Deploy these only after the database migration has been reviewed and applied:

```bash
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook
supabase functions deploy release-payment
supabase functions deploy create-connect-account
supabase functions deploy check-connect-status
```

The most important two are `create-payment-intent` and `stripe-webhook`. They now enforce server-side payment trust, final payment completion, creator tier updates, and referral reward issuance.

## Verification Commands

Run before any deploy:

```bash
npm run qa
```

Run Supabase lint when a local database is available:

```bash
supabase db lint --local
```

The current environment blocked the local Postgres port, so the lint command could not be completed here. That must be done before production promotion.

## Do Not Skip

Do not deploy edge functions before the migration. Do not push straight to production without a Vercel preview. Do not test Stripe with real cards. Use Stripe test card `4242 4242 4242 4242`.
