# CreatorBridge Launch Dossier (W4)

One page that answers "is it ready and how do we know." Every claim links to a
real artifact in this repo or names the command that proves it. Updated
2026-07-09.

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
npm run verify:launch-sweep          # 13 automated launch checks (all PASS 2026-07-09)
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

1. **Real creators** — the public directory is honestly empty until real US
   creators are recruited and approved. The one QA listing is hidden by the
   readiness gate and gets deleted at launch (after that, verify:booking-e2e
   needs a new QA creator or a real one).
2. **Paid services** — Bunny production (video), Twilio production (SMS), then
   Stripe test->live as the very last step.
3. **Attorney review** of Terms / cancellation / dispute wording.
4. **Chatbot mode decision** — free guide only vs paid AI at launch.
5. **Human-eye checks** that can't be automated: email rendering in a real
   inbox, and a final live browser pass on mobile + desktop.

When 1-3 close, the remaining steps are mechanical: strip the QA account, flip
Stripe live, soft launch.
