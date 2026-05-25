# Claude Design Prompt: CreatorBridge 3-Pillar UI Redesign

Paste this into Claude Design when you are ready to regenerate the new UI mockups.

---

We are redesigning CreatorBridge around its final launch structure. Keep the premium black/gold visual identity, editorial typography, realistic creator-client work imagery, glassy panels, subtle circuit-line background motion, and unified footer/navigation language from the existing new UI files. Do not invent a new brand direction. Restructure the design so it matches the platform rules below.

## Platform Rules

CreatorBridge is US-only at launch and uses exactly 3 primary pillars:

1. Video Production
2. Photography
3. Post Production

Each creator chooses exactly one primary pillar, then chooses 1 to 3 specialties inside that pillar. The UI must never show a creator as having multiple primary pillars. Old standalone categories like Drone / Aerial, Podcast, Events, Brand Content, and Editing / Post must be folded into the three pillars as specialties.

## Specialty Lists

Video Production specialties:
Brand Films & Commercials, Wedding Films, Event & Conference Video, Music Videos, Documentary & Interviews, Video Podcasts, Short-Form & Social (Reels/TikTok/UGC), Real Estate Video, Drone & Aerial Video, Corporate & Internal Video.

Photography specialties:
Brand & Commercial Photography, Wedding Photography, Event Photography, Headshots & Portraits, Product & Still Life, Real Estate Photography, Lifestyle & Fashion, Editorial & Press, Drone & Aerial Photography, Food & Hospitality.

Post Production specialties:
Video Editing (Long-Form), Short-Form Editing, Color Grading, Motion Graphics & VFX, Sound Design & Mixing, Podcast Audio Editing, Photo Retouching, Documentary Editing.

## Page Requirements

Landing page:
- Replace any 7-category or old service-lane section with 3 large pillar cards.
- Each pillar card should show 3 representative specialties as small chips.
- Use realistic images that look like finished client work: commercial frames, product images, event coverage, edited film stills, real estate interiors, portraits, editorial images, or post-production timelines.
- Avoid AI-looking uniform images, abstract creator portraits, or generic “media person holding camera” stock.

Find Creators:
- Left filter rail must show `All services`, `Video Production`, `Photography`, `Post Production`.
- When a primary pillar is selected, reveal specialty chips under it.
- Creator cards must show one primary pillar label and up to 3 specialty chips.
- Do not show `Drone / Aerial`, `Podcast`, or `Events` as primary categories.

Creator Profile:
- The profile must show one primary pillar only.
- “Service Offers” should become a clean section for the creator’s primary pillar and 1-3 specialties.
- Package/portfolio filtering should use the creator’s specialties, not old service lanes.
- Do not show three primary tabs on one creator profile.

Project Board:
- Project/brief filters must use the three pillars.
- Brief detail labels should read like `Photography · Product & Still Life` or `Video Production · Event & Conference Video`.

Rate Calculator:
- Primary selection is the 3 pillars.
- After choosing a pillar, show specialty selectors.
- Keep US-only markets and USD pricing.
- Remove non-US currency or international region references.

Network:
- Keep the page mostly as-is, but profile previews should show one pillar and specialties.

Footer:
- Footer should be polished, aligned, and responsive.
- It must not stretch, clip off-screen, or leave a huge empty dark area on wide desktop.
- Keep the trusted-brand ticker only if it aligns correctly across desktop and mobile.

Motion/background:
- Keep the subtle circuit-line / signal-line background from the live CreatorBridge style.
- Reduce oversized lens flare. It should feel premium, not blurry or pixelated.
- Mouse tracking should feel responsive, not slow or lagging.
- Include reduced-motion handling.

## Deliverables

Generate updated HTML/CSS mockups for:
- Landing
- Find Creators
- Creator Profile
- Project Board
- Rate Calculator
- Network

The goal is a unified launch-ready design system that the React app can implement directly.
