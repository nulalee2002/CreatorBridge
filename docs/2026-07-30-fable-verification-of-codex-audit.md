# Independent Verification of the Codex Full Platform Audit

**Verification date:** July 30, 2026
**Verifier:** Claude (Fable 5), independent pass, no code changes made
**Repository state verified:** commit `304f948` on `main`, matching the audited production commit
**Scope:** static code verification, local automated battery, live Supabase read-only inspection, production browser testing at desktop and iPhone-size mobile viewports

## 1. Verdict

Codex's handoff report is substantially accurate and honest. Every code fix I checked exists in the actual files, every automated check it claimed passed also passed on my re-run, the live database matches source control, and production is serving exactly the audited build. The report's stated limitations (no automatic biometric duplicate detection, real-provider tests still pending) are truthful.

I found **one real defect Codex's report gets wrong** (its live verifier cleanup silently fails and left QA rows in the production database), **one launch-hygiene item it did not flag** (a QA-authored brief is publicly visible on the Project Board), and **one production setting it missed** (Supabase leaked-password protection is disabled). None of these are launch blockers on their own, but the leftover QA transactions will pollute the finance ledger if not removed.

## 2. Confirmed claims (verified this session, with evidence)

### Repository and deployment state
- HEAD is `304f948 fix: close full-platform audit gaps`; only uncommitted changes are the user-owned video-calls decisions file and the handoff report itself (1,276 lines, as claimed).
- Production serves this exact build: asset hashes served by creatorbridge.studio (`supabase-vendor-CxVtLkKZ.js`, `supabase-BYZB-p-5.js`) are identical to a local `dist` build of this commit.

### Automated battery (re-run locally, all matching Codex's table)
| Check | My result | Codex claim |
|---|---|---|
| `node --test tests/*.test.js` | 28 passed, 0 failed | 28 / 0 |
| `npm run audit:platform` | 265 checks passed | 265 |
| `npm run verify:launch-sweep` | 19/19 sections PASS (includes production build) | 19 |
| `npm audit --offline --audit-level=moderate` | 0 vulnerabilities | 0 |
| `npm run audit:env` | Passed, with the same two warnings Codex disclosed (service secrets in root `.env`, missing local Turnstile site key) | Same |
| `attorney_review_required` scan of src/functions/scripts/tests | No active-code matches | Same |

### Code fixes (read in the actual files)
- All 8 new migrations exist (`20260728180938` through `20260730010000`) and every one is applied to the live CreatorBridge database (`mxizhszqhbhxzkkhgnmg`). Local migration files and applied migrations both count 71.
- `create-payment-intent` requires `contracts.status = 'countersigned'` before any retainer (index.ts lines 234-248).
- `CheckoutPage.jsx` imports the UUID guard (line 17), rejects malformed IDs before any query (line 454), and blocks checkout without an accepted creator (lines 233-235).
- `get_project_change_orders` / `get_project_documents` rebuilt with `auth.uid()` party/admin authorization and text-cast joins; revoked from public/anon, granted to authenticated.
- The transactional `submit_creator_application` RPC exists with 12 revoke statements in the hardening migration.
- Dependency upgrades landed: react 19.2.7, react-dom 19.2.7, react-router 8.3.0, lucide-react 1.27.0.
- Accessibility fixes present: auth honeypot has `aria-hidden` + `tabIndex={-1}`; Messages icon button has `aria-label="Open conversation"`; CreatorDirectory has the `embedded` mode; calculator selects have accessible names (verified rendered in production).

### Live Supabase state (read-only inspection)
- All nine `admin_*` / `get_admin_*` RPCs internally check `is_platform_admin` in their live function source.
- Every deployed function with `verify_jwt = false` has a real internal gate: Stripe/Zoom/Identity webhooks use signature verification; `test-topup` refuses non-`sk_test` Stripe keys AND requires a job secret (it goes inert when live keys are swapped in); Bunny functions manually validate the caller's JWT; cleanup/sync jobs use constant-time token comparison against a stored token.
- The Zoom diagnostic functions and `openai-diagnostic` that the handoff says to review before launch are **not deployed** to production at all (repo-only). Better than the report implies.
- Scheduled jobs are live and active: cleanup-call-recordings (daily 4:20), cleanup-support-screenshots (daily 4:00), sync-call-recordings (every 5 min), video-call-reminders (every 10 min).
- Supabase security advisors: zero ERROR-level findings. The 56 SECURITY DEFINER warnings are the platform's intentional RPC architecture (spot-checked self-authorization). Seven tables with RLS-enabled-no-policy are deny-all service-role-only tables, which is safe.

### Production browser testing (desktop 1280px and mobile 375x812)
- Routes tested: `/`, `/find`, `/projects`, `/calculator`, `/checkout/not-a-valid-id`, `/dashboard/build-team`, `/reset-password`, 404 route.
- Every tested route: correct document title, exactly one `h1`, no broken images, no horizontal overflow at either viewport, **zero console errors across the entire session**.
- `/checkout/not-a-valid-id` fires **no Supabase API request** (only static assets) — the malformed-ID guard works in production. Unauthenticated it shows the sign-in gate as its single h1; Codex's "Project not found" heading applies to the authenticated view, which I could not reproduce (see section 5).
- Calculator interaction reproduced Codex's exact numbers: Photography baseline **$4,865**, switching to Video Production + Brand Films recalculates to **$4,851**.
- Reset-password shows the invalid/expired-link state with return-to-login action, as claimed.
- No em or en dashes anywhere in the rendered copy of the tested public pages (Lee's hard rule holds).
- Public creator directory shows 0 creators in all pillars: the QA listings are correctly hidden by the readiness gate.
- The coarse-pointer 44px touch-target rule is present in the shipped CSS; desktop viewport emulation cannot trigger `pointer: coarse`, so the 44px behavior needs one real-phone spot check (consistent with Codex's remaining-human-work list).
- Bundle chunk claim confirmed: largest chunk 788 kB locally (Codex said ~807 kB; same finding), plus jspdf 390 kB and html2canvas 195 kB as lazy-load candidates.

## 3. Discrepancies found (evidence contradicts the report)

### 3.1 Live verifier cleanup silently fails; QA rows remain in production (moderate)
Codex's table says the live verifiers passed "with rollback and cleanup" and booking E2E asserted "cleanup". The production database contradicts this:

- `auth.users`: `qa-cross-owner-3fa68653-…@example.invalid` (created 2026-07-30) still exists.
- `creator_listings`: "QA Cross Owner" listing still exists (approved/verified, though hidden from public because `approval_ready = false`).
- `portfolio_items`: "QA cross-owner guard fixture" row still exists.
- `projects`: **two** "QA E2E booking verification" projects (status `final_paid`) still exist.
- `transactions`: two full QA transaction rows ($500 project, $250 retainer, released final, Stripe test-mode payment intents) still exist.

Root cause, from reading the scripts: `verify-network-portfolio-sharing-live.mjs` line 117 calls `auth.admin.deleteUser()` without checking the returned error (the Supabase admin API returns errors rather than throwing), and never explicitly deletes the listing/portfolio rows. `verify-booking-e2e.mjs` lines 282-285 issue deletes whose results are also unchecked, then line 309 prints "Cleanup complete" unconditionally. Both cleanups failed silently on Codex's runs.

Impact: no public exposure (all rows hidden from public surfaces), but the two QA transactions will appear in the admin finance ledger, CSV exports, and analytics as $1,000 of project volume and $130 of platform revenue. The pattern also means every future verifier run may accrete more orphaned rows.

Ironically, the leftover rows are also direct evidence the Stripe test-mode payment path genuinely worked end to end, twice.

### 3.2 A QA-authored brief is publicly visible on the Project Board (launch hygiene)
The Project Board shows "Browse (1)": "Brand launch video for Sonoran Launch Group" ($2,000-$3,500, Phoenix, posted Jul 3). Database confirms it was posted by the QA client account (`drl33+client@creatorbridge.studio`). It is a fictional company visible to every visitor. The report's "no demo rows" claim refers to hardcoded demo data, which is true, but this live QA-authored brief was not flagged. Decide before launch: delete it along with the Marcus Reed listing, or keep it deliberately as a seeded example.

### 3.3 Minor wording nuance: "revoked anonymous execution" is not universal
The hardening migration does revoke public/anon on the sensitive helpers, but the later identity-gates migration deliberately re-grants `creator_listing_meets_approval_requirements` to `anon` (it backs public directory readiness filtering). Live ACLs match source control exactly, so there is no drift and no leak; the function returns only a readiness boolean. This is a nuance to the report's summary sentence, not a defect.

## 4. New findings Codex did not report

1. **Supabase leaked-password protection is disabled** (security advisor WARN). Enabling it makes Supabase Auth reject passwords found in the HaveIBeenPwned breach corpus. One dashboard toggle: Auth settings → Passwords. Recommended before public signup opens.
2. **Extensions in the public schema** (`pg_trgm`, `unaccent`, `pg_net`) — advisor WARN, low priority, standard practice is moving them to a dedicated schema at some future maintenance window.
3. **An applied migration is named `20260611090000_harden_function_grants_DRAFT_REVIEW_BEFORE_APPLY`** — it is live in production despite the name saying draft. The later `20260623000000_harden_function_grants_apply_ready` also ran. Nothing appears broken (grants verified above), but the naming will confuse future engineers; annotate it in docs.

## 5. What I could not verify (needs Lee or a real device/provider)

- Authenticated visual walkthroughs (client/creator/admin dashboards) at desktop and mobile: I cannot enter account passwords. Coverage for those areas comes from code review, live database checks, and the launch-sweep verifiers instead. Codex's authenticated-route browser claims stand unverified by me, including the authenticated "Project not found" checkout heading and the Build Your Team single-heading fix in its logged-in form.
- All real-provider acceptance tests (Stripe live mode, Twilio real phones, Stripe Identity real document/selfie, two-person Zoom call, OpenAI credits, Resend deliverability, Bunny playback, Google Calendar OAuth) — exactly the Priority 0/1 human work the handoff already lists. Nothing I saw contradicts its descriptions of what remains.
- The 44px coarse-pointer touch targets on a physical phone.
- Vercel deployment ID `dpl_DKEt9DtbM1CpaRnojexbgSC2BW7o` specifically — I verified production serves the audited build by asset-hash match instead, which is stronger evidence than a deployment ID.

## 6. Recommended actions (in order)

1. Delete the leftover QA rows: the two "QA E2E booking verification" projects and their transactions, the "QA Cross Owner" auth user, creator listing, and portfolio fixture. (Small, surgical; keep Marcus Reed until launch per standing decision.)
2. Fix the verifier cleanup pattern: check every `.delete()` / `deleteUser()` result and fail loudly, so "Cleanup complete" means what it says. Until then, treat every live-verifier run as leaving residue to sweep.
3. Enable leaked-password protection in Supabase Auth.
4. Decide the fate of the public "Sonoran Launch Group" QA brief before launch.
5. Proceed with the handoff's Priority 0 provider tests; nothing I found changes that plan.
