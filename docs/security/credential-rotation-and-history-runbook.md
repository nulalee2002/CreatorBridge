# CreatorBridge credential rotation and Git-history recovery

This runbook addresses the historical `.env.txt` exposure without placing any credential value in source, terminal logs, tickets, or screenshots. The current source and frontend bundle are clean; the remaining known exposure is the deleted file retained in the public repository history. History rewriting is intentionally outside the automatic launch build because it changes shared commit identities and requires a coordinated force-push and mandatory re-clone.

## Safety boundary

Do not begin the history rewrite until the repository owner explicitly approves the force-push window. Credential rotation can and should happen first. Keep the repository private during the incident if operationally acceptable, restrict write access, notify every collaborator that existing clones must not be pushed after the rewrite, and record the current default branch, protected-branch rules, open pull requests, tags, and deployment commit.

Never paste a secret into this document, a Git command, chat, issue, commit, screenshot, or CI log. Use the Stripe, Supabase, and Vercel dashboards or their masked secret-entry mechanisms. A Supabase anon/publishable key is designed for browser use, but the historically committed legacy anon key should still be reviewed and rotated so the exposed snapshot no longer represents current configuration. A Supabase service-role key must be rotated immediately if dashboard review shows it was ever present anywhere public.

## Phase 1: inventory and containment

1. Make the GitHub repository private or otherwise restrict public access while recovery is coordinated. Record this as containment, not as a substitute for rotation or history removal.
2. In Stripe test mode, identify the exposed secret API key and webhook signing secret from their creation dates and endpoint history. Do not retrieve them from Git to compare values.
3. In Supabase, review legacy and current publishable/anon keys, secret/service-role keys, database credentials, and recent auth/API logs. The known report identified a legacy anon key; confirm whether any service-role or database secret was ever exposed.
4. In Vercel and Supabase Edge Function settings, inventory only secret names and last-updated timestamps. Required project-completion secrets now include `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_IDENTITY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_JOB_SECRET`, and `RATE_LIMIT_HASH_SECRET`.
5. Run `npm run build` followed by `npm run audit:env`. The audit reports affected file paths and signature categories only; it never prints the matching value.

## Phase 2: rotate providers before revocation

Create replacements first, update consumers, verify them, and only then revoke the exposed values. This avoids turning credential recovery into an uncontrolled outage.

For Stripe test mode, create a restricted replacement secret where supported, update the Supabase `STRIPE_SECRET_KEY`, create or roll the test webhook endpoint signing secret, and update `STRIPE_WEBHOOK_SECRET`. Confirm that the endpoint targets the deployed `stripe-webhook` function and that Stripe signature verification remains the endpoint's authentication mechanism. Re-run a test retainer, formal delivery, final-payment attempt, signed webhook, idempotent replay, and creator payout. After those succeed, revoke the old test secret and roll the old webhook secret. Repeat the process separately during the controlled live-mode launch; test and live credentials must never be mixed.

For Supabase, rotate any exposed legacy anon/publishable key according to the dashboard's current key-management workflow and update `VITE_SUPABASE_ANON_KEY` in Vercel. If a secret/service-role key is implicated, rotate it, update every Edge Function/CI consumer, redeploy, verify Auth, RLS, Storage signed URLs, cron jobs, and webhooks, then revoke the old key. Review database credentials separately. Never put replacement values in `.env.example`; it contains names and safe public defaults only.

Generate fresh, independent random values of at least 32 bytes for `PLATFORM_JOB_SECRET` and `RATE_LIMIT_HASH_SECRET`, store them only in Supabase secret management, redeploy the affected completion and rate-limited functions, and verify unauthorized calls fail. Update the established support mailbox through `SUPPORT_EMAIL` and `VITE_SUPPORT_EMAIL` only if the mailbox changes.

In Vercel, update `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, and any other public configuration through project environment settings. Redeploy from a clean commit. Confirm that preview and production environments do not accidentally share live Stripe secrets.

## Phase 3: provider verification gate

Before revoking old credentials, require all of the following: Supabase Auth returns JSON successfully; remote migration history matches the repository; security and performance advisors have been reviewed; the production bundle passes `npm run audit:env`; `npm run verify:launch-sweep` passes against dedicated QA accounts; Stripe records the intended amount and metadata; the signed webhook is received once and duplicate delivery is harmless; final status is not marked paid before webhook confirmation; private delivery downloads reject a non-party; scheduled review and retention jobs authenticate with the new job secret; email delivery records provider message IDs without logging recipients.

If any provider is degraded, stop at the last reversible step. Do not revoke the only working key and do not label the launch verified.

## Phase 4: prepare the coordinated history rewrite

This phase requires separate explicit owner approval. Schedule a maintenance window and freeze pushes. Ensure every contributor has pushed or exported needed work. Create protected backup references in a private administrative clone and record their commit IDs outside the repository. Mirror-clone the repository into a newly created temporary directory, never over a working checkout.

Install and verify `git-filter-repo` from its official distribution. In the isolated mirror, remove the historical path from all refs:

```sh
git filter-repo --path .env.txt --invert-paths --force
```

Search rewritten objects for the retired path and secret signatures without printing secret contents. Confirm branches and tags still point to the expected rewritten trees, compare release contents, run the full verification matrix, and have a second operator review the rewritten ref map. Backup refs must remain private because they still contain the exposed blob.

## Phase 5: force-push and invalidate old clones

Only after explicit approval, temporarily adjust branch protection as narrowly as possible and force-push all rewritten branches and tags from the isolated mirror. Restore branch protection immediately. Delete public forks or cached artifacts where account authority permits, rotate GitHub Actions secrets if review finds exposure, and request cache removal from hosting providers when applicable. History removal reduces discoverability but does not make a previously public secret trustworthy; rotation remains mandatory.

Every collaborator and deployment machine must delete or archive its old clone without pushing from it, then make a fresh clone. Do not merge, rebase, or force-push an old branch into the rewritten repository because that can reintroduce the removed objects. Open pull requests based on old commits must be recreated from clean patches. Verify GitHub's default branch, tags, releases, Actions, Vercel integration, and Supabase deployment automation after re-cloning.

## Completion record

Record dates and operators for each rotation, the names—not values—of retired and replacement credentials, Stripe webhook endpoint IDs, Supabase/Vercel environment scopes updated, verification commands and results, rewritten old-to-new commit map location, force-push approval, re-clone acknowledgements, and any provider/cache request IDs. Recovery is complete only when old credentials are revoked, the clean bundle is deployed, shared history is rewritten or the residual public-history risk is formally accepted, and no old clone can reintroduce the secret-bearing objects.
