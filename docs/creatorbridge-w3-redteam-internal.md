# CreatorBridge — W3 Red-Team + Honesty Artifact (INTERNAL ONLY)

**Date:** 2026-07-09. **Not published on the site** (per locked decision).
Adversarial pass over the load-bearing public claims: each attack is stated, ruled
on, and either fixed or accepted as an honest documented limitation. Evidence is
code/DB, not memory.

---

## Attacks, rulings, and fixes

### A1. "Protected payment" — implies escrow / held funds → **RULING: KEEP (accurate)**
- **Attack:** "protected payment" / "50/50 protected payment" could imply legal
  escrow, which we are not licensed to claim.
- **Evidence:** the flow collects the 50% retainer upfront via Stripe and releases
  the balance to the creator after client approval (platform charge → transfer).
  **Zero occurrences of the word "escrow"** anywhere in `src` or
  `supabase/functions` (grep). Matches the approved framing in CLAUDE.md ("keep
  protected payment / funded upfront / released after approval; avoid escrow").
- **Ruling:** wording is accurate and counsel-safe as written. No change.

### A2. "Verified creators" / "government-ID identity verification" → **RULING: FIXED (was an overclaim)**
- **Attack:** copy claimed a "4-step verification process including **Stripe
  identity verification with a government ID**" for every creator, and "all
  creators are verified." A client could read this as background-checked /
  government-ID-verified.
- **Evidence (code):** the real gate is `VerificationFlow.jsx` → identity step =
  `creator.stripe_onboarded === true` ("Verified automatically when you connect
  your Stripe payment account"). i.e. verification = **Stripe Connect KYC** (for
  payouts) + manual admin review + phone SMS gate + 3-item portfolio + intro
  video. **No standalone Stripe Identity / government-ID product is wired**
  (zero `VerificationSession` / `identity.sessions` code). CLAUDE.md confirms
  standalone ID verification is finalist-only and **not built**.
- **Fix applied:** corrected the overclaim to the truth — "Stripe **Connect**
  identity verification (KYC)" — in `SupportChatbot.jsx`,
  `supabase/functions/chatbot/index.ts`, and `CreatorDirectory.jsx`. The Terms /
  Privacy copy already said "Stripe Connect KYC" and was left as-is (accurate).
- **Surviving honest limitation (internal):** "Verified" means manually reviewed +
  Connect-KYC'd + phone-verified + portfolio/intro-checked. It does **not** mean
  background check or universal standalone government-ID verification. If we want
  to claim government-ID verification publicly, wire Stripe Identity first
  (planned for the finalist stage).

### A3. Fee comparison "Often up to 20%" (General Platforms) → **RULING: KEEP**
- **Attack:** unsourced competitor comparison.
- **Evidence:** general freelance/marketplace take rates commonly reach ~20%
  (industry-typical). Framed as "General Platforms," not a named competitor.
- **Ruling:** defensible as an industry-general statement; keep. (If we ever name a
  specific competitor, it must be sourced.)

### A4. Cancellation / dispute terms → **RULING: no new contradiction**
- Reconciled in prior work: free before retainer; after retainer the 50% splits
  25/25 (creator keeps 25% of total, client refunded 25%); no refund after
  delivery; 5-day review window that pauses on approve/revision/dispute. Terms ×3,
  Dispute Policy, Creator Agreement, and both chatbots were aligned. No fresh
  contradiction surfaced in this pass.

### A5. Privacy / anti-poaching → **RULING: holds**
- Client contact info (phone/website) is **not** readable by creators —
  `client_profiles` RLS is owner+admin only; reputation badge selects stats only
  (verified on live DB in prior work). "No off-platform contact sharing" enforced
  in network posts; gear arrangements carry an explicit "not verified/insured"
  disclaimer. No leak found.

### A6. Placeholder creators on public surfaces (W2 carry-over, closed here) → **RULING: FIXED**
- **Evidence:** `SHOW_DEMO_CREATORS` was `true`, merging **22 demo creators** into
  the public directory (`setListings([...liveListings, ...loadDemoListings()])`),
  and the matching engine hardcoded `allowDemoSeed: true`. Live DB has **1**
  approved listing (QA "Marcus Reed / Copper Line Media") with **null pillar, 0
  portfolio, 0 packages** → already fails the public readiness gate → hidden.
- **Fix applied:** `SHOW_DEMO_CREATORS = false`; matching now uses the flag.
  Verified by live render: `/find` shows "0 creators · 0 verified in network",
  honest empty state, no seed names, no QA account.

---

## Surviving honest limitations (the internal launch-truth list)
1. **"Verified" scope** — review + Connect KYC + phone + portfolio/intro, **not**
   background checks or universal government-ID verification (finalist-stage,
   unbuilt).
2. **Empty real directory** — no real US creators are approved+complete yet; the
   directory is honestly empty until Phoenix-launch recruiting fills it.
3. **Paid-service readiness** — Bunny production, Twilio production sending, and
   Stripe live are still pending (tracked in the DoD scorecard); until then the
   end-to-end booking path can't be exercised for real.

## Deploy note
`supabase/functions/chatbot/index.ts` was edited (A2). Edge-function deploys are
the supervised category — this needs a `supabase functions deploy chatbot` before
the corrected chatbot copy is live. Frontend changes deploy via the git push.
