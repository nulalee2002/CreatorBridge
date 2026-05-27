# CreatorBridge Visual Gap Report

**Date:** 2026-05-27
**Author:** Claude (resuming from Codex handoff)
**Scope:** Comparison only. Live React source vs the Claude Design package in `New UI files/New UI Build/CreatorBridge.zip`, plus Lee's three live-platform screenshots.
**Method:** Code-only (Vercel domain not on the sandbox allowlist). React source is the canonical "live" reference. Any rendering-only verification needs to happen in a browser on your end.

---

## 1. Image Audit (resolved, no work needed)

The design package ships 37 unique images. All 37 are present locally in `public/images/creatorbridge/handoff/`, file-name identical, no missing assets.

| Check | Result |
|---|---|
| Design package images | 37 |
| Local copies in `public/images/creatorbridge/handoff/` | 37 |
| Missing locally | 0 |
| Extra locally (would suggest off-source images) | 0 |
| `image-library.js` Unsplash references | 1 helper function (`u(id, w)`) used to build URLs from Unsplash CDN |
| Other Unsplash references in `src/` | None |

**Verdict:** Image sourcing is clean. Per your decision and the design README, Unsplash is commercially licensed and these placeholders ship as is until real creator/client work replaces them. No replacement plan needed.

---

## 2. Live Platform Adjustments (from your three screenshots)

### 2.1 Bridge Assistant intro leaked raw HTML (FIXED THIS SESSION)

| Field | Detail |
|---|---|
| File | `src/components/SupportChatbot.jsx` |
| Lines | 502 to 522 |
| Was | Two bubbles containing literal `<strong>` and `<span class="g">` tags that React escapes by default |
| Now | Three plain-text bubbles, no HTML, same `kind: 'welcome-prompts'` flag on the third bubble so quick paths still attach |
| Status | Applied, build verified |

### 2.2 Creator Agreement double-defined terms (FIXED THIS SESSION)

| Field | Detail |
|---|---|
| File | `src/pages/CreatorAgreement.jsx` |
| Lines | 85 to 89 |
| Was | `This Creator Agreement ("Agreement") governs your status as a registered service provider on the CreatorBridge platform ("Platform").` |
| Now | `This Creator Agreement governs your status as a registered service provider on the CreatorBridge platform.` |
| Note | Lines 91 to 92 already use "Agreement" and "Platform" as shorthand and read naturally without the formal definitions |
| Status | Applied, build verified |

### 2.3 Top gold line on every page (FIXED THIS SESSION)

| Field | Detail |
|---|---|
| File | `src/App.jsx` |
| Lines | 73 to 195 (CreatorBridgeChromeEffects component) |
| What it was | The 2px gold scroll-progress bar fixed at the top of every page. Renders empty and fills left to right as the user scrolls. It is in the design spec, but on short pages it reads as a half-drawn border. |
| Now | Renders only on five long-form legal routes: `/creator-agreement`, `/terms`, `/terms-of-service`, `/dispute-policy`, `/privacy`. Hidden on every other route. |
| Status | Applied, build verified. `useEffect` deps now include `location.pathname` so the conditional updates on navigation. |

---

## 3. Page-by-Page Gap Check (design package vs live React source)

Notation:
- ✓ = matches the design spec from README
- Δ = differs from spec (not necessarily wrong, flagged for your decision)
- ✗ = bug

### 3.1 Landing (screenshots 01 to 05)

Source: `src/pages/LandingPage.jsx` (37 lines, single embedded HTML body)

| Item | Spec | Live | Result |
|---|---|---|---|
| Three pillar cards | Required | Present, /find?pillar=video|photo|post links | ✓ |
| Pillar 01 chips | Brand Films & Commercials / Event & Conference Video / Documentary & Interviews | Same | ✓ |
| Pillar 02 chips | Brand & Commercial Photography / Product & Still Life / Editorial & Press | "Brand & Commercial / Product & Still Life / Editorial & Press" | ✓ (label shortened, fine) |
| Pillar 03 chips | Color Grading / Motion Graphics & VFX / Sound Design & Mixing | Same | ✓ |
| No 7-lane grid | Required (banned) | Confirmed not present | ✓ |
| All images local | Recommended | All from `/images/creatorbridge/handoff/` | ✓ |
| Hero H1 copy | "Verified creators, sorted by what matters." | "Verified creative talent for brands that need the work done right." | Δ Different copy, your call |
| Trusted brand ticker position | Section 2 (right after hero) | Section 9 (bottom, above footer) | Δ Different placement |
| Project Signals + How it works | Two separate sections | Merged into one section with 5/7 column split | Δ Slightly different structure but same content |
| Live Network heartbeat band | Not in spec | Present at top | Δ Additional content (likely intentional) |
| Why CreatorBridge + Fee Comparison | Not in spec | Present | Δ Additional content |
| Stats section (12,400 / 8,500 / 98%) | Not in spec | Present | Δ Additional content |

Verdict: Landing covers the required pillar structure and bans the 7-lane grid. The differences from spec are mostly content additions plus copy changes you may have intentionally chosen.

### 3.2 Find Creators (screenshots 06 to 09)

Source: `src/components/CreatorDirectory.jsx`

| Item | Spec | Live | Result |
|---|---|---|---|
| Primary pillar radio list (All / Video / Photo / Post) | Required | Present, copy reads "Filter by primary pillar — Video Production, Photography, or Post Production — then narrow by specialty" | ✓ |
| Specialty accordion under selected pillar | Required | Present (43 filter/chip references) | ✓ |
| Banned Drone/Podcast/Events as primary categories | Required | Only one mention found, in a free-text placeholder: `placeholder="Corporate, Wedding, Drone, UGC, Real Estate"` on line 653 | Δ Placeholder text only, not actual filter, but mentions "Drone" with no pillar context. Suggest changing to `Corporate Video, Brand Photography, Aerial Drone, Short-form, Real Estate` or similar pillar-aware examples |

### 3.3 Project Board (screenshots 10 to 12)

Source: `src/pages/ProjectBoard.jsx`

| Item | Spec | Live | Result |
|---|---|---|---|
| Pillar-based filter logic | Required | Lines 155 to 162, 1523 to 1525 use `primary_pillar` correctly | ✓ |
| Brief detail uses pillar label | Required | Line 1165 displays `pillar.name` as "Primary Pillar" | ✓ |
| Brief card `{Pillar} · {Specialty}` chip format | Required per design | Not directly confirmed without rendering, code uses pillar.name and specialty separately | Δ Worth a visual check |

### 3.4 Rate Calculator (screenshots 13 to 16)

Source: `src/data/handoffPages.js` (`rateCalculator` HTML string, ~15kB)

| Item | Spec | Live | Result |
|---|---|---|---|
| 3 pillar picker cards | Required | Present (`<div class="grid md:grid-cols-3 gap-3" id="pillars">`) | ✓ |
| Adjusted base display | Required | Present (`#adj-base`) | ✓ |
| US market dropdown, 5 options, US only | Required | Present, exact 5 options, top-tier NYC/LA/SF default | ✓ |
| No international markets | Required | None present | ✓ |
| Experience seg buttons (2-3 / 4-6 / 7+ yrs) | Required | Present | ✓ |
| Scope grid (duration, locations, deliverables, crew, revisions, usage) | Required | All present | ✓ |
| Production costs row (gear, studio, crew, travel) | Required | All present | ✓ |
| Sticky live quote sidebar | Required | Present (`position:sticky; top:6rem`) | ✓ |
| 50/50 escrow callout | Required | Present | ✓ |
| Package fit section | Required | Present (`#pkg-grid`) | ✓ |
| USD-only currency | Required | All `$` prefix, "USD" suffix | ✓ |

Verdict: Rate Calculator is the cleanest page in the audit. Matches spec almost line for line.

### 3.5 Creator Profile (screenshots 17 to 21)

Source: `src/pages/CreatorProfilePage.jsx`

| Item | Spec | Live | Result |
|---|---|---|---|
| Verification Ledger card | Required | Line 223, eyebrow + 4 items | ✓ |
| Single primary pillar (no multiple tabs) | Required | One `creator.pillar` only | ✓ |
| Service Offers section (replaces old tabs) | Required | `ServiceOffers` function line 267, mounted line 760 | ✓ |
| Dynamic Service Offers title `{Pillar} — N specialties` | Required exactly | Line 273: `{creator.pillar.label} — {creator.specialties.length} specialties.` | ✓ Exact match |
| StatStrip subtitle `across N {pillar} specialties` | Required to use creator's pillar | Line 241 hardcodes `"photography specialties"` regardless of pillar | ✗ Bug. Video Production creator profile will read "across 3 photography specialties" |
| Portfolio with specialty-name filter chips | Required | `Portfolio` function line 354 | ✓ |
| Packages (Essential / Signature / Editorial) | Required | `Packages` function line 394, called 762 | ✓ |
| Reviews section | Required | `Reviews` function line 482, called 764 | ✓ |

### 3.6 Network (screenshots 22 to 23)

Source: `src/pages/NetworkingPage.jsx`

| Item | Spec | Live | Result |
|---|---|---|---|
| US state-based feed | Required | States AZ, CA, NY, TX shown in seed data | ✓ |
| Post types (Lead / Gear / Collab / Referral) | Required | Mapping at lines 215 to 217: looking_for_creator → Gig Lead, collab → Collab, portfolio → Referral | Δ Missing explicit "Gear" type mapping. Spec lists 4 post types, code maps 3 |
| Creator pillar mini chip under post byline | Required (`.creator-pillar-mini`) | Not directly confirmed in grep, needs visual verification | Δ Verify on render |
| Network Rules glass card | Required (4 bullets) | Not directly confirmed in grep, needs visual verification | Δ Verify on render |

### 3.7 Bridge Assistant (screenshots 24 to 29)

Source: `src/components/SupportChatbot.jsx`

| Item | Spec | Live | Result |
|---|---|---|---|
| FAB at bottom-right with full mascot SVG | Required | `BRIDGE_BODY_SVG` template literal embedded | ✓ |
| Intro bubbles | Required (welcome + prompt) | NOW: 3 plain-text bubbles (intro / tagline / route) | ✓ Fixed this session |
| Quick paths (6 buttons) | Required | `kind: 'welcome-prompts'` flag preserved | ✓ |
| Keyword routing for free text | Required | `routeKeyword` per spec, video/photo/post/brief/rate/how buckets | ✓ |
| Mood states (thinking / happy / talking) | Required | Need visual verification | Δ |
| Pupil tracking | Required | Need visual verification | Δ |

---

## 4. Code Bugs Found (flagged only, not yet fixed)

| # | File | Lines | Severity | Bug |
|---|---|---|---|---|
| Bug A | `src/pages/CreatorProfilePage.jsx` | 241 | Medium | StatStrip caption hardcodes "photography specialties" for every pillar. Video Production and Post Production creators will show wrong copy. Fix: `across ${creator.specialties.length} ${creator.pillar.label.toLowerCase()} specialties` |
| Bug B | `src/components/CreatorDirectory.jsx` | 653 | Low | Free-text placeholder reads `Corporate, Wedding, Drone, UGC, Real Estate`. "Drone" with no pillar context is a soft violation of the 3-pillar rule (it should be "Drone & Aerial Video" or "Drone & Aerial Photography"). Cosmetic, in a placeholder string. |
| Bug C | `src/pages/NetworkingPage.jsx` | 215 to 217 | Low | Post-type mapping covers Lead, Collab, Referral. The design spec also calls for a "Gear" post type. Either add the mapping or remove "Gear" from the composer chips. |

---

## 5. Spec vs Live Layout Differences (your decisions)

These are not bugs. They are design-spec deviations Lee should decide on.

| # | Area | Spec | Live |
|---|---|---|---|
| Δ 1 | Landing hero H1 | "Verified creators, sorted by what matters." | "Verified creative talent for brands that need the work done right." |
| Δ 2 | Trusted brand ticker | Right after hero | At the bottom, above footer |
| Δ 3 | Landing section order | Hero → Ticker → Pillars → Signals → How → Featured → CTA | Hero → Pillars → Signals+How merged → Featured → Why CB → Stats → CTA → Ticker |
| Δ 4 | Added on Landing | (none in spec) | Live Network heartbeat band, Why CreatorBridge + Fee Comparison, Stats section |
| Δ 5 | Find Creators placeholder copy | (spec silent) | Mentions "Drone" outside pillar (see Bug B) |

---

## 6. Suggested Next Actions

| Priority | Action |
|---|---|
| 1 (now) | Push the three approved fixes to Vercel (commands below) and visually confirm on the live site |
| 2 | Decide on Bug A (Creator Profile stat strip), Bug B (placeholder copy), Bug C (Network post types). Each is a small code change. |
| 3 | Walk the 5 spec-deviation items above and decide for each: align to spec, keep current, or hybrid |
| 4 | Run a one-hour rendering pass on a browser (you, on the live site) to spot-check the items marked Δ Verify on render in tables 3.3, 3.6, 3.7 |

---

## 7. Files Touched This Session

Created:
- `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc/output/visual-qa/design-package/` (extracted CreatorBridge.zip: 29 screenshots, 37 images, 6 HTML design files, README, IMAGE_INVENTORY)
- `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc/output/visual-qa/2026-05-27-visual-gap-report.md` (this report)

Modified (the three approved fixes):
- `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc/src/components/SupportChatbot.jsx`
- `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc/src/pages/CreatorAgreement.jsx`
- `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc/src/App.jsx`

Build verified: `vite build` transforms all 1940 modules cleanly, no errors.
