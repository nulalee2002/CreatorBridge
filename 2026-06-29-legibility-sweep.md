# CreatorBridge Legibility Sweep, 2026-06-29

Goal: fix low-contrast text/marks platform-wide (desktop + mobile) while keeping the
dark theme and the brand accent colors (clay, forest, oxblood). Standard: WCAG AA,
4.5:1 for normal text, 3:1 for large text. Backgrounds: espresso #0E0B09 and glass
panels (~#18120F). Principle applied: deep accent colors stay as fills/rings/dots that
carry meaning; anything that is actual text or a number gets a legible light color, with
a scrim where it sits over photos.

## What passes already (left unchanged)
- ivory text #F2E8D6 (16.2:1), stone secondary #B8B0A6 (9.2:1), stone-muted/text-dim
  #8C867E (5.4:1) all pass. So most body and secondary text is fine.
- forest-bright #65B685 (8.0:1) passes, so the green stays as-is.
- tag-oxblood text #C06B68 (5.2:1) passes; left as-is.
- Large clay/gold headings (gold-text) pass the 3:1 large-text bar; left as-is.

## Failures found and fixes

| # | Element | Where | Current | Ratio | Fix | New ratio |
|---|---------|-------|---------|-------|-----|-----------|
| 1 | Pillar numbers 01/02/03 | index.css `.pillar-num` | oxblood `rgba(90,16,18,.85)` over photos | 1.4 | ivory `rgba(242,232,214,.95)` + text-shadow scrim | ~12+ |
| 2 | Card category pill ("Photography") | index.css `.pillar-label` | text `var(--gold)` clay on dark pill | 3.0 | text `var(--text)` ivory; keep clay dot + border | 15.3 |
| 3 | Active filter chip ("Any tier", etc.) | index.css `.filter-chip.active` | text `var(--gold)` on clay-soft | 3.0 | text `var(--text)` ivory; keep clay bg/border | 15.2 |
| 4 | Base eyebrow label | index.css `.eyebrow` | clay #9C4A33 at 10px | 3.2 | clay #C46540 (lifted, still clay) | 4.9 |
| 5 | Hero float-card stat values | handoff `.cb-landing-hero .float-card` | forced oxblood-bright #9B2C30 | 2.6 | clay #C46540 (readable, warm) | 4.9 |
| 6 | Clay accent text (platform-wide) | tailwind `gold-400` | #b85a3e used as text | 4.27 | #c46540 (one-token lift; fills shift imperceptibly) | 4.9 |
| 7 | Faint micro-text (timestamps, captions, "verify to reply") | CreatorDashboard, NetworkingPage | text-charcoal-600 #43362f / -500 #665d54 | 1.7 / 3.0 | text-charcoal-400 #8f867c | 5.5 |

Notes:
- `.pillar-num` mobile override only changes font-size; the base color fix covers mobile.
- Decorative icons (empty-star fills, alert glyphs) left at low contrast on purpose;
  they are not text.
- No layout, spacing, or logic changed. Color/contrast only.

## Verification
- `npm run build` clean after changes.
- Spot-checked the seven items' new ratios meet AA (table above).
