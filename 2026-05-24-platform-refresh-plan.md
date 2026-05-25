# CreatorBridge Platform Refresh — Master Plan

**Date:** 2026-05-24
**Status:** Awaiting approval before execution
**Owner:** Claude (design + implementation)
**Source of truth:** This document. Any later changes update this file.

---

## 1. What we're doing and why

Collapse the 7-lane service taxonomy into 3 pillars (Video Production, Photography, Post Production), strip all non-US logic (no CAD, GBP, EUR, no Canada/UK/EU tiers), replace the AI-generated portfolio imagery with realistic client-work stock, and ship the new Claude Design visual language across every page. Launch-ready when done.

**Done means:**
- Every creator listing has 1 pillar and 1 to 3 sub-niches
- Filters, project briefs, rate calc, profile pages all speak the 3-pillar vocabulary
- All portfolio images look like real deliverables, not AI portraits
- US-only currency, market, and rates
- Both test accounts can complete a full booking cycle end-to-end on the new structure
- Vercel deploys clean, no console errors

---

## 2. The 3-pillar taxonomy (locked)

Creator picks **one** pillar, then **1 to 3** sub-niches within that pillar.

### Video Production (`video_production`)
| ID | Label |
|---|---|
| `vp_brand_films` | Brand Films & Commercials |
| `vp_wedding` | Wedding Films |
| `vp_event_video` | Event & Conference Video |
| `vp_music_video` | Music Videos |
| `vp_documentary` | Documentary & Interviews |
| `vp_video_podcast` | Video Podcasts |
| `vp_short_form` | Short-Form & Social (Reels/TikTok/UGC) |
| `vp_real_estate_video` | Real Estate Video |
| `vp_drone_video` | Drone & Aerial Video |
| `vp_corporate_video` | Corporate & Internal Video |

### Photography (`photography`)
| ID | Label |
|---|---|
| `ph_brand_commercial` | Brand & Commercial Photography |
| `ph_wedding` | Wedding Photography |
| `ph_event` | Event Photography |
| `ph_headshots` | Headshots & Portraits |
| `ph_product` | Product & Still Life |
| `ph_real_estate` | Real Estate Photography |
| `ph_lifestyle_fashion` | Lifestyle & Fashion |
| `ph_editorial` | Editorial & Press |
| `ph_drone_photo` | Drone & Aerial Photography |
| `ph_food_hospitality` | Food & Hospitality |

### Post Production (`post_production`)
| ID | Label |
|---|---|
| `pp_video_editing_long` | Video Editing (Long-Form) |
| `pp_short_form_edit` | Short-Form Editing |
| `pp_color_grading` | Color Grading |
| `pp_motion_vfx` | Motion Graphics & VFX |
| `pp_sound_design` | Sound Design & Mixing |
| `pp_podcast_audio` | Podcast Audio Editing |
| `pp_photo_retouch` | Photo Retouching |
| `pp_documentary_edit` | Documentary Editing |

Labels can be tuned later without breaking the IDs. New sub-niches can be added by appending rows to the taxonomy config file.

---

## 3. Database migration

### New columns on `creator_listings`
```sql
ALTER TABLE public.creator_listings
  ADD COLUMN IF NOT EXISTS primary_pillar text,
  ADD COLUMN IF NOT EXISTS sub_niches text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS minimum_project_budget numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_creator_listings_pillar ON public.creator_listings (primary_pillar);
CREATE INDEX IF NOT EXISTS idx_creator_listings_sub_niches ON public.creator_listings USING gin (sub_niches);
```

### Constraint (deferred, applied after backfill)
```sql
ALTER TABLE public.creator_listings
  ADD CONSTRAINT chk_primary_pillar CHECK (primary_pillar IN ('video_production', 'photography', 'post_production')),
  ADD CONSTRAINT chk_sub_niches_count CHECK (array_length(sub_niches, 1) BETWEEN 1 AND 3);
```

### Backfill script for existing creators
Maps current `creator_services.service_id` to a pillar + best-match sub-niche. Runs once. If a creator has multiple services in `creator_services`, the first one wins as their primary pillar and the others get mapped to sub-niches within that pillar.

### Deprecate `creator_services` table
The `creator_services` join table becomes redundant. We'll keep the table around for one release (data preserved), but new writes go to `creator_listings.primary_pillar` + `sub_niches`. A follow-up migration removes the table once we've confirmed nothing reads from it.

### Drop region/tier from `creator_listings` (if present)
Audit and remove any `region` or `country` columns that aren't US-only. Add a `state` column if not present (most flows already use it).

### Update tsvector for full-text search
Migration `20260524130000_create_search_infrastructure.sql` already added FTS. We'll extend the tsvector to include `primary_pillar` and `sub_niches` for filter-aware search.

---

## 4. Page-by-page UI changes

### Landing page (`src/pages/LandingPage.jsx`)
- "Production coverage" section: 7 lane cards → 3 pillar cards (Video Production, Photography, Post Production). Each pillar card shows 3 representative sub-niches as small text chips below.
- Featured Work section: 6 image cards keep their layout; category labels under each become sub-niche labels.
- Live network ticker at top stays as-is.
- Trusted by marquee stays.

### Find Creators (`src/components/CreatorDirectory.jsx`)
- Left filter rail "Service Lane" section: 7 chips → "All services" + 3 pillar chips.
- When a pillar is selected, sub-niche chips for that pillar appear below as a secondary filter row.
- Creator card "tags" pills: pull from `sub_niches` array, not free-form tags.
- Card grid layout unchanged.

### Project Board (`src/pages/ProjectBoard.jsx`)
- Top lane filter pills: 7 → 3.
- Brief detail panel category pill: "Pillar · Sub-niche" format.
- Brief creation form (client-side): client selects pillar first, then optional sub-niche they need.

### Creator Profile (`src/pages/CreatorProfilePage.jsx`)
- Hero: avatar, name, studio, location, years, rating (matches Claude Design profile page exactly).
- Verification Ledger card with Profile Gate / Proof Layer / Intro Check / ID & Tax.
- Stats row: rating, projects delivered, on-time delivery, repeat clients.
- "About the studio" + Crew & Approach card with numbered process.
- Specialties pills: creator's sub-niches under their primary pillar.
- "Selected work" portfolio filter buttons: creator's actual sub-niches as filters.
- Packages section: Essential / Signature / Editorial cards.
- Client Reviews section.
- Sticky bottom bar with package + Reserve button.

### Rate Calculator (`src/pages/RateCalculator.jsx` — new file based on `Rate Calculator.html`)
- Service Lane grid: 7 → 3 pillar cards.
- When pillar is picked, sub-niche selectors appear in a second row.
- Market dropdown stays (US-only tiers: NYC/LA/SF 1.4×, major metro 1.25×, mid-tier 1.1×, other US 1.0×).
- Experience buttons stay (2-3 / 4-6 / 7+ yrs).
- Right sidebar "Recommended Quote" card with breakdown.
- Package Fit section at bottom (Essential / Signature / Editorial).

### Network (`src/pages/NetworkingPage.jsx`)
No taxonomy changes needed. Pillar-agnostic page. We do clean up the UI to match Claude Design's state grid + feed + live chat layout.

---

## 4A. Background and motion effects (applies to all pages)

Feedback from Claude Design review:
- Lens flare is too bright and too large, and the side feels distorted.
- Mouse tracking is too slow.
- The live site's calculator background had moving signal lines that the new UI dropped. Bring those back.

### What's currently in the New UI files (`core.js` + `styles.css`)
- `.mouse-glow` element: 520px × 520px radial gold gradient at `rgba(221,185,106,0.16)`, screen blend mode.
- `.bg-orbs`: 3 large floating circles (520px, 380px, 300px) drifting on 24-28s loops. These are the soft glow blobs causing the distortion feel.
- Mouse tracking lerp: ring `0.18`, glow `0.08` (slow follow).
- Cursor ring: 42px, expanding to 72px on hover.

### What's on the live site (and needs to come back)
`src/components/CircuitBackground.jsx` renders:
- 3 horizontal signal lines (sweep left to right)
- 2 vertical signal lines (sweep top to bottom)
- 3 pulse dots (slow blink at fixed positions)

These are subtle, never overlap the lens flare, and don't cause the distortion the floating orbs do.

### The fix (specific values)
| Element | Current | New | Reasoning |
|---|---|---|---|
| `.mouse-glow` size | 520×520 | **340×340** | Smaller halo, less coverage |
| `.mouse-glow` opacity | `rgba(...,0.16)` | **`rgba(...,0.10)`** | Less brightness |
| `.mouse-glow` stops | 0% → 30% → 60% | **0% → 25% → 50%** | Tighter falloff, cleaner edge |
| Ring follow lerp | `0.18` | **`0.30`** | Faster, more responsive |
| Glow follow lerp | `0.08` | **`0.20`** | Faster, less laggy |
| `.bg-orbs` | 3 orbs, 300-520px | **Remove entirely** | They're what's causing distortion |
| Replace with | — | **`CircuitBackground` component** | Signal lines + pulse dots from live site |

### CircuitBackground integration
Port `src/components/CircuitBackground.jsx` and its CSS into the new design system. Mount it once in the global chrome (similar to how `core.js` mounts the cursor and glow). It sits at `z-index: 1`, below `.mouse-glow` (z-index 2).

Optionally on pages that need a calmer background (like the Rate Calculator's input panels), use the `subdued` prop which fades the signals to ~40% opacity.

### Pages where these apply
All pages. The background chrome is global. Tested visually on Landing, Find Creators, Project Board, Network, Rate Calculator, Creator Profile.

### Accessibility
Both the lens flare and circuit signals must respect `prefers-reduced-motion`. The existing `index.css` already has the media query for `.cb-motion-field`. Keep it. Add the same media query to `.mouse-glow` (hide it entirely when reduced motion is on).

### Registration (`src/components/CreatorDirectory.jsx` Step 3)
- Step 3 becomes "Pick your pillar, then pick your specialties."
- Pillar picker: 3 large cards.
- Sub-niche picker: appears after pillar is chosen, max 3 selections.
- Replaces the existing 3-services-with-comma-separated-subtypes flow.

### Request Quote Modal (`src/components/RequestQuoteModal.jsx`)
- Client picks pillar first (one of 3), then optionally narrows to specific sub-niche.
- Removes the old free-form service selection.

---

## 5. React file change list

| File | Change | Risk |
|---|---|---|
| `src/data/taxonomy.js` (NEW) | The pillar + sub-niche source of truth. Replaces `SERVICES` and `MARKETPLACE_CATEGORIES` from `rates.js`. | Low |
| `src/data/rates.js` | Strip non-US tiers (CA, UK, EU). Keep only US tier 1-3 bands. Reorganize rates around 3 pillars. | Medium |
| `src/data/image-library.js` (NEW) | Curated Unsplash/Pexels URLs per sub-niche. ~10-15 URLs per sub-niche for variety. | Low |
| `src/config/taxonomy.js` (NEW) | Same as `taxonomy.js` but exported for backend/migration use. | Low |
| `src/pages/LandingPage.jsx` | Production coverage section rebuilt with 3 pillar cards. Image swaps. | Low |
| `src/components/CreatorDirectory.jsx` | Filter sidebar 3-pillar + sub-niche layer. Registration Step 3 rewrite. Card tag changes. | High |
| `src/components/RequestQuoteModal.jsx` | Pillar-first selection. | Medium |
| `src/pages/ProjectBoard.jsx` | Lane filter pills 7→3. Brief detail pillar+sub-niche pill. Brief creation form. | Medium |
| `src/pages/CreatorProfilePage.jsx` | Full rebuild to match Claude Design profile layout. | High |
| `src/pages/RateCalculator.jsx` (NEW) | Adapted from `Rate Calculator.html`. 3 pillars, US-only. | Medium |
| `src/pages/NetworkingPage.jsx` | UI cleanup to match Claude Design. No taxonomy logic. | Low |
| `src/components/CircuitBackground.jsx` | Mount globally, replace `.bg-orbs`. | Low |
| `src/index.css` | Update `.mouse-glow` size/opacity, `.cursor-ring` lerp, remove `.bg-orbs`, add `prefers-reduced-motion` for glow. | Low |
| `src/pages/MatchResultsPage.jsx` | Match algorithm: pillar match (required) + sub-niche overlap (boost). | Medium |
| `src/components/RegionSelector.jsx` | DELETE. | Low |
| `src/components/CurrencySettings.jsx` | DELETE. | Low |
| `src/components/SupportChatbot.jsx` | Booking and quote assistants: prompt creator/client for pillar first. | Medium |
| `src/App.jsx` | Route updates if any new pages. Footer audit. | Low |
| `supabase/migrations/2026-05-XX-three-pillar-taxonomy.sql` (NEW) | All schema changes. | High |
| `scripts/backfill-creator-pillars.mjs` (NEW) | Map existing creators to new structure. | High |
| `scripts/verify-three-pillar-taxonomy.mjs` (NEW) | Verification script. | Low |

---

## 6. Image strategy

### Source
**Primary:** Unsplash (free, license-clean, what Claude Design already uses).
**Fallback:** Pexels (also free, slightly different aesthetic, fills gaps).
**Last resort:** AI-generated via FLUX or Imagen 4 for sub-niches with weak stock coverage.

### Curation approach
Each sub-niche gets ~10-15 hand-picked image URLs in `src/data/image-library.js`. The selection criteria:
- Looks like a DELIVERABLE, not a creator portrait or "vibe shot"
- Has obvious commercial intent (branded products, real venues, real people in real situations)
- Mixed orientations (landscape, portrait, square)
- Mixed crops (wide, mid, detail)
- No watermarks, no obvious stock-photo cliches

### Example search queries per sub-niche
| Sub-niche | Unsplash search terms |
|---|---|
| `ph_brand_commercial` | "skincare flat lay", "luxury product editorial", "lifestyle brand photography" |
| `ph_wedding` | "wedding ceremony candid", "wedding rings detail", "wedding couple golden hour" |
| `ph_editorial` | "fashion editorial moody", "magazine cover style", "editorial portrait studio" |
| `ph_real_estate` | "modern interior architecture", "luxury living room", "kitchen design photography" |
| `ph_food_hospitality` | "fine dining plate overhead", "restaurant interior warm", "cocktail photography" |
| `ph_product` | "product photography white background", "still life composition", "luxury watch detail" |
| `vp_brand_films` | "cinematic film frame", "commercial film still", "color graded film shot" |
| `vp_wedding` | "wedding videography still", "wedding ceremony cinematic" |
| `vp_drone_video` | "aerial drone landscape", "drone real estate footage" |
| `pp_color_grading` | "DaVinci color grading", "film color reference", "cinematic color palette" |
| `pp_motion_vfx` | "motion graphics design", "kinetic typography", "VFX compositing" |

I'll build the full library during implementation. ~250 image URLs total.

### Avatar imagery
Avatars stay as portrait crops (the small circular ones). Portrait imagery is fine THERE; just not for portfolio covers.

---

## 7. Rollout sequence

1. **Migration first.** New columns, indexes, constraints (without the CHECK constraints initially). Backfill existing creators. Then apply the CHECK constraints.
2. **Taxonomy config files.** `taxonomy.js`, `image-library.js`. No UI changes yet.
3. **Registration flow.** New 3-pillar picker. This unblocks new signups.
4. **Find Creators directory.** Filter rail update, card tag changes.
5. **Creator Profile page.** Full visual rebuild to match Claude Design profile layout.
6. **Project Board.** Lane filter + brief detail + brief creation form.
7. **Rate Calculator.** New standalone page using existing HTML as visual reference.
8. **Landing page.** Production coverage section rebuild + image swap.
9. **Network page.** UI polish to match Claude Design.
10. **Chatbot.** Booking/quote assistant updates.
11. **Background and motion effects.** Mount `CircuitBackground` globally. Remove `.bg-orbs`. Shrink and dim the lens flare. Speed up mouse tracking (ring 0.30, glow 0.20). Add `prefers-reduced-motion` guard for the glow.
12. **Cleanup.** Delete `RegionSelector.jsx`, `CurrencySettings.jsx`. Remove dead non-US rate data from `rates.js`.
13. **Image swap pass.** Replace all hero/portfolio/card images using `image-library.js`.
14. **Match algorithm.** Pillar-aware match scoring.
15. **Verification scripts run.** Confirm everything passes.
16. **End-to-end test with both test accounts.** Full booking cycle on new structure.

Each step ships as one or two commits. Vercel auto-deploys. We watch for console errors after each push.

---

## 8. Testing plan

### Existing test accounts
- Creator: `drl33+creator@creatorbridge.studio` / `CB-Creator-K7mQ92rV!26`
- Client: `drl33+client@creatorbridge.studio` / `CB-Client-L8pN43sX!26`

### Acceptance checklist
- [ ] Creator can log in, edit their listing, pick a pillar, pick 1-3 sub-niches, save
- [ ] Creator listing displays correctly on Find Creators directory
- [ ] Pillar filter narrows results correctly
- [ ] Sub-niche filter narrows further
- [ ] Client can post a project brief using the new pillar-first form
- [ ] Brief appears on Project Board with correct pillar tag
- [ ] Creator can apply to brief
- [ ] Client accepts application, pays retainer, creator delivers, client approves, creator gets paid
- [ ] Rate Calculator generates a quote for each pillar
- [ ] Creator Profile page renders with all sections (verification ledger, stats, packages, reviews)
- [ ] No console errors on any page
- [ ] All images load (no broken Unsplash URLs)
- [ ] Mobile responsive on iPhone-class viewport

### Pre-launch hardening still open (from May 20 handoff)
- `release-payment` JWT verification (still `verify_jwt: false`)
- Two orphaned transactions with NULL `final_transfer_id`
- `creatormatch.studio` redirect to `creatorbridge.studio`

These are tracked but separate from this refresh.

---

## 9. Open items for Lee

These are the only things I genuinely need from you before or during execution.

1. **Approve this plan.** Reply "go" and I start.
2. **Domain redirect.** If you want `creatormatch.studio` → `creatorbridge.studio` solved as part of this push, say so. Otherwise it stays on the backlog.
3. **Stripe live keys.** Are we flipping to live mode as part of this refresh, or staying in test mode for now?
4. **Vercel env vars.** When I'm ready to deploy, I'll list any new env vars needed. You'll need to add them in Vercel.

Everything else, I drive.

---

## 10. Claude Design prompt (for tomorrow when tokens refresh)

See chat for the paste-ready prompt. Once you have the updated Claude Design files, drop them in `New UI files/` and let me know. I'll use them as the visual spec while implementing.

---

## Change log

- 2026-05-24: Initial plan written. Awaiting approval.
- 2026-05-24: Added section 4A (background and motion effects) based on Claude Design review feedback. Updated file change list and rollout sequence to match. Plan approved by Lee, ready to execute.
- 2026-05-24: Phase 1 complete (migration applied, backfill ran, verify passed).
- 2026-05-24: Phase 2 partial: registration Step 3 rewritten to pillar + sub-niche picker, Step 4 portfolio dropdown uses sub-niches, validation gates updated, Supabase insert writes primary_pillar + sub_niches, creator_services insert deprecated. CreatorProfilePage has compat shim. FULL Claude Design profile visual rebuild deferred to Phase 5 alongside marketing pages.
