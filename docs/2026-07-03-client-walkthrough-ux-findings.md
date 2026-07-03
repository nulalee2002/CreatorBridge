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
10. **See-through notifications dropdown.** The panel used `bg-charcoal-950/96`,
    which renders visibly translucent (≈50%, not 96%) with no backdrop behind it,
    so the landing hero heading bled through and collided with the panel header.
    Fixed to a solid background + backdrop-blur; verified live.

## Friction found — recommended, not yet changed

A. **[RESOLVED] Dispute-window contradiction fixed → one 5-day review window.**
   Was: Dispute Policy said 14 days, chatbot/payment said 72h, funds auto-released
   at 72h (contradiction). Now: a single **5-day review window** governs approval,
   revisions, disputes, AND auto-release — and approving, requesting a revision, or
   opening a dispute **pauses** the clock, so a dispute always lands before funds
   can release. Reconciled everywhere: `PLATFORM_FEES.autoApproveDays = 5`, the
   ProjectBoard auto-approve logic, both chatbots, CreatorDirectory help, Terms ×3,
   Dispute Policy, Creator Agreement, and the two delivery emails. Policy versions
   bumped to 2026-07-03. Verified live.

C. **[RESOLVED] No outside social media on creator profiles.** `creator_listings`
   had dormant, force-nulled website/instagram/youtube/vimeo/linkedin columns.
   Dropped all five (migration) and recreated the walled-garden trigger without
   them; the name/bio outbound-leak checks remain. Verified on live DB (columns
   gone, trigger fires cleanly). Client contact info was already creator-invisible
   (RLS owner+admin only; reputation badge exposes stats only — no phone/website).

B. **[LOW · pattern] `bg-charcoal-950/96` renders too translucent app-wide.**
   The notification dropdown (fixed) proved the `/96` panel background renders
   ~50% opaque, not 96%. It's used in ~13 components. Most are modals with a
   dimming backdrop so it's masked, but other **backdrop-less dropdowns**
   (StateCitySelector, RegionSelector, PresetManager, CurrencySettings,
   ProfileSettings menus) may have the same bleed-through. Worth a one-pass audit
   of backdrop-less dropdowns → solid background. Not auto-fixed to avoid a broad
   unsupervised visual change.

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

## Creator-side walkthrough (2026-07-03, logged in as the QA creator)

**Validated live (all working):**
- **Terms gate rework** — fired on login (version bump), role-scoped to the
  creator's **3** policies (ToS + Dispute + Creator Agreement), mandatory "I have
  read and agree" checkbox gated the Accept button. Confirmed in the DB: 3
  acceptance rows recorded at version 2026-07-03 (also proves the migration that
  allows `dispute_policy` in `legal_acceptances` applied).
- **5-day review window** renders on the Earnings tab ("auto-approved after 5 days").
- **No outside social media** on the public creator profile — no
  instagram/website/linkedin links anywhere; profile page loads with no console
  errors after the columns were dropped.

**Fixed live this session:**
- **[BUG] Earnings tab showed a flat 10% fee for every creator.** It rendered
  `PLATFORM_FEES.creatorFeePct` (the 10% starting rate) instead of the creator's
  loyalty tier, so a Proven creator with 14 completed projects — who actually pays
  8% — was told 10%, misstating their earnings. Now derives from
  `getLoyaltyTier(completed_projects)`. Verified live: now shows 8%.

**Found — recommended / mostly seed-data:**
- **[LOW·edge] Null primary_pillar → two different fabricated defaults.** The QA
  listing has `primary_pillar = null`; the dashboard shows "Video Production" and
  the public profile shows "Photography" — each view invents a different fallback.
  Real onboarded creators always have a pillar (so low risk), but the null-fallback
  should be one consistent value (or "not set"), not two conflicting guesses.
- **[LOW·seed] Dashboard "Proven / 0 samples / 0 requests / 0 views" looks
  contradictory.** This QA account has completed_projects=14 but 0 portfolio_items
  and null pillar — an incomplete seed listing. Stat cards (samples/requests/views)
  are legitimately 0; the confusion is the seed mismatch, resolved when real data
  lands. Public profile also shows "24 projects delivered" vs DB's 14 (seed field
  mismatch).

## Not yet walked (needs delivery flow, admin, or the live soft-test)

- Retainer → delivery → final-payment checkout (needs a live booking between the
  two accounts driven in parallel).
- Messaging / anti-poaching contact filter in an active booking.
- Networking feed (incl. the restored job-board cross-posting filter).
- Creator onboarding form fields (profile is 90-day locked on the QA account, so
  the full edit form — and confirming no social inputs there — wasn't walkable).
- Admin hub (review queue, run matching, violations, platform intelligence).
