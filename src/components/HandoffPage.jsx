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

export function HandoffPage({ page }) {
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

  return (
    <div
      ref={rootRef}
      className="cb-handoff-page"
      dangerouslySetInnerHTML={{ __html: page.html }}
    />
  );
}
