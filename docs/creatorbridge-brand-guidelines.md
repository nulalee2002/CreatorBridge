# CreatorBridge Brand Guidelines (W6)

Stranger-complete brand guide: someone with no prior context can produce a correct
on-brand asset using only this document. All values are pulled from the live code
(`src/index.css`, `tailwind.config.js`), not invented. Dark mode only.

---

## 1. Brand essence

- **What it is:** the verified US media-production platform. Brands hire vetted
  video, photography, and post-production specialists across three pillars,
  without building an internal media department.
- **Positioning line:** "The production department your business never had."
- **Personality:** cinematic, warm, professional, grounded. Premium but not cold.
  Think a boutique production house, not a gig marketplace.
- **Voice in one line:** a knowledgeable friend who works in the creative industry.

---

## 2. Logo

Assets in `public/images/brand/`:
- `creatorbridge-platform-logo-transparent.png` — **primary**, background removed,
  blends into the dark UI. Use this on the platform.
- `creatorbridge-logo-lockup.png` — full lockup (mark + wordmark) for headers.
- `creatorbridge-mark.png` — the "CB" mark alone, for favicons/avatars/tight spaces.
- `creatorbridge-platform-logo.png` — logo on a solid plate (use only when a
  transparent logo would sit on a busy image).

**Usage rules**
- Clear space: keep at least the height of the "CB" mark clear on all sides.
- Minimum size: mark no smaller than 24px tall; wordmark legible at ~120px wide.
- Always place on a dark surface (espresso/charcoal). Never on white or a light
  photo without a dark scrim behind it.
- Do not recolor, stretch, add shadows/outlines, or rotate the logo.
- Wordmark casing is "CreatorBridge" (one word, camel-cap B).

---

## 3. Color palette

Dark-mode only. Base is espresso/charcoal; one warm accent (clay), two deep
supporting tones (forest, oxblood), and a warm off-white for text.

### Core
| Role | Token | Hex | Use |
|---|---|---|---|
| Base background | `--espresso` / body | `#0E0B09` / `#130F0D` | page background |
| Deepest background | `--espresso-deep` | `#080706` | full-bleed sections, footers |
| Charcoal 950 | `charcoal-950` | `#0A0807` | cards on cards |
| Primary text | `--ivory` | `#F2E8D6` | headings, body |
| Secondary text | `--stone` | `#B8B0A6` | supporting copy |
| Dim text | `--stone-muted` | `#8C867E` | captions, eyebrows, meta |

### Accent — Clay (the warm "gold")
The signature accent. It is a **warm clay/terracotta/copper**, not yellow gold.
| Token | Hex | Use |
|---|---|---|
| `--clay` (`--gold`) | `#9C4A33` | primary buttons, key accents |
| `--clay-hover` | `#B85A3E` | hover states |
| gold-400 | `#C46540` | bright accent, gradients |
| gold-300 | `#CA7959` | highlights on dark imagery |
| `--clay-soft` | `rgba(156,74,51,0.1)` | tint fills behind icons |

### Supporting
| Token | Hex | Use |
|---|---|---|
| Forest | `#1F3A2E` | success, "verified" positive states |
| Forest bright (`--green`) | `#65B685` | live/active dots, positive text |
| Oxblood | `#5A1012` | warnings, disputes, destructive |
| Oxblood bright | `#9B2C30` | error text/borders |

### Glass surfaces (the depth system)
| Token | Value | Use |
|---|---|---|
| `--glass` | `rgba(28,21,18,0.68)` | cards over imagery |
| `--glass-strong` | `rgba(35,26,22,0.82)` | dropdowns, solid overlays |
| `--glass-border` | `rgba(242,232,214,0.14)` | 1px card borders |
| `--glass-highlight` | `rgba(242,232,214,0.08)` | top inner highlight |

**Rule:** one accent per view. Clay leads; forest and oxblood are functional
(status) colors, not decoration. Never introduce a color outside this palette.

---

## 4. Typography

| Role | Family | Fallback | Notes |
|---|---|---|---|
| Display / headings | **Cormorant Garamond** | Georgia, serif | large, medium weight, tight leading (`leading-[0.98]`), `text-wrap: balance` |
| Body / UI | **Inter** | system-ui, sans-serif | 12–16px, relaxed leading |
| Eyebrow / label | Inter | — | 10–11px, `uppercase`, letter-spacing `0.2em–0.25em`, dim/stone color |

- Headlines are serif and large; body and all UI chrome are Inter.
- Accent words inside a headline use the clay color (`.gold-text`) or forest
  (`.forest-text`), never a different font.

---

## 5. Voice & tone

Warm, direct, confident, genuinely helpful. Lead with the answer.

**Do**
- Short, natural sentences. Real talk.
- State what's true and specific ("50% to book, 50% released on approval").
- Plain language a busy client understands.

**Don't**
- **No em dashes or en dashes (— –).** Use commas, periods, or "to." (This is a
  hard rule: long dashes read as AI-written and are banned platform-wide.)
- No markdown bold/asterisk bullets in user-facing copy.
- No hollow openers ("Great question!", "Certainly!"). Don't start a line with "I".
- No hype or unproven claims (see §7). No fabricated stats, brands, or activity.

---

## 6. Components (core patterns)

Reuse these classes; don't reinvent.
- **`.btn-gold`** — primary CTA. Clay fill, ivory text. One per screen area.
- **`.btn-ghost`** — secondary. Transparent, thin border, ivory text.
- **`.liquid-glass`** — the default card: glass fill + `--glass-border`, rounded
  (`rounded-xl`/`2xl`). Everything sits on glass cards over dark imagery.
- **`.pillar-card`** — the three-pillar feature card (cover image + number + body).
- **`.eyebrow`** — small uppercase tracked label above a heading.
- **`.tag-gold` / `.tag-green`** — status chips (gold = highlight, green = verified).
- **`.float-card`** — small floating stat card layered over hero imagery.
- **Marquee** (`.brand-plate` row) — horizontally scrolling strip; only ever
  contains true content (production lanes, real partners once they exist).

Layout: max width `1400px`, generous padding (`px-6 lg:px-16`), section rhythm
`py-16`. Rounded corners, soft gradients, gentle motion (parallax, slow drift).

---

## 7. Imagery & motion

**House image style** (for any generated background or hero art):
> deep charcoal, warm gold/clay rim light, gentle haze, dark reflective surface,
> ultra-cinematic. No text, no logos, no people/faces.

- Real production subjects: cameras, lenses, editing suites, film sets, studios.
- Always dark and moody; imagery sits under a dark gradient scrim so ivory text
  stays legible.
- Motion is subtle and cinematic (parallax depth, drifting embers, slow reveals),
  never bouncy or playful.

---

## 8. Hard brand constraints (never break)

1. **Verified-humans brand: never generate people or faces** in imagery.
2. **Dark mode only.** No light theme.
3. **No outside social media** promoted anywhere on the platform.
4. **US-only** positioning (national), not city-specific.
5. **Truth only:** every public claim traces to something real (no fabricated
   brands, stats, activity, or verification claims). See the W2/W3 audit docs.
6. **No long dashes** in any user-facing copy.

---

*Sourced from `src/index.css`, `tailwind.config.js`, and the platform copy on
2026-07-09. Update this file if the design tokens change.*
