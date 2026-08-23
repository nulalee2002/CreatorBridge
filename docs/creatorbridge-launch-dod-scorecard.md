# CreatorBridge — Launch Definition-of-Done Scorecard (W1)

The gradable launch checklist. Every workstream reports its evidence into this
file. Nothing is "done" without an observation, not an intention.

**Status legend**
- ✅ **Verified this session** — I ran/observed the check myself (live browser, DB
  query, build, or code trace) in this working session.
- ⚠️ **Claimed, unverified** — reported done (mostly in the Codex work record) but
  I have **not** independently re-checked it. W2/W3 must verify before ✅.
- ⛔ **Blocked** — waiting on a paid service or external step.
- ⬜ **Not started / pending** — owned by an active workstream.

Rule: an item moves to ✅ only when the "evidence" column is a real captured
artifact (screenshot, query result, passing command output, or reviewed code).

---

## A. Paid-service readiness (launch blockers)
- ⛔ **Bunny production** — paid account, storage/library configured, keys in
  Supabase/Vercel, intro-video + portfolio-video upload + playback + failure
  messaging all work. *Evidence needed: live upload/playback screenshots.*
- ⛔ **Twilio production** — trial lifted, real SMS sends to a non-verified number,
  phone gate still blocks unverified clients. *Evidence: live send + gated post.*
- ⛔ **Stripe live** — stays in **test mode** until every payment path passes; then
  live keys/webhook/Connect/redirects + one tiny controlled live txn. *Verified
  2026-08-23:* the production frontend contains a test publishable key and the
  protected backend test-only endpoint confirms the server secret is also test
  mode.
- ⬜ **Zoom Event Subscription** — `zoom-webhook` is ACTIVE with JWT verification
  intentionally disabled in favor of Zoom signature verification; its signing
  secret is configured, and the scheduled Video SDK REST recovery job returns
  200. Directly confirm the Marketplace toggle, callback URL, and the
  `session.ended`, `session.recording_completed`, and
  `session.recording_transcript_completed` selections. No real call or webhook
  delivery exists yet to prove the subscription end to end.
- ⬜ **Chatbot mode decision** — launch free/local guide only, or enable paid AI
  help (login + quota + token caps). Decision + cost control pending.
- ⬜ **Resend/email** — review bounce logs, remove bad recipients, confirm no
  transactional mail hits fallback addresses.

## B. Payment / fee correctness
- ✅ **Client 5% booking fee once on completion** — code changed + checkout math
  verified ($1,000 → $500 booking / $550 completion). Deployed.
- ✅ **Creator loyalty ladder 10/8/6** — EarningsTab shows the real tier (live: 8%
  for the 14-project QA creator) + full ladder display. `verify:collaboration-fee-parity` passes.
- ✅ **Cancellation model (retainer splits 25/25)** — reconciled across fees.js,
  Dispute Policy, Terms ×3, both chatbots; Dispute Policy page verified live.
- ⚠️ **Collaboration payment behavior** (ACH-only, buyer fee waived, processing
  cost on prime) — Codex-claimed via automated checks; not re-verified by me.

## C. Public data & profiles
- ⬜ **Real creators** — recruit, review, and approve genuine US creators before
  launch. The truthful live creator-listing count is currently zero.
- ✅ **No incomplete/dummy creator rows on public surfaces** — *live database
  verified 2026-08-23:* the exact Marcus Reed / Copper Line Media QA listing was
  removed after confirming it had no contracts, payments, projects,
  applications, reviews, or collaborations. The remaining creator-listing count
  is zero. Recruiting and approving real US creators remains an operational
  launch gate; do not repopulate the directory with fabricated talent.
- ⚠️ **Creator media required (real photo + intro video, separate from portfolio)**
  — Codex-claimed; verify the gate actually blocks submission.
- ⚠️ **Portfolio requirements by pillar (3 matching samples)** — Codex-claimed; verify logic.
- ⚠️ **Public Profile Readiness strip + repair-listing path** — Codex-claimed; verify live.
- ⚠️ **30-day media-change limit (replaced 90-day lock)** — Codex-claimed; verify.

## D. Core-flow QA (live browser)
- ✅ **Creator dashboard fee ladder + Earnings + terms gate** — verified live as the
  creator; terms acceptance rows confirmed in DB.
- ⚠️ **Creator dashboard top-cutoff / avatar initials / functional hero boxes** —
  code changed + build passes, but **not re-screenshotted live after the change**;
  verify in browser.
- ⚠️ **Build Your Team (discovery, name/role search, adaptive filters, payout copy)**
  — Codex-claimed browser test; re-verify.
- ✅ **Client money path (accepted → retainer → delivery → final → release)** —
  verified end-to-end 2026-07-09 by `npm run verify:booking-e2e` against the
  deployed functions + live test-mode Stripe: amounts, fee math (8% tier, 5%
  client fee once), webhook settlement, and transfers to the creator's connected
  account all asserted. **Found + fixed a launch blocker:** the deployed
  stripe-webhook had verify_jwt=true, 401-ing every Stripe delivery so no
  payment could ever settle; pinned false in supabase/config.toml + redeployed.
- ⬜ **Full client path in the browser UI** — guest browse → signup → phone
  verify → brief/quote → match → accept → checkout UI → dispute entry (the
  rendered click-through around the now-verified money path).
- ⬜ **Full creator path** — registration → required media → portfolio by pillar →
  packages → Connect → readiness → proposal → delivery → earnings → public preview.
- ⬜ **Full admin path** — review approve/reject → incomplete quarantine → support
  tickets → operations search → finance CSV → analytics → lookups.

## E. Content truth, policy & brand
- ✅ **Fee/cancellation/5-day-window wording reconciled** — Terms ×3, Dispute
  Policy, Creator Agreement, both chatbots, emails; policy versions bumped, users
  re-accept. Dispute Policy bold rendering fixed.
- ⬜ **Attorney review** — an entertainment attorney must approve the final
  Terms, cancellation, dispute, recording-consent, and electronic-signature
  wording. Code review and automated verification cannot close this gate.
- ⬜ **Every public claim sourced or cut** — W2 audit of marketing/trust copy.
- ⬜ **Legal/payment wording review** — keep "protected payment / funded upfront /
  released after approval"; avoid "escrow" without counsel.
- ⬜ **Stranger-complete brand guidelines** — W6.

## F. Security / privacy
- ✅ **Client contact info not readable by creators** — `client_profiles` RLS is
  owner+admin only; reputation badge selects stats only (no phone/website).
- ✅ **No outside social on creator profiles** — website/instagram/youtube/vimeo/
  linkedin columns dropped; walled-garden trigger recreated; verified on live DB.
- ✅ **Edge-function security fixes deployed** — retain-platform-intelligence
  fail-open closed; send-notification-email escapes user input.
- ⚠️ **Admin/support RLS, non-admin blocking, platform search/finance/analytics
  reachability** — Codex-claimed; re-verify in W3.

## G. Deployment discipline (do last)
- ✅ **`npm run verify:launch-sweep` passes** — re-run 2026-08-23; all 32
  checks PASS (build, notifications, email provider, chatbot guide, profile media,
  public readiness, network portfolio sharing, platform language, creator
  collaboration launch, support reporting, client phone gate, release-payment
  security, admin/support/search). Note: this is code/automated-level evidence,
  not live-browser or paid-service proof.
- ⬜ **Vercel preview verified** with QA accounts; env vars confirmed; Supabase
  functions/secrets current; no pending migrations; final launch sweep; then
  production promotion.

---

## Current tally (honest)
- **✅ Verified by me this session:** the fee model, cancellation + 5-day window,
  terms gate, migrations, logo, security/RLS items, and the policy-wording
  reconciliation.
- **⚠️ Claimed but unverified (needs my check):** the launch sweep, Build Your
  Team, creator media/portfolio/readiness rules, collaboration payment checks,
  admin/support checks — the bulk of the Codex work record.
- **⛔/⬜ Pending:** real creator recruitment, attorney review, Stripe live,
  Zoom Event Subscription confirmation, other paid-service readiness, full live
  browser QA, brand guide, and deployment discipline.

**Launch is not "done" until every row here is ✅ or a consciously accepted,
documented deferral. Real creator onboarding, attorney sign-off, Zoom Event
Subscription confirmation, and the Stripe live swap are mandatory operational
gates and must appear in every launch summary.**

---

## W2 verification log

**2026-08-23 — launch sweep re-run (independent check of Codex's claims).**
All 32 automated checks PASS. This upgrades the following from "Codex-claimed" to
"code-verified by me" at the automated level: profile media enforcement, public
readiness gate, network portfolio sharing, platform language (no marketplace
wording), collaboration launch/payment checks, support reporting, client phone-gate
code, release-payment security, admin/support/search RLS + reachability.

**Still NOT covered by the sweep (remain open, cannot be automated):**
- Live-browser QA of every flow (client, creator, admin, Build Your Team) — the
  sweep proves the code, not the rendered click-through.
- Paid-service readiness (Bunny, Twilio production sending, Stripe live).
- Real creator recruitment and provider-dashboard acceptance work.
- Email bounce-log cleanup.

**Read:** Codex's *automated* verification claims are trustworthy. The real
remaining launch risk is the human/live and paid-service layer, plus data
cleanup — exactly what W2's data audit and the live QA passes must close.
