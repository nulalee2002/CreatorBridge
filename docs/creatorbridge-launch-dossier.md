# CreatorBridge Launch Dossier (W4)

One page that answers "is it ready and how do we know." Every claim links to a
real artifact in this repo or names the command that proves it. Updated
2026-08-23.

---

## The verification artifacts

| Artifact | What it proves |
|---|---|
| [Launch DoD scorecard](creatorbridge-launch-dod-scorecard.md) | The graded launch checklist: every item marked verified / claimed / blocked / pending, with evidence rules |
| [W2 claims & placeholder audit](creatorbridge-w2-claims-audit.md) | Every fabricated claim found on public surfaces (fake brands, fake activity, fake stats) and its verified removal |
| [W3 red-team, internal](creatorbridge-w3-redteam-internal.md) | Load-bearing claims attacked and ruled on: protected payment (kept, accurate), verified-creators (overclaim fixed to Stripe Connect KYC), fees, cancellation, privacy |
| [Brand guidelines](creatorbridge-brand-guidelines.md) | Stranger-complete brand guide from the real code tokens (palette, type, logo, voice, no-dash rule, hard constraints) |
| [Launch-hardening roadmap](creatorbridge-launch-hardening-roadmap.md) | The operating prompt this work ran under (W1-W6) |
| [Client UX walkthrough findings](2026-07-03-client-walkthrough-ux-findings.md) | The live browser walkthrough that drove the UX fixes |

## The check battery (run these to re-prove it)

```
cd "/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc"
npm run verify:launch-sweep          # 32 automated launch checks (all PASS 2026-08-23)
npm run verify:collaboration-fee-parity   # frontend/backend fee math identical
npm run verify:booking-e2e           # full money path in Stripe TEST mode
```

## What the money-path E2E proves (verify:booking-e2e)

Ran green 2026-07-09 against the deployed functions and live test-mode Stripe:
accepted project -> retainer intent $250 (no client fee) -> test-card charge ->
webhook settles -> delivery -> final intent $275 ($250 + one-time 5% fee) ->
charge -> webhook settles -> auto-release transfers $460 to the creator's
connected account (8% tier), platform revenue $65. Cleans up after itself and
refuses to run on a live Stripe key.

**It also caught a launch-blocking regression on its first run:** the deployed
`stripe-webhook` had `verify_jwt=true`, so Supabase 401'd every Stripe delivery
and no payment could ever settle (evidence: 401s in the edge-function logs at
the exact charge timestamps). Fixed by pinning `verify_jwt=false` in
`supabase/config.toml` and redeploying; the E2E then passed end to end. Lesson:
any redeploy of stripe-webhook must keep the config.toml section.

## Fee model (locked)

Creator platform fee **10% / 8% / 6%, floor 6%** (Launch 0-9, Proven 10-24,
Signature 25-49, Elite 50+ at 6%). Client booking fee **5% once, on the final
payment**. Cancellation: free before retainer; after retainer the 50% splits
25/25; no refund after delivery; 5-day review window that pauses on
approve/revision/dispute. Verified in code, in the deployed functions (read
back from production), and end-to-end by the E2E above.

## What is still open (the honest list)

1. **Real creators** — the live database has zero creator listings after the
   Marcus Reed / Copper Line Media QA listing was deleted on 2026-08-23. The
   public directory must remain honestly empty until real US creators are
   recruited, reviewed, and approved.
2. **Attorney review** — an entertainment attorney still needs to approve the
   final Terms, cancellation, dispute, recording-consent, and electronic-
   signature wording. Automated tests cannot close this gate.
3. **Stripe live swap** — production was verified on 2026-08-23 to still use a
   test publishable key and test backend secret. Install the live publishable,
   secret, payment-webhook, and identity-webhook credentials, verify Connect and
   redirect URLs, then reconcile one small controlled live payment and payout.
4. **Zoom Event Subscription (verified 2026-08-23)** — the correct
   `CreatorBridge Video` Build Platform app has Event Subscription enabled. Its
   notification URL is validated and points to
   `https://mxizhszqhbhxzkkhgnmg.supabase.co/functions/v1/zoom-webhook`. The
   selected events include all three required by CreatorBridge:
   `session.ended`, `session.recording_completed`, and
   `session.recording_transcript_completed`. Zoom's recording-summary event is
   also selected and is safely ignored by the webhook. The deployed endpoint
   rejects unsigned requests, and the five-minute recovery job authenticates
   successfully to the Video SDK API.
5. **Paid-service acceptance** — confirm every enabled launch provider with a
   real acceptance test, including Bunny production media, transactional email,
   and any SMS gate retained for launch.
6. **Human-eye checks** — verify transactional email rendering in a real inbox
   and complete a final live browser pass on mobile and desktop.

The Marcus QA listing cleanup is complete. The Zoom Event Subscription
confirmation is also complete. Do not describe CreatorBridge as operationally
launched until real creators, attorney sign-off, and the Stripe live swap with
a reconciled live transaction are complete.
