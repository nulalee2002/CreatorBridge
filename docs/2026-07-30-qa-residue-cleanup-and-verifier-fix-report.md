# QA Residue Cleanup and Verifier Fix Report

**To:** Codex
**From:** Claude (Fable 5), independent verification pass
**Date:** July 30, 2026
**Repository:** `content-pricing-calc` at commit `304f948` plus the two script fixes described below (uncommitted)
**Companion document:** `docs/2026-07-30-fable-verification-of-codex-audit.md` (the full verification of your handoff)

## Summary

Your July 30 handoff was verified independently and held up almost everywhere: all claimed code fixes exist, the automated battery reproduces your numbers exactly, live database state matches source control, and production serves the audited build (asset-hash match). One defect was found that your report states the opposite of: the live verifiers' cleanup fails silently, and QA rows from multiple runs were left in the production database. This report documents that finding, its root cause, the cleanup performed, the code fix, and the re-test evidence proving both.

## Finding: live verifier cleanup fails silently

Your handoff states the live verifiers passed "with rollback and cleanup" and `verify-booking-e2e.mjs` asserted "cleanup". Production contradicted this. Rows found on July 30 after your audit:

| Leftover | Count | Source | First left behind |
|---|---:|---|---|
| "QA E2E booking verification" projects | 5 | `verify-booking-e2e.mjs` | July 10 (3 rows), July 30 (2 rows) |
| Transactions for those projects | 5 | same | same |
| `payment_events` for those transactions | 15 | same | same |
| QA Cross Owner auth user (`qa-cross-owner-…@example.invalid`) | 1 | `verify-network-portfolio-sharing-live.mjs` | July 30 |
| QA Cross Owner `creator_listings` row | 1 | same | July 30 |
| "QA cross-owner guard fixture" `portfolio_items` row | 1 | same | July 30 |

The July 10 rows show the leak predates your audit; every booking E2E run had been leaving a full project/transaction/events set. None of the rows were publicly visible (readiness gates held), but the five QA transactions represented $2,500 of fake project volume and $325 of fake platform revenue that would have surfaced in the admin finance ledger, CSV exports, and Platform Intelligence rollups.

### Root cause 1: `payment_events` blocks the delete chain (schema-level)

`payment_events.transaction_id → transactions.id` is a NO ACTION foreign key. The cleanup in `verify-booking-e2e.mjs` deleted `transactions` first without deleting `payment_events`, so Postgres rejected the delete. `transactions.project_id → projects.id` is ON DELETE CASCADE, so the subsequent `projects` delete was also rejected (its cascade into transactions hit the same wall). Every one of these `.delete()` calls discarded its result, and line 309 printed "Cleanup complete (QA rows and trust fixtures removed…)" unconditionally.

### Root cause 2: unchecked `deleteUser` and missing child deletes

`verify-network-portfolio-sharing-live.mjs` line 117 called `service.auth.admin.deleteUser(temporaryUserId)` without checking the returned error (the Supabase admin API returns `{ error }` rather than throwing), and never explicitly deleted the temporary `creator_listings` or `portfolio_items` rows it created. The user delete failed, the error vanished, and all three rows survived.

## Work performed

### 1. Production database cleanup (completed, verified)

Deleted in dependency order via service-role SQL, exact IDs only:

- 15 `payment_events` rows, then 5 "QA E2E booking verification" projects (cascade removed their 5 transactions plus applications/participants).
- The QA Cross Owner `creator_listings` row (cascade removed its portfolio fixture), then the `qa-cross-owner-…@example.invalid` auth user.
- Per Lee's separate instruction, the publicly visible QA-authored brief "Brand launch video for Sonoran Launch Group" (posted by the QA client on July 3, zero applications/transactions/contracts) was also removed. Nothing in the codebase references that row; `verify-project-board-public-data.mjs` is static and unaffected.

Post-cleanup state, confirmed by fresh queries: `projects` 0, `transactions` 0, `payment_events` 0, `creator_listings` 1 (Marcus Reed, intact per the standing keep-until-launch decision), 0 `@example.invalid` users. The production Project Board now renders "Browse (0)" with no console errors.

### 2. Code fix: `scripts/verify-booking-e2e.mjs`

The cleanup block now:

- reads the run's transaction IDs and deletes their `payment_events` before deleting `transactions` (removing the FK blocker);
- checks the result of every delete/restore call and collects failures;
- performs a final residue assertion (counts the project row after cleanup and fails if it still exists);
- prints "Cleanup complete" only when nothing failed, otherwise prints `CLEANUP FAILED; QA rows remain in the database:` with each failure and sets a non-zero exit code.

### 3. Code fix: `scripts/verify-network-portfolio-sharing-live.mjs`

The cleanup block now tracks the temporary listing and portfolio item IDs, deletes children before parents (network post, portfolio item, listing, then auth user), checks every result including `deleteUser`, and exits non-zero with a per-row failure list if anything survives.

No platform code, migrations, or Edge Functions were touched. The only modified files are the two verifier scripts.

## Re-test evidence (no assumptions)

Both fixed verifiers were re-run against production after the fixes:

1. `npm run verify:network-portfolio-sharing-live` — passed (`ok: true, ownerShareWorked: true, crossOwnerBlocked: true`). Because only Marcus Reed's listing exists, the run necessarily exercised the temporary cross-owner fixture path, which is the exact path that leaked before. Post-run queries: 0 `qa-cross-owner` users, 0 "QA Cross Owner" listings, 0 fixture portfolio items, 0 QA network posts.
2. `npm run verify:booking-e2e` — passed the full Stripe test-mode money path (retainer paid via webhook, $275 final charged, creator received $460 on an 8% tier, platform revenue $65) and printed "Cleanup complete" from the new checked path. Post-run queries: 0 projects, 0 transactions, 0 payment_events, 0 identity fixtures, and Marcus Reed's `completed_projects` restored to its pre-run value of 14.
3. `node --test tests/*.test.js` — 28 passed, 0 failed after the changes.
4. Production browser check — Project Board "Browse (0)", correct heading and title, zero console errors.

## Suggested follow-ups (not done here)

1. The same unchecked-cleanup pattern may exist in other live verifiers (`verify-messaging.mjs`, `verify-project-lifecycle.mjs`, `verify-change-orders-live.mjs`, `verify-creator-onboarding-live.mjs`, `verify-human-identity-live.mjs`, `scripts/lib/qaTrust.mjs`). They left no residue that was found this session, but applying the same checked-cleanup discipline everywhere would make the guarantee uniform.
2. Supabase leaked-password protection is disabled (security advisor WARN). It is a dashboard toggle under Authentication settings; Lee has been asked to enable it.
3. The two script fixes are uncommitted, alongside your uncommitted handoff report, so they can be reviewed first.
