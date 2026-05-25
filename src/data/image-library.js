// src/data/image-library.js
// Curated stock images per sub-niche. Sourced from Unsplash (free license).
// Selection criteria: looks like a DELIVERABLE (real product, real venue, real moment),
// not a creator portrait or generic "vibe shot."
// Use these for portfolio covers, featured work cards, and pillar hero imagery.
// Expand each sub-niche to 10-15 URLs over time for more variety.

const u = (id, w = 800) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export const IMAGE_LIBRARY = {
  // ── VIDEO PRODUCTION ─────────────────────────────────────────
  vp_brand_films: [
    u('photo-1485846234645-a62644f84728'),
    u('photo-1574717024653-61fd2cf4d44d'),
    u('photo-1598488035139-bdbb2231ce04'),
    u('photo-1518709268805-4e9042af9f23'),
  ],
  vp_wedding: [
    u('photo-1519741497674-611481863552'),
    u('photo-1606800052052-a08af7148866'),
    u('photo-1583939003579-730e3918a45a'),
    u('photo-1519225421980-715cb0215aed'),
  ],
  vp_event_video: [
    u('photo-1540575467063-178a50c2df87'),
    u('photo-1505373877841-8d25f7d46678'),
    u('photo-1511795409834-ef04bbd61622'),
  ],
  vp_music_video: [
    u('photo-1429962714451-bb934ecdc4ec'),
    u('photo-1493225457124-a3eb161ffa5f'),
    u('photo-1501386761578-eac5c94b800a'),
  ],
  vp_documentary: [
    u('photo-1502672023488-70e25813eb80'),
    u('photo-1485827404703-89b55fcc595e'),
  ],
  vp_video_podcast: [
    u('photo-1590602847861-f357a9332bbc'),
    u('photo-1478737270239-2f02b77fc618'),
    u('photo-1598488035139-bdbb2231ce04'),
  ],
  vp_short_form: [
    u('photo-1516035069371-29a1b244cc32'),
    u('photo-1611162617213-7d7a39e9b1d7'),
    u('photo-1611162616305-c69b3fa7fbe0'),
  ],
  vp_real_estate_video: [
    u('photo-1564013799919-ab600027ffc6'),
    u('photo-1600585154340-be6161a56a0c'),
  ],
  vp_drone_video: [
    u('photo-1506947411487-a56738267384'),
    u('photo-1473968512647-3e447244af8f'),
    u('photo-1508614589041-895b88991e3e'),
  ],
  vp_corporate_video: [
    u('photo-1497366216548-37526070297c'),
    u('photo-1556761175-5973dc0f32e7'),
  ],

  // ── PHOTOGRAPHY ──────────────────────────────────────────────
  ph_brand_commercial: [
    u('photo-1542038784456-1ea8e935640e'),
    u('photo-1556228720-195a672e8a03'),
    u('photo-1503602642458-232111445657'),
  ],
  ph_wedding: [
    u('photo-1519225421980-715cb0215aed'),
    u('photo-1465495976277-4387d4b0e4a6'),
    u('photo-1606800052052-a08af7148866'),
  ],
  ph_event: [
    u('photo-1511795409834-ef04bbd61622'),
    u('photo-1540575467063-178a50c2df87'),
  ],
  ph_headshots: [
    u('photo-1494790108377-be9c29b29330'),
    u('photo-1531746020798-e6953c6e8e04'),
    u('photo-1500648767791-00dcc994a43e'),
  ],
  ph_product: [
    u('photo-1523275335684-37898b6baf30'),
    u('photo-1556228578-0d85b1a4d571'),
    u('photo-1542291026-7eec264c27ff'),
  ],
  ph_real_estate: [
    u('photo-1556909114-f6e7ad7d3136'),
    u('photo-1560448204-e02f11c3d0e2'),
    u('photo-1600585154340-be6161a56a0c'),
  ],
  ph_lifestyle_fashion: [
    u('photo-1496217590455-aa63a8350eea'),
    u('photo-1487412720507-e7ab37603c6f'),
    u('photo-1521577352947-9bb58764b69a'),
  ],
  ph_editorial: [
    u('photo-1502673530728-f79b4cab31b1'),
    u('photo-1496217590455-aa63a8350eea'),
  ],
  ph_drone_photo: [
    u('photo-1473968512647-3e447244af8f'),
    u('photo-1506947411487-a56738267384'),
  ],
  ph_food_hospitality: [
    u('photo-1502672260266-1c1ef2d93688'),
    u('photo-1517248135467-4c7edcad34c4'),
    u('photo-1414235077428-338989a2e8c0'),
  ],

  // ── POST PRODUCTION ──────────────────────────────────────────
  pp_video_editing_long: [
    u('photo-1574717024653-61fd2cf4d44d'),
    u('photo-1535016120720-40c646be5580'),
  ],
  pp_short_form_edit: [
    u('photo-1611162617213-7d7a39e9b1d7'),
    u('photo-1611162616305-c69b3fa7fbe0'),
  ],
  pp_color_grading: [
    u('photo-1574717024653-61fd2cf4d44d'),
    u('photo-1551817958-c5b51e7b4a33'),
  ],
  pp_motion_vfx: [
    u('photo-1633613286848-e6f43bbafb8d'),
    u('photo-1547954575-855750c57bd3'),
  ],
  pp_sound_design: [
    u('photo-1478737270239-2f02b77fc618'),
    u('photo-1493225457124-a3eb161ffa5f'),
  ],
  pp_podcast_audio: [
    u('photo-1590602847861-f357a9332bbc'),
    u('photo-1478737270239-2f02b77fc618'),
  ],
  pp_photo_retouch: [
    u('photo-1493225457124-a3eb161ffa5f'),
    u('photo-1542038784456-1ea8e935640e'),
  ],
  pp_documentary_edit: [
    u('photo-1502672023488-70e25813eb80'),
    u('photo-1574717024653-61fd2cf4d44d'),
  ],
};

// Pillar-level fallbacks when a sub-niche has no image yet.
export const FALLBACK_IMAGES = {
  video_production: u('photo-1485846234645-a62644f84728'),
  photography:      u('photo-1542038784456-1ea8e935640e'),
  post_production:  u('photo-1574717024653-61fd2cf4d44d'),
};

export function getImagesForSubNiche(subNicheId) {
  return IMAGE_LIBRARY[subNicheId] || [];
}

export function getRandomImageForSubNiche(subNicheId, seed = 0) {
  const imgs = IMAGE_LIBRARY[subNicheId] || [];
  if (imgs.length === 0) return null;
  return imgs[seed % imgs.length];
}

export function getImageForPillar(pillarId) {
  return FALLBACK_IMAGES[pillarId] || null;
}
