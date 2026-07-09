# CreatorBridge — W2 Claims & Placeholder Audit (INTERNAL)

**Date:** 2026-07-09. **Scope:** every guest-reachable public surface, swept for
(a) unsourced/false claims and (b) placeholder/seed data masquerading as real
activity. **Status:** findings only — no code changed. Fixes await Lee's approval.

**Method (fable-mode Evidence):** grep of `src/pages` + `src/components`, read of
the exact strings, route-reachability check in `src/App.jsx`, and cross-check
against the known ground truth: **1 approved creator exists (the incomplete QA
account), and there are no real completed bookings.**

---

## Ground truth we are auditing against
- Approved creators in production: **1** (QA test account, incomplete).
- Real client bookings / completed projects: **effectively 0** (pre-launch).
- Therefore any claim of scale, named customers, or "recent activity" is, today,
  **not true** and cannot be sourced.

---

## CRITICAL — false + legal/trademark risk

### C1. Fake customer logo marquee on the homepage
- **Where:** `src/pages/LandingPage.jsx`, section **"Brands that have hired
  through the network"** (a scrolling `brand-plate` marquee). Route `/` — fully
  public.
- **What it claims:** that these 12 brands hired through CreatorBridge:
  **Aesop, Aritzia, Equinox, Harper's Bazaar, Hypebeast, Soho House, The
  Standard, Tribeca, Vogue Business, LuxRealty, Saigon Sky, Verge Conference.**
- **Why it's a problem:** most are real, well-known trademarks. None have hired
  through the platform. This is false advertising *and* uses real brands' marks
  to imply a customer/endorsement relationship that does not exist — the single
  highest-risk item on the site.
- **Recommended fix:** remove the marquee entirely for launch. Replace with a
  true, functional element (e.g., the three production pillars, or a plain
  "Now onboarding founding Phoenix creators" line). Do **not** substitute a
  different set of real brand names.

### C2. Fabricated "Recent activity across CreatorBridge"
- **Where:** `src/pages/LandingPage.jsx`, **"Recent activity across
  CreatorBridge"** block.
- **What it claims:** live bookings such as **"Aritzia × Sofia P."**,
  **"Aritzia · Resort Cutdown"**, **"SoundWave Podcast Co."**
- **Why it's a problem:** implies real completed engagements (again naming
  Aritzia). There is no such activity.
- **Recommended fix:** remove the fake activity feed, or replace with static,
  true copy about how the platform works (no invented names).

### C3. "Join thousands of creators and brands…"
- **Where:** `src/pages/LandingPage.jsx` closing CTA: *"Join thousands of
  creators and brands already building the future of media production."*
- **Why it's a problem:** there is 1 creator. Fabricated scale.
- **Recommended fix:** reword to a true, forward-looking line, e.g. *"Be one of
  the founding Phoenix creators and brands building this."*

### C4. Fabricated "Featured Work / Recent productions from the network"
- **Where:** `src/pages/LandingPage.jsx`, **"Featured Work"** section
  (`Recent productions from the network`). Route `/` — public.
- **What it claims:** six invented productions presented as real network work —
  "Luxe Campaign 2025," "Neon Dreams EP," "Beyond The Lens," "Horizon Rebrand,"
  and again **"Vogue · Resort"** and **"Aritzia · Resort Cutdown"** (real
  trademarks). All six link to `/creator/demo`.
- **Why it's a problem:** same as C1/C2 — fake portfolio + real brand names
  implying work that never happened; also depends on the demo creator account,
  which is stripped at launch (dead links).
- **Recommended fix:** hide the fake cards; keep the section shell as an honest
  founding/empty state that returns automatically when real featured work exists.

### C5. Top "Recent activity across CreatorBridge" ticker
- **Where:** `src/pages/LandingPage.jsx`, top **"Live network"** heartbeat band.
- **What it claims:** live pills like "Aria V. booked a 2-day hotel campaign,"
  "$3,400 released to LensCraft Studios," "$1,200 retainer held · Aritzia ×
  Sofia P.," "5★ review for SoundWave Podcast Co."
- **Why it's a problem:** fabricated live activity (Aritzia again).
- **Recommended fix:** Lee likes this band visually — keep the scrolling visual,
  replace the fake activity with true platform standards + a founding-creator
  call (all verifiable).

---

## HIGH — placeholder masquerading as real activity

### H1. NetworkingPage seed feed shows to real users
- **Where:** `src/pages/NetworkingPage.jsx`. `SEED_NETWORK_POSTS` (12 posts) +
  seed DMs. Route `/network` — guest-reachable (`LazyRoute` is a Suspense
  wrapper, not an auth gate).
- **Behavior (evidence):** line ~666 `setPosts(remotePosts.length ? remotePosts
  : loadLocalPosts(selectedState))` — the **seed posts render as the fallback
  whenever the DB has no real posts for the selected state.** With near-zero real
  activity, seed content is what users actually see. Also falls back to seeds on
  error / when Supabase is unconfigured (lines ~645, ~669).
- **What's fake:** invented orgs — **Phoenix Media Co., Elevation Films,
  SoundWave Podcast, Lone Star Visuals, Desert Sky Media**; fake DMs (e.g.
  "shooting a brand piece in Venice today"); and an **unsourced statistic**:
  *"short-form video podcasts are up 340% year over year,"* attributed to a
  *"Spotify 2026 podcast trends report"* (fabricated citation).
- **Recommended fix:** decide the launch behavior for `/network`:
  (a) gate it behind auth and show a true empty state ("No posts in your area
  yet — be the first"), or (b) if it stays public, replace the seed fallback with
  an honest empty state. Either way, remove the fabricated 340% stat and fake DMs.

---

## MEDIUM — wording precision (true intent, overstated words)

### M1. "instantly"
- **Where:** `src/pages/JoinAsCreator.jsx:144` *"50% final payment paid
  instantly on project approval"*; `src/components/CreatorDirectory.jsx` guest
  gate *"…and book instantly."*
- **Why:** Stripe payouts/transfers are not literally instant. The concept
  (released on approval) is true; the word oversells.
- **Recommended fix:** "released on approval" / "book in minutes."

### M2. "Browse verified media specialists" / "3 verified creators each day"
- **Where:** `src/pages/LandingPage.jsx`, `src/components/CreatorDirectory.jsx`.
- **Why:** not false in principle (creators are manually reviewed), but the
  directory is currently **empty of real verified creators** (1 incomplete QA
  account). The promise isn't *deliverable* until real Phoenix creators are
  recruited — this is the standing launch dependency, not a copy bug.
- **Recommended fix:** no copy change needed; flagged as the recruit-creators
  dependency. Ensure the completion gate hides the incomplete QA account from the
  public directory before launch.

---

## LOAD-BEARING claims — handed to W3 (not fixed here)

To avoid double-auditing the same sentences, these go to the W3 red team:
- **"protected payment"** (LandingPage, "…professional standards and protected
  payment") — verify wording against the actual Stripe charge→transfer flow;
  confirm we avoid "escrow" without counsel.
- **"verified" creators** — pin down exactly what verification happens today
  (manual review only) vs. what "verified" implies to a client; ties to the
  finalist-stage ID-verification decision.

---

## Proposed fix order (once approved)
1. **C1, C2, C3** — homepage fabrications (highest risk, one file).
2. **H1** — NetworkingPage seed/empty-state decision.
3. **M1** — "instantly" wording.
4. **M2** — confirm QA account is hidden from public directory (data/gate check).
5. Hand **protected-payment** + **verified** wording to W3.

Every fix is copy/removal on public surfaces — surgical, reversible, and
"enhance don't strip" where a true functional element can replace a false one
(C1/C3). Nothing changes until Lee approves this list.

---

## RESOLUTION LOG — 2026-07-09 (committed locally, NOT pushed/deployed)

Lee left the design call to me and asked to keep the platform balanced. Approach:
**kept every section's layout + CSS classes; swapped only the content fake→true**,
so the design language is untouched and nothing is gutted. Originals recoverable
from git history. `npm run build` passes. **Not pushed — awaiting Lee's review.**

- **C1 (brand marquee)** — 12 real brand names → true **production lanes**
  (Brand Films, Commercials, Weddings, Events, Documentary, Music Videos, Product,
  Real Estate, Editorial, Color Grading, Motion & VFX, Sound Design). Label
  "Trusted by / Brands that have hired…" → "What we produce / Every production
  lane across the network." Same scrolling marquee visual.
- **C2 (top activity ticker)** — fake bookings/$ amounts/names → true platform
  standards + founding call (manual review, 50/50, 10%→5%, 5% client fee, 60–90s
  intro, one pillar + specialties, protected payment, founding Phoenix creators,
  three pillars). Label "Live network / Recent activity…" → "How it works / What
  every project runs on." Same heartbeat-band visual.
- **C3 ("Join thousands…")** → "Be one of the founding creators and brands
  building the future of media production in Phoenix."
- **C4 (Featured Work)** — 6 fake productions incl. Vogue/Aritzia → honest
  category tiles ("Commercial & Brand Film," "Music & Performance," "Documentary
  & Interview," "Events & Conference," "Editorial & Product," "Color & Motion").
  Heading "Recent productions from the network." → "Built for every kind of
  production." Images kept (real owned imagery). Links `/creator/demo` → `/find`.
- **C5** — folded into C2 (the top ticker).
- **H1 (/network seed feed)** — disabled seed fallback for posts AND chat/DMs
  across all three paths (DB error, empty DB, unconfigured). Real users now see
  the existing honest empty state ("No posts found in this lane… Be the first").
  The fabricated "340% / Spotify report" post and fake DMs no longer render. Seed
  definitions left dormant in the file (restorable).
- **M1 ("instantly")** — JoinAsCreator "paid instantly on approval" → "released on
  project approval"; CreatorDirectory "book instantly" → "book in minutes."
- **M2 / protected-payment / verified** — unchanged here; M2 is the recruit-
  creators + hide-QA-account dependency; the load-bearing claims go to W3.

**Verification:** `node` swap scripts self-asserted every replacement count and
confirmed zero fabricated tokens survive; `npm run build` → BUILD OK. Live-browser
screenshot of the rebalanced homepage still pending (recommended before deploy).
