import { useEffect, useRef } from 'react';

const PILLARS = [
  {
    key: 'video',
    label: 'Video Production',
    short: 'Video',
    blurb: 'Brand films, weddings, events, music videos, documentary, social, drone.',
    specialties: [
      'Brand Films & Commercials',
      'Wedding Films',
      'Event & Conference Video',
      'Music Videos',
      'Documentary & Interviews',
      'Video Podcasts',
      'Short-Form & Social (Reels/TikTok/UGC)',
      'Real Estate Video',
      'Drone & Aerial Video',
      'Corporate & Internal Video',
    ],
  },
  {
    key: 'photo',
    label: 'Photography',
    short: 'Photo',
    blurb: 'Commercial, weddings, events, portraits, product, real estate, editorial, food.',
    specialties: [
      'Brand & Commercial Photography',
      'Wedding Photography',
      'Event Photography',
      'Headshots & Portraits',
      'Product & Still Life',
      'Real Estate Photography',
      'Lifestyle & Fashion',
      'Editorial & Press',
      'Drone & Aerial Photography',
      'Food & Hospitality',
    ],
  },
  {
    key: 'post',
    label: 'Post Production',
    short: 'Post',
    blurb: 'Editing, color, motion graphics, sound design, podcast audio, retouching.',
    specialties: [
      'Video Editing (Long-Form)',
      'Short-Form Editing',
      'Color Grading',
      'Motion Graphics & VFX',
      'Sound Design & Mixing',
      'Podcast Audio Editing',
      'Photo Retouching',
      'Documentary Editing',
    ],
  },
];

function ensureHandoffGlobals() {
  window.CB = window.CB || {};
  window.CB.PILLARS = PILLARS;
  window.CB.pillarByKey = (key) => window.CB.PILLARS.find((pillar) => pillar.key === key);
  window.CB.pillarByLabel = (label) => window.CB.PILLARS.find((pillar) => pillar.label === label);
}

export function HandoffPage({ page, bgImage }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (root.dataset.handoffReady === 'true') return;
    root.dataset.handoffReady = 'true';

    ensureHandoffGlobals();
    const run = new Function('root', page.script);
    run(root);
  }, [page]);

  if (bgImage) {
    return (
      <div className="relative min-h-screen">
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
          <img src={bgImage} alt="" className="h-full w-full object-cover" style={{ opacity: 0.4, filter: 'brightness(0.85) saturate(1.1)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(13,13,15,0.62) 0%, rgba(13,13,15,0.72) 50%, rgba(13,13,15,0.82) 100%)' }} />
        </div>
        <div
          ref={rootRef}
          className="cb-handoff-page relative z-0"
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="cb-handoff-page"
      dangerouslySetInnerHTML={{ __html: page.html }}
    />
  );
}
