# CreatorBridge — Launch Implementation Handoff

This bundle contains the **complete, launch-ready design system** for CreatorBridge in HTML/CSS/JS form, plus this README which documents every implementation detail. The intended developer is ChatGPT Codex (or any engineer) implementing this into the live CreatorBridge React app.

---

## 1 · About the design files

The files in `design_files/` are **design references created in HTML** — high-fidelity prototypes showing the intended look, behavior, motion, and structure. They are NOT meant to be shipped as-is.

The task is to **recreate these prototypes inside the real CreatorBridge React codebase**, using the codebase's existing patterns (components, routing, state management, data layer). Treat the HTML files as the visual + behavioral source of truth, and the React app as the engine that has to faithfully reproduce them.

If the existing React app has component primitives (Button, Card, Modal, etc.), use them — but match their props/variants to the visual specs below. If the visuals differ from what the existing components produce, update the components.

## 2 · Fidelity

**Hi-fi.** Every color, spacing value, font weight, animation duration, and interaction is final. The developer should match these pixel-for-pixel. Where this README spells out a value (hex, px, ms, easing), use exactly that value. Do not substitute brand-similar colors or system fonts — they will not match.

---

## 3 · Project scope

CreatorBridge is a **US-only verified marketplace** for media production talent. Six pages are in scope for this launch:

| File | Page | Purpose |
|---|---|---|
| `Landing.html` | Home | Hero, 3-pillar cards, value props, featured work, CTAs |
| `Find Creators.html` | /creators | Browse + filter creators by pillar + specialty + tier + budget + availability |
| `Creator Profile.html` | /creators/:slug | Single creator profile (uses `profile-app.jsx`) |
| `Project Board.html` | /projects | Open production briefs with detail panel and "Post a brief" modal |
| `Rate Calculator.html` | /rate-calculator | Creator-side pricing tool with live USD quote + package suggestions |
| `Creator Network.html` | /network | Creator-only social/feed area by US state |

All six share the **same chrome** (nav, footer, ambient background, cursor effects, Bridge chatbot, scroll progress bar) — implemented in `core.js` + `styles.css`. Implement that chrome ONCE as shared layout/components and mount it on every route.

---

## 4 · Platform rules — non-negotiable

These rules are baked into copy, data shapes, filters, and labels across every page. **Violating them is a launch-blocking bug.**

### 4.1 Three primary pillars

CreatorBridge has exactly **three primary pillars**. Every creator commits to ONE pillar plus 1–3 specialties inside it.

1. **Video Production** — base hourly $220
2. **Photography** — base hourly $150
3. **Post Production** — base hourly $95

The pillar list lives in `core.js` as `window.CB.PILLARS` — copy that data into a constants file (e.g. `src/constants/pillars.ts`). It is the single source of truth for pillar labels, ordering, and specialty lists.

### 4.2 Specialty lists (exact)

**Video Production**
- Brand Films & Commercials
- Wedding Films
- Event & Conference Video
- Music Videos
- Documentary & Interviews
- Video Podcasts
- Short-Form & Social (Reels/TikTok/UGC)
- Real Estate Video
- Drone & Aerial Video
- Corporate & Internal Video

**Photography**
- Brand & Commercial Photography
- Wedding Photography
- Event Photography
- Headshots & Portraits
- Product & Still Life
- Real Estate Photography
- Lifestyle & Fashion
- Editorial & Press
- Drone & Aerial Photography
- Food & Hospitality

**Post Production**
- Video Editing (Long-Form)
- Short-Form Editing
- Color Grading
- Motion Graphics & VFX
- Sound Design & Mixing
- Podcast Audio Editing
- Photo Retouching
- Documentary Editing

### 4.3 Banned legacy concepts

DO NOT show any of these as primary categories anywhere — they exist only as specialties under the appropriate pillar:
- Drone / Aerial (→ "Drone & Aerial Video" under Video, "Drone & Aerial Photography" under Photo)
- Podcast (→ "Video Podcasts" under Video, "Podcast Audio Editing" under Post)
- Events (→ "Event & Conference Video" under Video, "Event Photography" under Photo)
- Brand Content (→ "Brand Films & Commercials" or "Brand & Commercial Photography")
- Editing / Post Production (→ each is now a Post Production specialty)
- The old "7-lane" service grid

### 4.4 US-only, USD-only

- Markets shown anywhere are US cities only (NYC, LA, SF, Boston, Seattle, DC, Denver, Austin, Miami, Chicago, Atlanta, smaller US metros).
- All prices, escrow amounts, and budget filters are in **USD** with a `$` prefix and the "USD" suffix where appropriate.
- Do not show international cities, non-USD currency symbols, or international region selectors.

### 4.5 Escrow model

50/50 escrow on every booking:
- 50% held when client awards / books
- 50% released on delivery approval
- Client booking fee: **5%**
- Creator fee: **6–10%** (varies by tier)

---

## 5 · Design tokens

All tokens are defined as CSS custom properties on `:root` in `styles.css`. Mirror these in your theme/tokens file.

### 5.1 Colors

```
--bg            : #0d0d0f   /* primary background */
--bg-card       : rgba(20, 20, 24, 0.6)   /* card surfaces */
--gold          : #c9a84c   /* primary accent */
--gold-light    : #ddb96a   /* hover/active accent */
--gold-dim      : rgba(201, 168, 76, 0.08)   /* tinted backgrounds */
--text          : #e8e6e3   /* primary text */
--text-secondary: rgba(232, 230, 227, 0.7)
--text-dim      : rgba(232, 230, 227, 0.45)
--border        : rgba(255, 255, 255, 0.08)
--border-hover  : rgba(201, 168, 76, 0.3)
--green         : #4ade80   /* "available" / status dot */
--red           : #ef4444   /* REC dot on Bridge mascot */
```

### 5.2 Typography

- Serif (display): **Playfair Display** — weights 400, 500, 600, 700 (and italic 400, 500)
- Sans (body, UI): **Inter** — weights 300, 400, 500, 600, 700
- Load both from Google Fonts (preconnect + a single stylesheet link per page).
- Body default: Inter 14–16px / 400 / line-height 1.55 / color `--text`.
- Eyebrows: Inter 10px / 500 / `letter-spacing 0.2em` / `text-transform: uppercase` / color `--text-dim`.
- Section H1: Playfair Display 40–56px / 500 / line-height 1.05.
- Stat numbers: Playfair Display 32–48px / 400 / `--gold`.

### 5.3 Spacing & radii

- Card border-radius: `14px` (compact), `18px` (hero), `12px` (pills/chips: `6–10px`).
- Section vertical rhythm: `4rem` to `6rem` between major sections, `1.5rem` to `2.5rem` between subsections.
- Page horizontal padding: `1.5rem` on mobile, `4rem` (`px-16`) on desktop.
- Page max width: `1280px` (footer) / `1400px` (content).

### 5.4 Shadows

```
glow-soft : 0 8px 28px rgba(0,0,0,0.5), 0 0 24px rgba(201,168,76,0.18)
card-hover: 0 24px 60px rgba(0,0,0,0.45), 0 0 40px rgba(201,168,76,0.06)
panel     : 0 30px 80px rgba(0,0,0,0.6), 0 0 50px rgba(201,168,76,0.08)
```

### 5.5 Easing

The standard easing used everywhere is `cubic-bezier(0.23, 1, 0.32, 1)` ("ease-out-quint"). Use it for hovers, card lifts, and panel reveals. Spring-flavored entrances use `cubic-bezier(0.4, 1.6, 0.6, 1)`.

---

## 6 · Shared chrome (lives on every page)

Implement these as a `<Layout>` wrapper component or equivalent. Order top-to-bottom in the DOM:

### 6.1 Ambient background

Three fixed-position layers behind all content (z-index: 0). Defined in `styles.css` and injected in `core.js → mountChrome`:

1. **`.bg-grid`** — Repeating 90×90px gold grid with radial mask. Drifts diagonally over 80s loop (`@keyframes gridDrift`). Opacity 0.55.
2. **`.bg-signals`** — Nine thin gold "signal-line" traces (`.sig.h1…h4`, `.sig.v1…v3`, `.sig.d1–d2`) that travel horizontally, vertically, and diagonally across the viewport at different speeds (11s–24s loops). Each has a soft drop-shadow. Mask: radial-ellipse 90% at 50%/50%.
3. **`.mouse-glow`** — 300×300px radial gold glow that follows the cursor with `mix-blend-mode: screen`. Only visible while `body.mouse-active`. Hidden under reduced-motion.

Also: `body::before` paints two static anchor gradients in the corners.

### 6.2 Custom cursor

- `.cursor-ring` — 30×30 px gold ring with `mix-blend-mode: difference`. Grows to 50×50 with gold glow when class `.hover` is added (added on hover of clickable elements).
- `.cursor-dot` — 5×5 px gold dot pinned to the actual pointer.
- Idle: ring gently pulses (`@keyframes ringBreathe`).
- Lerp factors: ring 0.38, glow 0.28 (snappy follow — was sluggish at lower values, do not lower).
- Hidden under `@media (max-width: 768px)`.

### 6.3 Scroll progress bar

`.scroll-progress` — 2px gold bar fixed at top, width updated in scroll handler in `core.js`.

### 6.4 Nav

`#nav-root` is mounted by `window.CB.mountNav(activeKey)`. Pass one of `home | find | projects | profile | rate | network`.

- Fixed header, blurred backdrop (`backdrop-filter: blur(20px)`), `border-bottom` appears after scroll (`body.scrolled`).
- Left: logo (`logo.png`) linking to `/`.
- Center: nav links — Find Creators / Project Board / Creator Network / Rate Calculator.
- Right: "Sign in" ghost button + "Apply to join" gold button.
- Each link uses `.nav-link` — hover triggers a gold underline draw via `::after`.

### 6.5 Footer

`#footer-root` mounted by `window.CB.mountFooter()`. Max-width 1280px, four columns on desktop:

- Col 1 (2.2fr): logo + brand description + three pillar pills (`Video Production / Photography / Post Production`)
- Col 2 (1fr): Platform links
- Col 3 (1fr): For Creators links
- Col 4 (1fr): Company links
- Bottom row: copyright + Terms/Privacy/Support

Footer must NOT stretch to fill empty space on wide desktops — it caps at 1280px and centers. Reduced-motion-safe.

### 6.6 Bridge Assistant (chatbot)

A persistent floating mascot at bottom-right (`.cb-fab.cb-fab-body`). This is the single most personality-loaded UI element — implement carefully.

**Anatomy** (see `bridgeBodySvg` in `core.js` for the exact SVG):
- Antenna with pulsing signal dot at top
- Round head with viewfinder strip, two lens-eye sockets, gold pupils with white glints, smile arc, cheek blush
- Camera-body torso with pulsing red REC dot + Playfair "CB" monogram
- Two arms — left arm relaxed at side, right arm extended holding a clapperboard
- Clapperboard with "BRIDGE" text on the slate + diagonal stripes on the moving stick
- Two legs with stub feet
- Soft ground shadow

**Container** (`.cb-fab-body`):
- Position: fixed, `bottom: 1.5rem`, `right: 1.5rem`
- Size: `44px × 62px` (pill, `border-radius: 24px`)
- Background: layered radial gradients (gold floor + dark center)
- Border: `1px solid rgba(201,168,76,0.4)`, becomes solid gold on hover
- Box-shadow: dark drop + gold glow + inset highlight
- Two `.cb-fab-ring` siblings = pulsing pill rings on a 3.2s loop, offset by 1.6s.

**Animations** (in `styles.css`):
- `bodyBob` — whole SVG translates Y -2px on a 3.6s loop
- `recBlink` — red REC dot pulses 2.4s
- `clapperSnap` — top of clapperboard rotates -22° → 0° (snap) → settles, 7s loop
- `legShift` — legs counter-rotate ±2° on 4.8s loop (idle weight transfer)
- `armSway` — right arm recoils 3° in sync with the clapper snap
- `bridgeBlink` — eyes scaleY to 0.08 briefly every 5.2s
- `antennaPulse` — antenna dot opacity oscillates 2.2s
- `mouthBreathe` — smile scales gently 4s
- All bypassed under `prefers-reduced-motion`.

**Interactions**:
- Click FAB → panel slides up from bottom-right with `transform: scale(0.94) translateY(20px) → scale(1) translateY(0)`.
- First open ever: head group ONLY (`.bridge-head-group`) tilts via `@keyframes bridgeWave` (~0.9s), and clapper does an instant `snap-now` animation.
- Pupils follow cursor: JS computes `dx, dy` from each `.bridge-eyes` group's bounding rect, clamps magnitude to 1.0, multiplies by `MAX_PUPIL_OFFSET = 1.4` (SVG units). Applied as `transform: translate(ox oy)` on `.bridge-pupils`. Transition: 0.18s ease-out-quint.
- Mood states (added/removed by JS):
  - `mood-thinking` — pupils look up-right, blink faster, mouth becomes small
  - `mood-happy` — quick big smile + glint sparkle
  - `mood-talking` — mouth animates on a 0.42s loop while typing dots show

**Panel** (`.cb-chat-panel`):
- Position: fixed, `bottom: 6rem`, `right: 1.5rem`, `width: 380px`, `height: 560px`, max-width/height respect viewport.
- Background: `rgba(15,15,18,0.92)` + `backdrop-filter: blur(28px) saturate(1.4)`.
- Border: `1px solid rgba(201,168,76,0.18)`, `border-radius: 18px`.
- Header: mascot slot (60×92, full body) + meta (name "Bridge", tier pill "Concierge", subtitle "Verified production talent · US", + "Take 01 · ready when you are" tagline) + close button.
- Body: scrolling message list.
- Input row: text field + circular gold send button that rotates -8° on hover.

**Conversation seed** (first open):
1. After 250ms: *"Hi — I'm **Bridge**, your concierge for verified US production talent."*
2. After 1100ms: *"Tell me what you're producing and I'll route you to the right pillar — Video Production, Photography, or Post Production — or help you post a brief."*
3. After 2100ms: 6 quick-path buttons listed below.

**Quick paths** (rendered as `<a>` or `<button>` with serif numbers):
- `01` Find a videographer → `/creators?pillar=video`
- `02` Find a photographer → `/creators?pillar=photo`
- `03` Find an editor / colorist → `/creators?pillar=post`
- `·` Post a production brief → `/projects`
- `·` Calculate a rate (creators) → `/rate-calculator`
- `?` How CreatorBridge works → triggers in-chat 4-message explainer

**Keyword routing** for free-text input — see `routeKeyword()` in `core.js`. Match these regex buckets and reply with the appropriate suggestion + quick-path link:
- `video|film|reel|commercial|wedding|drone aerial|conference|documentary|music video` → Video Production
- `photo|product shot|headshot|portrait|editorial|real estate photo|food` → Photography
- `edit|color|grade|motion|vfx|sound|mix|retouch|post` → Post Production
- `brief|project|post a` → Project Board
- `rate|quote|price|cost|how much` → Rate Calculator
- `how|work|escrow|fee|verified|trust` → How it works explainer
- Else → fallback prompt asking what they're producing

**Accessibility**:
- FAB has `aria-label` ("Open Bridge Assistant" / "Close Bridge Assistant")
- ESC key closes panel
- Status dot has pulsing green animation (`pulseDot`)
- Reduced-motion silences all body/face animations and clapper snap

---

## 7 · Pages — detailed specs

### 7.1 Landing.html

**Sections, in order:**

1. **Hero** — Two-column layout. Left: eyebrow "US-only · Verified production talent"; H1 "Verified creators, sorted by what matters." (Playfair, 56px on desktop, gold accent on second clause); subhead; CTA pair ("Browse creators" gold + "Post a brief" ghost). Right: floating glass-card composition of 2 client work images with parallax.
2. **Trusted brand ticker** — Horizontal scrolling row of brand names in muted text. Pauses on hover.
3. **Three Pillar Cards** (the centerpiece). Eyebrow "Three production pillars". H2 "Every creator chooses one primary pillar — and you choose theirs." Three cards in a grid:
   - Card 1: Video Production. 16:10 cover image (Unsplash brand film frame). Pillar number "01" in gold serif top-right of cover. Body: pillar name, blurb, 3 specialty chips (Brand Films & Commercials, Event & Conference Video, Documentary & Interviews), "+7 more specialties" footer, arrow circle that goes gold on hover. Links to `/creators?pillar=video`.
   - Card 2: Photography. Same structure, cover = commercial photo frame, chips = Brand & Commercial / Product & Still Life / Editorial & Press. Links to `?pillar=photo`.
   - Card 3: Post Production. Cover = color grading timeline, chips = Color Grading / Motion Graphics & VFX / Sound Design & Mixing. Links to `?pillar=post`.
   - Hover: card lifts 5px, border tints gold, chips lift in staggered sequence (50ms / 100ms delays), cover image scales 1.06.
4. **Project Signals** — Three-row mini-list showing the three pillars with average starting rates ($1.5k+ / $500+ / $350+) — pulls in client-work thumbnails.
5. **How it works** — Three-step process (verify creators, scope project, escrow + deliver).
6. **Featured Work** — Grid of 6 portfolio thumbnails tagged by specialty (Brand Films, Editorial, Color Grading, etc.) — NEVER use a standalone "Podcast" tag here; use "Color Grading" or similar.
7. **CTA Footer** — Final call-to-action block with two CTAs.

**Critical detail**: There must be NO 7-lane category grid anywhere on this page. The old `.lane-card` Apple-style row of 7 service tiles has been replaced by the 3 pillar cards in section 3.

### 7.2 Find Creators.html

**Layout**: Sidebar (3 cols) + Results (9 cols).

**Sidebar filters** (sticky):
1. **Primary pillar** — radio list: All services / Video Production / Photography / Post Production. Each row is a `.filter-chip.pillar-chip` with a serif "01/02/03/ALL" prefix and count badge.
2. **When a non-"All" pillar is selected**: a `.specialty-list` accordion opens directly under that pillar showing the full specialty list for that pillar as checkboxes. Multi-select. "Clear specialties" link appears when any selected.
3. Tier (Any / Elite / Proven / Verified)
4. Budget (Any / Under $750 / $750–$2,000 / $2,000+) — USD
5. Availability (Any / Open now / Within 2 weeks / Within 4 weeks)
6. "Reset" link at top right of sidebar header

**Top search row**: Search input (placeholder "Search by name, studio, specialty, city") with a gold "Search" button.

**Results grid**: 2-col on tablet, 3-col on XL. Each `.creator-card`:
- 16:10 cover image
- Top-left: `.pillar-label` chip (gold dot + pillar name)
- Top-right: tier chip (gold) + optional "Available" green chip
- Avatar (54×54, rounded 12px) bottom-left of cover overlapping
- Body: studio name + star rating row, name · city · years, blurb, **up to 3 specialty pills**, footer with "from $X" gold price + "View profile" ghost button.

**Empty state**: If no matches, show a glass card with "No matches yet" + reset button.

**Sort options**: Featured (default) / Highest rated / Price low-to-high / Price high-to-low / Newest.

**URL params**: `?pillar=video|photo|post` pre-selects pillar. Legacy `?lane=podcast` maps to `post`, `?lane=drone` maps to `video`, `?lane=events` maps to `video`, `?lane=brand` maps to `video`.

**Creator data**: 12 sample creators in `Find Creators.html` — these are sample data only. The real implementation pulls from your DB. Each must have:
- `pillar: 'video' | 'photo' | 'post'` (singular — never an array)
- `specialties: string[]` (1–3 items from the appropriate pillar's specialty list)
- `tier`, `price`, `budget` bucket, `rating`, `reviews`, `avail`, `years`, `blurb`, `avatar`, `cover`, `featured`

### 7.3 Creator Profile.html

Powered by `profile-app.jsx` (React mounted into the page). Implement as a real React route at `/creators/:slug`.

**Sections, top to bottom:**

1. **Breadcrumb** — Home / Find Creators / Photography / Aria Visual Studio. Pillar label links to `/creators?pillar=photo`.
2. **Hero** — Two columns. Left: HeroInfo (avatar + studio name + creator name/city/years + **primary pillar badge** + tier chips + Available pill + tagline (Playfair italic) + 1–3 **specialty chips** + rating + response time + Check Availability / Message / Save buttons + Verification Ledger glass card). Right: large 16:10 reel image with play button overlay.
3. **StatStrip** — 4-up glass card with: Rating, Projects Delivered (caption: "across N photography specialties"), On-time Delivery, Repeat Clients.
4. **About** — Bio + meta info (gear, languages, crew, featured in).
5. **ServiceOffers** — *NEW section, replaces old service-lane tabs.* Eyebrow "Service offers". H2 "Photography — N specialties." Renders a 3-column grid; one card per specialty the creator works in. Each card has a serif "01/02/03" number, the pillar label in eyebrow, the specialty name as H3, and a blurb pulled from `SPECIALTY_BLURB` map.
6. **Portfolio** — Filter chips use the creator's specialty names exactly (not generic "Editorial/Commercial/Portrait" — use the full specialty names like "Editorial & Press"). Grid of 9 portfolio items, click opens lightbox.
7. **Packages** — Three package tiers (Essential / Signature / Editorial) with prices and feature lists. "Signature" is recommended.
8. **Reviews** — Card list of 5–6 verified reviews.

**Rules**:
- Show ONE primary pillar — never multiple pillar tabs.
- No "Drone & Aerial" as a primary tab — drone work appears as a Photography or Video specialty.
- The Service Offers section title dynamically references `{creator.pillar.label} — {creator.specialties.length} specialties.`

### 7.4 Project Board.html

**Layout**: Filter row → 2-column (briefs list 5/12 + detail pane 7/12, detail pane sticky).

**Filters**:
- Pillar pills: ALL / 01 Video Production / 02 Photography / 03 Post Production (no Drone/Podcast/Events as separate pillar filters).
- Sort: Newest / Budget high-to-low / Budget low-to-high / Most applied
- "Post a brief" gold CTA opens modal.

**Brief card** (`.brief-card`):
- Lane icon (32×32 gold-tinted square with pillar icon)
- Status pill (Open / Shortlisting) + posted-ago timestamp
- Title (sm/medium)
- **`.pillar-lane-label` chip** showing "{Pillar Label} · {Specialty}" — e.g. "Photography · Product & Still Life", "Video Production · Event & Conference Video", "Post Production · Color Grading". This labeling format is required everywhere a brief is summarized.
- Client name · location
- Budget range in gold serif (USD) + applied count
- Active card has a gold left border via `::before`

**Detail pane** — Full brief view with hero image, pillar/status pills, title, budget/applied/deadline stat row, "The brief" prose, deliverables checklist, reference images grid, tags, "Booking structure" glass card (50% on award / 50% on delivery / 5% client fee), Apply with proof / Save / Share buttons.

**Post brief modal** — Standard form. Includes a cascading select: Primary pillar → Specialty (the second dropdown's options change based on the first via `refreshSpecOptions()`).

### 7.5 Rate Calculator.html

A creator-side tool that computes USD quotes.

**Layout**: 2-column (inputs 8/12 + live quote sidebar 4/12).

**Input column, top to bottom:**

1. **Primary pillar picker** — 3 large cards. Each card shows pillar number ("Pillar 01" eyebrow), pillar label (Playfair), and `$X/hr base · USD`. Selected card gets gold border + checkmark + glow. Selecting a pillar:
   - Sets `state.pillar`
   - Picks the first specialty in that pillar by default
   - Resets the deliverable slider's min/max/default to that pillar's unit (Finished minutes for Video / Edited images for Photo / Edit hours for Post)
   - Updates the duration label ("Shoot duration" vs "Production duration")

2. **Specialty picker** — Pills. Each pill shows the specialty name + a small multiplier tag (e.g. "+20%", "-15%") drawn from `SPECIALTY_MULT` (defined in `Rate Calculator.html`). Selected pill is solid gold. "Adjusted base" updates in the header showing the per-hour rate after pillar × specialty multiplier.

3. **US Market** — Select dropdown with five US-only options:
   - Smaller US metro · 0.92×
   - Other US market · 1.0×
   - Mid-tier · Austin/Miami/Chicago/Atlanta · 1.1×
   - Major · Boston/Seattle/DC/Denver · 1.25×
   - Top-tier · NYC/LA/SF · 1.4× (default)

   No international options.

4. **Experience** — 3 segmented buttons (2–3 yrs / 4–6 yrs / 7+ yrs).

5. **Scope of work** — 2-column grid:
   - Shoot duration (4 seg buttons: Half/Full/2-day/3-day)
   - Locations (slider 1–5)
   - Deliverables (slider — min/max/label depend on pillar)
   - Crew size (slider 1–6)
   - Revision rounds (slider 1–8, "2 included" then "+$140 each")
   - Usage rights (select: Personal 1.0× / Commercial 1yr 1.25× / Commercial 3yr 1.6× / Buyout 2.0×)
   - Three checkboxes: travel ($550 flat), RAW files (+10%), rush <72h (+15%)

6. **Production costs** — 4 numeric inputs for gear, studio, additional crew, travel. "Total costs" sums in eyebrow.

**Right column — Live quote sidebar (sticky top: 6rem)**:
- Large Playfair gold quote ("$X,XXX") + "USD"
- Quote subtitle line: "Full-day · Photography · Brand & Commercial Photography · NYC/LA/SF · 4–6 yrs"
- Breakdown rows: Base creative fee, Deliverables, Usage rights (×multiplier), Add-ons, Production costs.
- Divider
- Net to you + Effective margin (2-up)
- Buttons: Save as quote draft (gold), Build into a package (ghost)
- Escrow callout box: 50% held on booking / 50% released on delivery — both shown in gold.

**Package fit** (below sidebar):
- 3 cards: Essential (0.7×), Signature (1.0×, recommended), Editorial (2.2×) — prices rounded to nearest $50.

**Computation formula** — implement exactly as in `Rate Calculator.html → calc()`:

```
hourly = PILLAR_BASE[pillar].hourly * SPECIALTY_MULT[specialty]
baseFee = hourly * duration * exp * market
locMult = 1 + (locations - 1) * 0.18
crewMult = 1 + (crew - 1) * 0.35
deliverables = PILLAR_BASE[pillar].unit * deliverCount * exp * market
revs = max(0, revisions - 2) * 140
addons = revs + (travel ? 550 : 0) + (raw ? 0.10 * (baseFee + deliverables) : 0) + (rush ? 0.15 * (baseFee + deliverables) : 0)
subtotal = (baseFee * locMult * crewMult + deliverables) * usage + addons
quote = subtotal + sum(productionCosts)
net = quote - sum(productionCosts)
margin = round(net / quote * 100)
```

`PILLAR_BASE` and `SPECIALTY_MULT` are defined inline at the top of `Rate Calculator.html`'s `<script>`.

### 7.6 Creator Network.html

Creator-only feed organized by US state. Includes Bridge chatbot like other pages.

**Layout**: 3-column desktop (left state rail / center feed / right rail of suggested connections + network rules).

**Left rail**:
- Active state pills (CA, NY, TX, FL, GA — only US states) with online creator counts
- Click switches the feed

**Center feed**:
- Composer at top (text input + post type chips: Lead / Gear / Collab / Referral)
- Feed of `.post-card` items. Each post shows:
  - Avatar + author name + post-type tag
  - Studio · time
  - **`.creator-pillar-mini` chip** under the studio line — gold dot + Playfair pillar label + "·" + specialty (e.g. "Video Production · Brand Films & Commercials"). Every post from a creator must show this chip.
  - Post body
  - Reaction row (replies, save, more)

**Right rail**:
- Active members preview (avatars + online dot)
- **Network rules** glass card with 4 bullet items:
  - Verified accounts only · no off-platform contact sharing
  - Job leads route through the Project Board, not DMs
  - Referrals earn 3% of completed project value
  - Be local · state conversations stay state-specific

**Important**: Do not show standalone post-type icons as emoji. The current SVG-less placeholders are intentional middle-dots.

---

## 8 · Interactive hover system

Implemented in `styles.css` under "INTERACTIVE HOVER FEEDBACK". Apply globally:

| Element | Hover treatment |
|---|---|
| `.btn-gold`, `.btn-ghost` | Diagonal light sweep across the button (`::before` translateX) + inner SVG icon nudges 2px right |
| `.nav-link` | Gold underline draws from left via `::after` scaleX |
| `.filter-chip` | Gold accent bar slides in from left via `::after` scaleY |
| `.filter-pill` | Lifts -1px with shadow |
| `.spec-pick`, `.seg-btn` | Lifts -1px with shadow |
| `.chat-channel`, `.brief-card` | Slides right 2px |
| `.state-tile`, `.lane-pick`, `.pillar-pick` | Diagonal sheen sweep |
| `.tag-gold`, `.tag-green`, `.tag-plain`, `.specialty-pill` | Lifts -1px |
| `.pillar-card` (landing) | Lifts 5px + chips inside stagger-lift (50ms delay between siblings) + cover image scales 1.06 |
| Any focused input | Gold border + 3px gold-tinted shadow ring |
| Cursor ring | Grows 30→50px on hovering any clickable element, idle breathing pulse otherwise |

All hover transitions use the standard easing `cubic-bezier(0.23, 1, 0.32, 1)`. Reduced motion disables all of this.

---

## 9 · Assets

### 9.1 Imagery

Every image URL in the prototypes is from **Unsplash CDN** (`https://images.unsplash.com/...`). Unsplash images are free for commercial use under the Unsplash License (no attribution required), so they can ship as-is — **but for launch, swap in real client work** from creators you onboard during pre-launch. Real portfolio frames outperform stock for trust.

Image queries used: `photo-{id}?w={width}&q=80`. Treat them as placeholders; replace with your real CDN.

### 9.2 Logo

`design_files/logo.png` — single-color word + emblem mark. Use as-is.

### 9.3 Fonts

Loaded via Google Fonts from each HTML page:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### 9.4 CDN dependencies

| Lib | Purpose | Notes |
|---|---|---|
| Tailwind (CDN) | Utility classes used inline | In the React port, set up Tailwind locally with `@tailwindcss/postcss`. Same class names work. |
| GSAP 3.12.5 + ScrollTrigger | Reveal animations (`.reveal-up`) | Replace with Framer Motion + `whileInView` in React, OR keep GSAP — both work. |
| Lenis | Smooth scroll | Optional; native scroll works fine. Add only if smooth scroll feels right in your app shell. |

---

## 10 · Implementation order (recommended)

If this lands in front of ChatGPT Codex, ask it to implement in this order — each step is independently verifiable:

1. **Theme tokens** — Port section 5 into your theme/CSS-variables/tailwind config.
2. **Pillars constants** — Port `PILLARS` array to a constants file. Every page reads from this.
3. **Layout shell** — Implement nav, footer, ambient background layers, cursor, scroll progress as a `<Layout>` wrapper component.
4. **Bridge Assistant** — Implement the FAB + panel as a single component mounted in the layout. SVG markup can be copied verbatim from `core.js`'s `bridgeBodySvg` template literal.
5. **Find Creators** — Probably the most data-driven page; build it first so the data shape gets battle-tested.
6. **Project Board** — Reuses pillar filter pattern from Find Creators.
7. **Rate Calculator** — Logic-heavy but self-contained; port `calc()` and the pillar/specialty/multiplier tables verbatim.
8. **Creator Profile** — Already structured as a React app in `profile-app.jsx`; the port is mostly mechanical.
9. **Creator Network** — Lowest priority for v1 launch — mostly visual.
10. **Landing** — Build last; it ties together every page's visual language and acts as your QA pass.

---

## 11 · Verification checklist (do before shipping)

- [ ] No `lane=podcast / drone / events / brand` URLs in any link target
- [ ] No "Drone & Aerial", "Podcast Production", "Events & Corporate", "Editing & Post" as primary categories anywhere
- [ ] No `Drone / Podcast / Events / Brand Content` chips shown as pillar selections on creator profiles
- [ ] No currency symbol other than `$`; no non-US city names in market filters
- [ ] Footer max-width caps at 1280px on wide desktops — no stretched dark area
- [ ] Bridge chatbot appears on all 6 pages
- [ ] Mouse glow is ~300px and SUBTLE — not a giant blurry orb
- [ ] Cursor ring is 30px and follows the pointer with minimal lag
- [ ] Signal-line backdrop is visible but not distracting; no "lens flare" orbs
- [ ] Every creator card shows exactly ONE primary pillar label
- [ ] Every brief shows a `{Pillar} · {Specialty}` chip
- [ ] Rate Calculator's market dropdown is US-only
- [ ] All pricing has `$` prefix and is treated as USD
- [ ] `prefers-reduced-motion: reduce` silences signal lines, mouse glow, Bridge body animations, scroll reveals

---

## 12 · Files in this bundle

```
design_handoff_creatorbridge/
├── README.md                          ← this file
├── IMAGE_INVENTORY.md                 ← every Unsplash image used + where
├── images/                            ← 37 downloaded source images (PNG)
├── screenshots/                       ← 29 page + chatbot captures
└── design_files/
    ├── Landing.html
    ├── Find Creators.html
    ├── Creator Profile.html
    ├── Project Board.html
    ├── Rate Calculator.html
    ├── Creator Network.html
    ├── core.js                        ← shared nav/footer/cursor/bg/Bridge chatbot
    ├── styles.css                     ← shared design system + hover + Bridge
    ├── profile-app.jsx                ← React profile prototype
    └── logo.png
```

To preview the prototypes, open any `.html` file in a browser — they're fully self-contained against the shared `core.js` and `styles.css`.

---

## 13 · Screenshots index

All screenshots live in `screenshots/`. Numbered for the order a reviewer should walk through them.

**Landing**
- `01-landing-hero.png` — Hero with eyebrow + Playfair H1 + CTAs
- `02-landing-pillars.png` — The three pillar cards (Video / Photo / Post)
- `03-landing-signals.png` — Project Signals + How it works
- `04-landing-howitworks.png` — Process strip
- `05-landing-featured.png` — Featured work tiles + CTA footer

**Find Creators**
- `06-find-creators-top.png` — Header + search row
- `07-find-creators-cards.png` — Full results grid with sidebar filters
- `08-find-creators-photo-pillar-active.png` — Photography pillar active, specialty checkboxes revealed
- `09-find-creators-scrolled.png` — Scrolled cards row

**Project Board**
- `10-project-board-top.png` — Header + pillar pill filters
- `11-project-board-photo-filter.png` — Photography filter active, briefs filtered
- `12-project-board-modal.png` — "Post a brief" modal with cascading pillar → specialty selects

**Rate Calculator**
- `13-rate-calc-top.png` — Header + 3 pillar picker
- `14-rate-calc-video-selected.png` — Video Production selected, specialty multipliers visible
- `15-rate-calc-scope.png` — Scope sliders + add-ons
- `16-rate-calc-packages.png` — Package fit (Essential / Signature / Editorial) + footer

**Creator Profile** (Aria Vasquez — Photography)
- `17-profile-hero.png` — Hero with primary pillar badge + tier + 3 specialty chips + Verification Ledger
- `18-profile-stats-about.png` — Stat strip + About
- `19-profile-service-offers.png` — New Service Offers section listing the 3 specialties
- `20-profile-portfolio.png` — Portfolio with filter chips using specialty names
- `21-profile-packages.png` — Package tiers + reviews

**Creator Network**
- `22-network-top.png` — Header + state rail
- `23-network-feed.png` — Feed with `.creator-pillar-mini` chip under each post byline

**Bridge Assistant** (chatbot detail captures)
- `24-bridge-fab-closed.png` — Full-body Bridge standing at bottom-right (44×62px pill)
- `25-bridge-panel-open.png` — Panel slide-up, Bridge full body in header, intro message animating in
- `26-bridge-quick-paths.png` — Six quick paths fully rendered
- `27-bridge-how-it-works-typing.png` — Typing indicator + "thinking" mood face
- `28-bridge-how-it-works-reply.png` — Full 4-message "How it works" explainer
- `29-bridge-freetext-route.png` — Keyword routing in action — user typed "color grader for a 90 second campaign" → Bridge replies with Post Production suggestion + deep link

---

## 14 · Final note

The Bridge mascot in the corner is intentionally personality-loaded — it's the platform's anchor character, holding a clapperboard, with a face, mood states, and eye-tracking. **Do not replace it with a generic chat bubble or 3rd-party widget.** It is part of the brand and was designed alongside the rest of the system. Ship it as-built.

