// Source of truth for CreatorBridge's 3-pillar service taxonomy.
// Used by registration, directory, filters, project board, matching, profile, chatbot, backfill, and verify scripts.
// Labels can be updated freely; IDs are stable and persisted in the database.

export const PILLARS = {
  video_production: {
    id: 'video_production',
    name: 'Video Production',
    icon: '🎬',
    description: 'Brand films, weddings, events, music videos, documentaries, podcasts, social, real estate, drone, corporate.',
  },
  photography: {
    id: 'photography',
    name: 'Photography',
    icon: '📷',
    description: 'Brand, weddings, events, headshots, products, real estate, lifestyle, editorial, drone, food.',
  },
  post_production: {
    id: 'post_production',
    name: 'Post Production',
    icon: '🎛️',
    description: 'Editing, color, motion graphics, sound design, podcast audio, retouching.',
  },
};

export const SUB_NICHES = {
  // ── Video Production
  vp_brand_films:        { id: 'vp_brand_films',        pillar: 'video_production', label: 'Brand Films & Commercials' },
  vp_wedding:            { id: 'vp_wedding',            pillar: 'video_production', label: 'Wedding Films' },
  vp_event_video:        { id: 'vp_event_video',        pillar: 'video_production', label: 'Event & Conference Video' },
  vp_music_video:        { id: 'vp_music_video',        pillar: 'video_production', label: 'Music Videos' },
  vp_documentary:        { id: 'vp_documentary',        pillar: 'video_production', label: 'Documentary & Interviews' },
  vp_video_podcast:      { id: 'vp_video_podcast',      pillar: 'video_production', label: 'Video Podcasts' },
  vp_short_form:         { id: 'vp_short_form',         pillar: 'video_production', label: 'Short-Form & Social (Reels/TikTok/UGC)' },
  vp_real_estate_video:  { id: 'vp_real_estate_video',  pillar: 'video_production', label: 'Real Estate Video' },
  vp_drone_video:        { id: 'vp_drone_video',        pillar: 'video_production', label: 'Drone & Aerial Video' },
  vp_corporate_video:    { id: 'vp_corporate_video',    pillar: 'video_production', label: 'Corporate & Internal Video' },

  // ── Photography
  ph_brand_commercial:   { id: 'ph_brand_commercial',   pillar: 'photography', label: 'Brand & Commercial Photography' },
  ph_wedding:            { id: 'ph_wedding',            pillar: 'photography', label: 'Wedding Photography' },
  ph_event:              { id: 'ph_event',              pillar: 'photography', label: 'Event Photography' },
  ph_headshots:          { id: 'ph_headshots',          pillar: 'photography', label: 'Headshots & Portraits' },
  ph_product:            { id: 'ph_product',            pillar: 'photography', label: 'Product & Still Life' },
  ph_real_estate:        { id: 'ph_real_estate',        pillar: 'photography', label: 'Real Estate Photography' },
  ph_lifestyle_fashion:  { id: 'ph_lifestyle_fashion',  pillar: 'photography', label: 'Lifestyle & Fashion' },
  ph_editorial:          { id: 'ph_editorial',          pillar: 'photography', label: 'Editorial & Press' },
  ph_drone_photo:        { id: 'ph_drone_photo',        pillar: 'photography', label: 'Drone & Aerial Photography' },
  ph_food_hospitality:   { id: 'ph_food_hospitality',   pillar: 'photography', label: 'Food & Hospitality' },

  // ── Post Production
  pp_video_editing_long: { id: 'pp_video_editing_long', pillar: 'post_production', label: 'Video Editing (Long-Form)' },
  pp_short_form_edit:    { id: 'pp_short_form_edit',    pillar: 'post_production', label: 'Short-Form Editing' },
  pp_color_grading:      { id: 'pp_color_grading',      pillar: 'post_production', label: 'Color Grading' },
  pp_motion_vfx:         { id: 'pp_motion_vfx',         pillar: 'post_production', label: 'Motion Graphics & VFX' },
  pp_sound_design:       { id: 'pp_sound_design',       pillar: 'post_production', label: 'Sound Design & Mixing' },
  pp_podcast_audio:      { id: 'pp_podcast_audio',      pillar: 'post_production', label: 'Podcast Audio Editing' },
  pp_photo_retouch:      { id: 'pp_photo_retouch',      pillar: 'post_production', label: 'Photo Retouching' },
  pp_documentary_edit:   { id: 'pp_documentary_edit',   pillar: 'post_production', label: 'Documentary Editing' },
};

export const PILLAR_IDS = Object.keys(PILLARS);
export const SUB_NICHE_IDS = Object.keys(SUB_NICHES);

export const SUB_NICHES_BY_PILLAR = Object.values(SUB_NICHES).reduce((acc, sn) => {
  acc[sn.pillar] = acc[sn.pillar] || [];
  acc[sn.pillar].push(sn);
  return acc;
}, {});

export const MAX_SUB_NICHES = 3;
export const MIN_SUB_NICHES = 1;

export function getPillar(id) { return PILLARS[id] || null; }
export function getSubNiche(id) { return SUB_NICHES[id] || null; }
export function getSubNichesForPillar(pillarId) { return SUB_NICHES_BY_PILLAR[pillarId] || []; }

export function isValidSubNicheForPillar(subNicheId, pillarId) {
  const sn = getSubNiche(subNicheId);
  return Boolean(sn && sn.pillar === pillarId);
}

// Map legacy service IDs (from old src/data/rates.js SERVICES) to new pillar + default sub-niche.
// Used by the backfill script and any legacy data display.
export const LEGACY_SERVICE_TO_PILLAR = {
  video:            { pillar: 'video_production', sub_niche: 'vp_brand_films' },
  photography:      { pillar: 'photography',      sub_niche: 'ph_brand_commercial' },
  drone:            { pillar: 'video_production', sub_niche: 'vp_drone_video' },
  social:           { pillar: 'video_production', sub_niche: 'vp_short_form' },
  postProduction:   { pillar: 'post_production',  sub_niche: 'pp_video_editing_long' },
  liveevents:       { pillar: 'video_production', sub_niche: 'vp_event_video' },
  corporate_events: { pillar: 'video_production', sub_niche: 'vp_corporate_video' },
  podcast:          { pillar: 'video_production', sub_niche: 'vp_video_podcast' },
};
