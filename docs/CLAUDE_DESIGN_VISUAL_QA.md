# Claude Design Visual QA

Updated: 2026-05-26

## Source of Truth

Use this package as the visual source of truth:

`/Volumes/2Work 1-Drive/Claude & ChatGPT/New UI files/New UI Build/CreatorBridge.zip`

Do not use the older copied files in `creatorbridge/project/` as the final reference. Those files are stale compared with the zip:

- `Landing.html`
- `Find Creators.html`
- `Project Board.html`
- `Rate Calculator.html`
- `Creator Network.html`
- `Creator Profile.html`
- `styles.css`
- `core.js`
- `profile-app.jsx`

The zip includes:

- `design_handoff_creatorbridge/README.md`
- `design_handoff_creatorbridge/IMAGE_INVENTORY.md`
- `design_handoff_creatorbridge/design_files/*`
- `design_handoff_creatorbridge/screenshots/01-landing-hero.png` through `29-bridge-freetext-route.png`
- `design_handoff_creatorbridge/images/*`

## Non-Negotiable Design Rules

- Three primary pillars only: Video Production, Photography, Post Production.
- A creator has exactly one primary pillar and 1-3 specialties.
- Drone, podcast, events, brand content, and editing/post may appear only as specialties, never primary categories.
- US-only, USD-only.
- Shared chrome must match the handoff: nav, footer, ambient grid/signal background, cursor effects, scroll progress, and Bridge assistant.
- Profile page must not show multiple primary service tabs.
- Mobile must keep the same design while being compact enough for a phone viewport.

## Image Policy

The handoff image inventory says the current design images are Unsplash images and are commercially usable under the Unsplash license. They are acceptable as launch placeholders from a licensing standpoint, but they should still be replaced with real creator/client work when available.

Generated photorealistic images are acceptable for:

- Hero atmosphere
- Category/pillar cards
- Editorial platform sections
- Non-portfolio marketing visuals

Generated images should not be used as proof of a specific creator's portfolio unless clearly treated as sample/demo content. For creator portfolios and creator cards, prefer approved licensed images or real submitted creator work.

## QA Checklist

- [ ] Landing page: compare against screenshots 01-05.
- [ ] Find Creators: compare against screenshots 06-09.
- [ ] Project Board: compare against screenshots 10-12.
- [ ] Rate Calculator: compare against screenshots 13-16.
- [ ] Creator Profile: compare against screenshots 17-21.
- [ ] Creator Network: compare against screenshots 22-23.
- [ ] Bridge assistant: compare against screenshots 24-29.
- [ ] Mobile pass: repeat key screens at phone width after desktop parity is confirmed.
- [ ] Image audit: replace any image that is off-brand, too AI-looking, or unsuitable as creator/client work.

## Initial Code Findings

- The current app routes most handoff pages through `src/data/handoffPages.js` and `src/components/HandoffPage.jsx`.
- The live Landing implementation is currently embedded separately in `src/pages/LandingPage.jsx`.
- Creator Profile is a React implementation in `src/pages/CreatorProfilePage.jsx`, not a raw `HandoffPage` wrapper.
- The current implementation already removed old primary categories in most active app code; remaining mentions of drone/podcast/events are mostly valid specialty labels.
- The copied `creatorbridge/project/` files still contain old 7-lane language and should not be used as the implementation reference.

