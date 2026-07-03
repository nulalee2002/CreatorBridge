# CreatorBridge — Client-side UX walkthrough findings (2026-07-03)

Browser-driven walkthrough of the **client** spine, logged in as the QA client
(`drl33+client@creatorbridge.studio`) against local dev + live Supabase (Stripe
test mode). Goal: find bugs and points of confusion, and fix what's safe.

Path walked: landing → sign in → terms gate → post a brief → Smart Match →
creator profile → request a quote → reserve/escrow → reservation confirmation.

---

## Fixed and verified this session

1. **Booking-panel escrow split was wrong (payment).** The "Reserve your shoot"
   panel split the 5% client fee into the retainer (showed $1,024 / $1,024 on a
   $1,950 package). Corrected so the retainer is 50% of the base only and the
   one-time 5% lands on the final: **$975 held now / $1,073 on delivery**.
   Verified live.
2. **Stale "Gold Creator" badge.** `LoyaltyBadge` rendered old tier names
   (Gold/Silver) after the tier rename, so an "Elite" creator showed a "Gold
   Creator" badge. Now derives from the actual tier name.
3. **Cut-off logo** at the top of the sign-in modal — replaced the cropped wide
   lockup with the true square brand mark.
4. **Fee/cancellation wording reconciled** to one model everywhere (Terms ×3,
   Dispute Policy, Creator Agreement, both chatbots, `fees.js`, CheckoutPage,
   FeeBreakdown): client 5% once on completion; creator 10/8/6 at 0/10/25
   completed projects; cancellation = free before retainer, retainer splits
   25/25 of total before delivery, no refund after delivery.
5. **Terms gate had no reading enforcement.** Reworked: brand-new members must
   tick "I have read and agree" before Accept enables; existing members get a
   lighter monthly / policy-update re-confirmation; acceptance is per-document at
   the current version; role-scoped (clients: ToS + Dispute Policy; creators:
   + Creator Agreement).
6. **Signature tier fee corrected** from a doc-only 5% to 6% (matches the code).
7. **Bridge chatbot mis-routed "cancel after paying retainer."** The offline
   guide matched the payment intent before the cancellation intent, so the
   question got the generic payment-structure blurb. Reordered so cancellation is
   checked first, and rewrote the cancellation + fee answers to the locked model.
   Verified live in the Bridge widget.
8. **FeeBreakdown showed a "+$0.00 Booking fee" row** on the retainer section
   (the fee is now zero there under the once-on-completion model). Removed the
   dead row; retainer line now reads "no fees added."
9. **Policy pages verified live** — Terms of Service and Dispute Policy both
   render the reconciled 25/25 cancellation wording and "no fees on cancelled
   projects," no console errors.

## Friction found — recommended, not yet changed

A. **[MEDIUM · DECISION] Dispute window contradicts itself.** The Dispute Policy
   (section 4) says a formal dispute must be filed "within **14 days** of the last
   delivery upload," but the chatbot/payment rules say clients have **72 hours**
   after delivery to dispute and funds auto-release at 72 hours. These can't both
   be true — if funds release at hour 72, there's nothing to dispute on day 14.
   Pick one window (72h or 14 days) and I'll reconcile the Dispute Policy, chatbot,
   `PLATFORM_FEES.autoApproveDays`, and the delivery-review copy to match.

7. **[MEDIUM] Logged-out "Post a brief" is a dead-end.** The homepage's primary
   client CTA routes a logged-out visitor to the Project Board (a list of other
   people's briefs) with only "Browse creators" and no way to post or sign in to
   post. Fix: route logged-out clicks to sign-in/sign-up, then into the brief
   form. (Once logged in, the create action appears correctly.)
8. **[MEDIUM] Brief field blocks ordinary platform names.** A normal brief
   ("edited with captions and music for Instagram and our website") is rejected
   with *"Keep direct contact details inside CreatorBridge"* — the anti-poaching
   filter flags "Instagram" as a violation. This blocks legitimate briefs and the
   error misattributes the cause. Fix: allow platform names used descriptively in
   briefs (they aren't contact info), or narrow the filter to actual handles/URLs.
9. **[LOW] Brief character counter reads "231 / 80"** — 80 is a *minimum*, but
   the format looks like an over-limit maximum. Fix: label it "min 80" or show
   "151 over the 80-character minimum."
10. **[LOW] Location placeholders are "New York, NY" / "Miami, FL"** on a
    Phoenix-launch platform. Fix: use "Phoenix, AZ" placeholders.
11. **[DECISION] Two tier systems now share names.** The loyalty *fee* tiers
    (Launch/Proven/Elite, thresholds 0/10/25) now share names with the *reputation*
    tiers (launch/proven/elite/signature, different thresholds 5/20/50). A creator
    can show a "Signature" reputation badge and an "Elite" loyalty badge at once.
    Decide whether to unify them, give the fee tiers distinct names, or drop the
    loyalty badge (it duplicates the reputation badge).
12. **[LOW] Smart Match returned no Phoenix creators** — all seed creators are
    LA/Brooklyn/Chicago. Resolves at launch with real Phoenix creators; noting so
    it isn't mistaken for a matching bug.
13. **[LOW] Header state is inconsistent across routes** — some pages show "My
    Profile," others "Sign Out" + notification/message icons. Fix: one consistent
    signed-in header.
14. **[LOW] New-user login help.** During testing it was easy to confuse the
    password *label* with its value; the only recovery is "Forgot password?".
    Consider clearer field affordances for first-time users.

## Not yet walked (needs the creator/admin side or the live soft-test)

- Retainer → delivery → final-payment checkout (needs a creator to accept the
  booking — requires the creator account driven in parallel).
- Messaging / anti-poaching contact filter in an active booking.
- Networking feed (incl. the restored job-board cross-posting filter).
- Admin hub (review queue, run matching, violations, platform intelligence).
