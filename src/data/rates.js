// ============================================================
// CREATORBRIDGE RATE DATABASE
// Public taxonomy is US-only and organized into three primary pillars:
// Video Production, Photography, and Post Production.
// Some legacy service ids remain as internal aliases so existing packages,
// quote records, and creator service rows continue to resolve safely.
// ============================================================

function r(low, high) {
  return { low, mid: Math.round((low + high) / 2), high };
}

// Equipment add-on items (daily rates in USD, converted for other regions)
export const EQUIPMENT_ITEMS = [
  { id: 'cam-pro',    label: 'Professional DSLR/Mirrorless',       defaultPrice: 150, icon: '📷' },
  { id: 'cam-cinema', label: 'Cinema Camera (RED, ARRI, etc.)',     defaultPrice: 450, icon: '🎥' },
  { id: 'lighting',   label: 'Full Lighting Kit',                   defaultPrice: 175, icon: '💡' },
  { id: 'audio',      label: 'Audio Package (mics, recorder)',      defaultPrice: 125, icon: '🎙️' },
  { id: 'drone',      label: 'Drone (DJI Pro)',                     defaultPrice: 350, icon: '🚁' },
  { id: 'gimbal',     label: 'Gimbal / Stabilizer',                 defaultPrice: 100, icon: '🎬' },
  { id: 'slider',     label: 'Slider / Jib / Crane',                defaultPrice: 150, icon: '🎞️' },
  { id: 'teleprompter',label: 'Teleprompter',                       defaultPrice: 75,  icon: '📺' },
  { id: 'green-screen',label: 'Green Screen / Backdrop',            defaultPrice: 100, icon: '🟩' },
  { id: 'lenses',     label: 'Prime/Specialty Lens Package',        defaultPrice: 225, icon: '🔭' },
  { id: 'monitor',    label: 'Field Monitor / EVF',                 defaultPrice: 75,  icon: '🖥️' },
  { id: 'tripod',     label: 'Heavy-Duty Tripod / Head',            defaultPrice: 50,  icon: '🔱' },
];

export const RATES = {

  // ─── VIDEO PRODUCTION ───────────────────────────────────────
  video: {
    hourlyShoot: {
      label: 'Hourly Rate (On-Site Shoot)',
      unit: 'hr',
      tooltip: 'Your rate for time spent on location filming. Does not include travel or post-production.',
      'us-tier1': r(150, 420), 'us-tier2': r(100, 250), 'us-tier3': r(75, 175),
      'ca-tier1': r(120, 350), 'ca-tier2': r(80, 200),  'ca-tier3': r(60, 155),
      'uk-tier1': r(80, 250),  'uk-tier2': r(50, 150),  'eu-west': r(70, 220),
    },
    halfDay: {
      label: 'Half-Day Rate (4–5 hrs)',
      unit: 'session',
      tooltip: 'Flat rate for a half-day shoot, typically 4–5 hours on location.',
      'us-tier1': r(600, 1500),  'us-tier2': r(400, 1000), 'us-tier3': r(300, 700),
      'ca-tier1': r(500, 1200),  'ca-tier2': r(350, 800),  'ca-tier3': r(260, 620),
      'uk-tier1': r(350, 900),   'uk-tier2': r(250, 600),  'eu-west': r(300, 800),
    },
    fullDay: {
      label: 'Full-Day Rate (8–10 hrs)',
      unit: 'day',
      tooltip: 'Flat rate for a full-day shoot, typically 8–10 hours on location.',
      'us-tier1': r(1200, 3360), 'us-tier2': r(800, 2000),  'us-tier3': r(500, 1200),
      'ca-tier1': r(1000, 2500), 'ca-tier2': r(700, 1500),  'ca-tier3': r(520, 1160),
      'uk-tier1': r(550, 1500),  'uk-tier2': r(400, 900),   'eu-west': r(500, 1400),
    },
    editHourly: {
      label: 'Video Editing (per hour)',
      unit: 'hr',
      tooltip: 'Hourly rate for post-production video editing work.',
      'us-tier1': r(75, 200),  'us-tier2': r(50, 125),  'us-tier3': r(30, 85),
      'ca-tier1': r(65, 175),  'ca-tier2': r(40, 110),  'ca-tier3': r(30, 85),
      'uk-tier1': r(55, 150),  'uk-tier2': r(35, 95),   'eu-west': r(40, 120),
    },
    weddingPackage: {
      label: 'Wedding Video Package',
      unit: 'project',
      tooltip: 'All-in project rate for wedding videography. Typically includes shoot day and edit.',
      'us-tier1': r(3000, 10000), 'us-tier2': r(2000, 6000),  'us-tier3': r(1500, 4000),
      'ca-tier1': r(2500, 8000),  'ca-tier2': r(1800, 5000),  'ca-tier3': r(1350, 3900),
      'uk-tier1': r(2000, 6000),  'uk-tier2': r(1500, 4000),  'eu-west': r(1800, 5500),
    },
    corporateProject: {
      label: 'Corporate Video (Project)',
      unit: 'project',
      tooltip: 'Project-based rate for corporate videos including pre-production, shoot, and edit.',
      'us-tier1': r(3000, 15000),  'us-tier2': r(2000, 8000),  'us-tier3': r(1500, 5000),
      'ca-tier1': r(2500, 12000),  'ca-tier2': r(1800, 7000),  'ca-tier3': r(1350, 5400),
      'uk-tier1': r(2500, 10000),  'uk-tier2': r(1500, 6000),  'eu-west': r(2000, 9000),
    },
    musicVideoProject: {
      label: 'Music Video (Project)',
      unit: 'project',
      tooltip: 'Project rate for music video production including concept, shoot, and edit.',
      'us-tier1': r(2000, 10000), 'us-tier2': r(1500, 5000), 'us-tier3': r(1000, 3000),
      'ca-tier1': r(1800, 8000),  'ca-tier2': r(1200, 4000), 'ca-tier3': r(900, 3100),
      'uk-tier1': r(1500, 7000),  'uk-tier2': r(1000, 4000), 'eu-west': r(1200, 6000),
    },
    equipmentHourly: {
      label: 'Equipment Fee (per hour)',
      unit: 'hr',
      tooltip: 'Hourly fee for use of your camera and gear package.',
      'us-tier1': r(25, 110), 'us-tier2': r(20, 75), 'us-tier3': r(15, 50),
      'ca-tier1': r(25, 100), 'ca-tier2': r(20, 60), 'ca-tier3': r(15, 47),
      'uk-tier1': r(20, 80),  'uk-tier2': r(15, 50), 'eu-west': r(20, 70),
    },
  },

  // ─── PHOTOGRAPHY ─────────────────────────────────────────────
  photography: {
    hourlyEvent: {
      label: 'Hourly Rate (Event/Portrait)',
      unit: 'hr',
      tooltip: 'Per-hour rate for event or portrait photography shoots.',
      'us-tier1': r(150, 500), 'us-tier2': r(100, 300), 'us-tier3': r(75, 200),
      'ca-tier1': r(120, 400), 'ca-tier2': r(80, 250),  'ca-tier3': r(60, 195),
      'uk-tier1': r(80, 300),  'uk-tier2': r(50, 180),  'eu-west': r(70, 250),
    },
    dayRateCommercial: {
      label: 'Day Rate (Commercial)',
      unit: 'day',
      tooltip: 'Full-day commercial photography rate. Standard in advertising and editorial work.',
      'us-tier1': r(2000, 5000), 'us-tier2': r(800, 2500),  'us-tier3': r(500, 1500),
      'ca-tier1': r(1500, 4000), 'ca-tier2': r(700, 2000),  'ca-tier3': r(525, 1550),
      'uk-tier1': r(800, 3500),  'uk-tier2': r(500, 2000),  'eu-west': r(700, 3000),
    },
    realEstatePerListing: {
      label: 'Real Estate (per listing)',
      unit: 'listing',
      tooltip: 'Flat fee per property listing. Typically includes interior and exterior shots.',
      'us-tier1': r(200, 500), 'us-tier2': r(150, 350), 'us-tier3': r(100, 250),
      'ca-tier1': r(175, 450), 'ca-tier2': r(125, 300), 'ca-tier3': r(95, 235),
      'uk-tier1': r(150, 400), 'uk-tier2': r(100, 250), 'eu-west': r(120, 350),
    },
    headshotsSession: {
      label: 'Headshots (per session)',
      unit: 'session',
      tooltip: 'Session rate for professional headshots including a set of final edited images.',
      'us-tier1': r(300, 1000), 'us-tier2': r(200, 600), 'us-tier3': r(150, 400),
      'ca-tier1': r(250, 800),  'ca-tier2': r(175, 500), 'ca-tier3': r(130, 390),
      'uk-tier1': r(200, 700),  'uk-tier2': r(120, 400), 'eu-west': r(150, 600),
    },
    weddingPackage: {
      label: 'Wedding Photo Package',
      unit: 'project',
      tooltip: 'All-in wedding photography rate including full day coverage and edited gallery.',
      'us-tier1': r(3000, 10000), 'us-tier2': r(2000, 5000), 'us-tier3': r(1500, 3500),
      'ca-tier1': r(2500, 8000),  'ca-tier2': r(1800, 4500), 'ca-tier3': r(1350, 3500),
      'uk-tier1': r(2000, 6000),  'uk-tier2': r(1200, 3500), 'eu-west': r(1500, 5500),
    },
    productPerImage: {
      label: 'Product Photography (per image)',
      unit: 'image',
      tooltip: 'Per-image rate for product photography. Includes one round of retouching.',
      'us-tier1': r(50, 175), 'us-tier2': r(35, 125), 'us-tier3': r(25, 75),
      'ca-tier1': r(40, 150), 'ca-tier2': r(30, 100), 'ca-tier3': r(22, 78),
      'uk-tier1': r(35, 125), 'uk-tier2': r(25, 75),  'eu-west': r(30, 120),
    },
    editHourly: {
      label: 'Photo Editing (per hour)',
      unit: 'hr',
      tooltip: 'Hourly rate for culling, retouching, and exporting final images.',
      'us-tier1': r(50, 150), 'us-tier2': r(35, 100), 'us-tier3': r(25, 65),
      'ca-tier1': r(40, 120), 'ca-tier2': r(30, 85),  'ca-tier3': r(22, 66),
      'uk-tier1': r(35, 100), 'uk-tier2': r(25, 65),  'eu-west': r(30, 90),
    },
  },

  // ─── PODCAST PRODUCTION (sub-category of video) ─────────────
  podcast: {
    basicEditPerEp: {
      label: 'Basic Edit (per episode)',
      unit: 'episode',
      tooltip: 'Basic audio editing: cuts, noise reduction, level balancing. No show notes or clips.',
      'us-tier1': r(150, 500), 'us-tier2': r(100, 300), 'us-tier3': r(50, 200),
      'ca-tier1': r(125, 400), 'ca-tier2': r(75, 250),  'ca-tier3': r(56, 195),
      'uk-tier1': r(100, 350), 'uk-tier2': r(60, 200),  'eu-west': r(80, 300),
    },
    fullProductionPerEp: {
      label: 'Full Production (per episode)',
      unit: 'episode',
      tooltip: 'Complete production: recording support, editing, mastering, show notes, and audiogram clips.',
      'us-tier1': r(500, 2500), 'us-tier2': r(300, 1500), 'us-tier3': r(200, 800),
      'ca-tier1': r(400, 2000), 'ca-tier2': r(250, 1200), 'ca-tier3': r(188, 930),
      'uk-tier1': r(350, 1800), 'uk-tier2': r(200, 1000), 'eu-west': r(300, 1500),
    },
    editHourly: {
      label: 'Podcast Editing (per hour)',
      unit: 'hr',
      tooltip: 'Hourly rate for podcast audio editing and post-production work.',
      'us-tier1': r(50, 150), 'us-tier2': r(35, 100), 'us-tier3': r(25, 65),
      'ca-tier1': r(40, 120), 'ca-tier2': r(30, 85),  'ca-tier3': r(22, 66),
      'uk-tier1': r(35, 100), 'uk-tier2': r(25, 65),  'eu-west': r(30, 90),
    },
    monthlyRetainer4Eps: {
      label: 'Monthly Retainer (4 episodes)',
      unit: 'month',
      tooltip: 'Monthly flat fee covering full production of 4 episodes. Retainers typically carry a slight discount.',
      'us-tier1': r(1500, 7000), 'us-tier2': r(800, 4000),  'us-tier3': r(500, 2500),
      'ca-tier1': r(1200, 5500), 'ca-tier2': r(700, 3200),  'ca-tier3': r(525, 2480),
      'uk-tier1': r(1000, 5000), 'uk-tier2': r(600, 3000),  'eu-west': r(800, 4500),
    },
    showNotesClipsPerEp: {
      label: 'Show Notes + Clips (per episode)',
      unit: 'episode',
      tooltip: 'Add-on: written show notes and short audiogram/video clips for social media.',
      'us-tier1': r(50, 200), 'us-tier2': r(35, 150), 'us-tier3': r(25, 100),
      'ca-tier1': r(40, 175), 'ca-tier2': r(30, 125), 'ca-tier3': r(22, 97),
      'uk-tier1': r(35, 150), 'uk-tier2': r(25, 100), 'eu-west': r(30, 125),
    },
    recordingSession: {
      label: 'Recording Session (in-studio)',
      unit: 'session',
      tooltip: 'In-person or remote-facilitated recording session rate.',
      'us-tier1': r(200, 800), 'us-tier2': r(150, 500), 'us-tier3': r(100, 300),
      'ca-tier1': r(175, 650), 'ca-tier2': r(120, 400), 'ca-tier3': r(90, 310),
      'uk-tier1': r(150, 600), 'uk-tier2': r(100, 350), 'eu-west': r(120, 500),
    },
    episodeEdit: { label: 'Per Episode Edit', unit: 'episode' },
    showLaunchPackage: { label: 'Show Launch Package', unit: 'package' },
    remoteRecordingPerEp: { label: 'Remote Recording Per Episode', unit: 'episode' },
  },

  // ─── DRONE / AERIAL ──────────────────────────────────────────
  drone: {
    hourlyPhoto: {
      label: 'Drone Photo (per hour)',
      unit: 'hr',
      tooltip: 'FAA Part 107 licensed aerial photography. Includes one pilot and drone.',
      'us-tier1': r(200, 500), 'us-tier2': r(150, 350), 'us-tier3': r(75, 200),
      'ca-tier1': r(175, 400), 'ca-tier2': r(100, 275), 'ca-tier3': r(75, 213),
      'uk-tier1': r(150, 350), 'uk-tier2': r(80, 200),  'eu-west': r(100, 300),
    },
    hourlyVideo: {
      label: 'Drone Video (per hour)',
      unit: 'hr',
      tooltip: 'FAA Part 107 licensed aerial videography. Includes one pilot and drone.',
      'us-tier1': r(250, 500), 'us-tier2': r(200, 400), 'us-tier3': r(100, 250),
      'ca-tier1': r(200, 450), 'ca-tier2': r(150, 325), 'ca-tier3': r(113, 252),
      'uk-tier1': r(175, 400), 'uk-tier2': r(100, 250), 'eu-west': r(125, 350),
    },
    halfDay: {
      label: 'Half-Day Drone Rate',
      unit: 'session',
      tooltip: 'Flat rate for a half-day drone deployment, approximately 4 hours on-site.',
      'us-tier1': r(500, 1500), 'us-tier2': r(400, 1000), 'us-tier3': r(250, 700),
      'ca-tier1': r(450, 1200), 'ca-tier2': r(350, 800),  'ca-tier3': r(263, 620),
      'uk-tier1': r(400, 1000), 'uk-tier2': r(250, 600),  'eu-west': r(300, 900),
    },
    fullDay: {
      label: 'Full-Day Drone Rate',
      unit: 'day',
      tooltip: 'Flat rate for a full day of drone operations. Includes up to 8 flight hours.',
      'us-tier1': r(1000, 3000), 'us-tier2': r(750, 2000), 'us-tier3': r(500, 1200),
      'ca-tier1': r(800, 2500),  'ca-tier2': r(600, 1500), 'ca-tier3': r(450, 1163),
      'uk-tier1': r(700, 2000),  'uk-tier2': r(450, 1200), 'eu-west': r(600, 1800),
    },
    realEstatePerProperty: {
      label: 'Real Estate Drone (per property)',
      unit: 'property',
      tooltip: 'Flat fee for a residential or commercial property aerial shoot.',
      'us-tier1': r(200, 500), 'us-tier2': r(150, 350), 'us-tier3': r(100, 250),
      'ca-tier1': r(175, 450), 'ca-tier2': r(125, 300), 'ca-tier3': r(94, 233),
      'uk-tier1': r(150, 350), 'uk-tier2': r(100, 250), 'eu-west': r(120, 300),
    },
    mappingPerAcre: {
      label: 'Mapping / Survey (per acre)',
      unit: 'acre',
      tooltip: 'Data collection for mapping, surveying, or orthomosaic deliverables.',
      'us-tier1': r(25, 75), 'us-tier2': r(20, 50), 'us-tier3': r(15, 35),
      'ca-tier1': r(20, 65), 'ca-tier2': r(15, 45), 'ca-tier3': r(11, 35),
      'uk-tier1': r(18, 55), 'uk-tier2': r(12, 35), 'eu-west': r(15, 50),
    },
    editingHourly: {
      label: 'Drone Footage Editing (per hour)',
      unit: 'hr',
      tooltip: 'Post-production editing of aerial footage. May include color grading and stabilization.',
      'us-tier1': r(75, 200), 'us-tier2': r(50, 150), 'us-tier3': r(35, 100),
      'ca-tier1': r(60, 175), 'ca-tier2': r(45, 120), 'ca-tier3': r(34, 93),
      'uk-tier1': r(50, 150), 'uk-tier2': r(35, 100), 'eu-west': r(40, 130),
    },
  },

  // ─── SOCIAL MEDIA CONTENT ────────────────────────────────────
  social: {
    singleReelTikTok: {
      label: 'Single Reel / TikTok Video',
      unit: 'video',
      tooltip: 'One short-form vertical video, shot and edited, ready to post.',
      'us-tier1': r(200, 1000), 'us-tier2': r(100, 500), 'us-tier3': r(75, 300),
      'ca-tier1': r(150, 800),  'ca-tier2': r(80, 400),  'ca-tier3': r(60, 310),
      'uk-tier1': r(125, 700),  'uk-tier2': r(60, 350),  'eu-west': r(80, 500),
    },
    contentDay: {
      label: 'Content Day (8–15 pieces)',
      unit: 'day',
      tooltip: 'A dedicated content creation day producing 8–15 short-form pieces for social media.',
      'us-tier1': r(1500, 5000), 'us-tier2': r(800, 3000), 'us-tier3': r(500, 1800),
      'ca-tier1': r(1200, 4000), 'ca-tier2': r(700, 2500), 'ca-tier3': r(525, 1938),
      'uk-tier1': r(1000, 3500), 'uk-tier2': r(600, 2000), 'eu-west': r(700, 3000),
    },
    monthlyBasic: {
      label: 'Monthly Package — Basic',
      unit: 'month',
      tooltip: 'Entry-level social media retainer. Typically 4–8 pieces of content per month.',
      'us-tier1': r(750, 1500),  'us-tier2': r(500, 1000), 'us-tier3': r(350, 750),
      'ca-tier1': r(600, 1200),  'ca-tier2': r(400, 800),  'ca-tier3': r(300, 620),
      'uk-tier1': r(500, 1000),  'uk-tier2': r(350, 700),  'eu-west': r(400, 900),
    },
    monthlyStandard: {
      label: 'Monthly Package — Standard',
      unit: 'month',
      tooltip: 'Mid-tier retainer. Typically 12–20 pieces per month plus strategy.',
      'us-tier1': r(1500, 3000), 'us-tier2': r(1000, 2500), 'us-tier3': r(750, 1500),
      'ca-tier1': r(1200, 2500), 'ca-tier2': r(800, 2000),  'ca-tier3': r(600, 1550),
      'uk-tier1': r(1000, 2200), 'uk-tier2': r(700, 1500),  'eu-west': r(800, 2000),
    },
    monthlyPremium: {
      label: 'Monthly Package — Premium',
      unit: 'month',
      tooltip: 'Full-service social media retainer. 25–40 pieces, strategy, reporting, and ad creative.',
      'us-tier1': r(3000, 7000), 'us-tier2': r(2000, 5000), 'us-tier3': r(1500, 3500),
      'ca-tier1': r(2500, 5500), 'ca-tier2': r(1800, 4000), 'ca-tier3': r(1350, 3100),
      'uk-tier1': r(2200, 5000), 'uk-tier2': r(1500, 3500), 'eu-west': r(1800, 4500),
    },
    ugcPerVideo: {
      label: 'UGC Asset (per video)',
      unit: 'video',
      tooltip: 'User-Generated Content style asset. Creator performs, films, and edits one native-feel video.',
      'us-tier1': r(150, 500), 'us-tier2': r(100, 350), 'us-tier3': r(75, 200),
      'ca-tier1': r(125, 400), 'ca-tier2': r(80, 275),  'ca-tier3': r(60, 213),
      'uk-tier1': r(100, 350), 'uk-tier2': r(60, 200),  'eu-west': r(80, 300),
    },
    brandCampaignProject: {
      label: 'Brand Campaign (project)',
      unit: 'project',
      tooltip: 'Full campaign package: strategy, content creation, paid ad assets, and reporting.',
      'us-tier1': r(2500, 15000), 'us-tier2': r(1500, 8000), 'us-tier3': r(1000, 5000),
      'ca-tier1': r(2000, 12000), 'ca-tier2': r(1200, 6500), 'ca-tier3': r(900, 5038),
      'uk-tier1': r(1800, 10000), 'uk-tier2': r(1000, 5500), 'eu-west': r(1500, 9000),
    },
  },

  // ─── POST-PRODUCTION ONLY ────────────────────────────────────
  postProduction: {
    videoEditingHourly: {
      label: 'Video Editing (per hour)',
      unit: 'hr',
      tooltip: 'Straight video editing: cuts, transitions, graphics, titles. Does not include color or audio.',
      'us-tier1': r(75, 150), 'us-tier2': r(40, 80),  'us-tier3': r(20, 50),
      'ca-tier1': r(60, 125), 'ca-tier2': r(35, 70),  'ca-tier3': r(26, 54),
      'uk-tier1': r(50, 100), 'uk-tier2': r(25, 65),  'eu-west': r(35, 90),
    },
    colorGradingHourly: {
      label: 'Color Grading (per hour)',
      unit: 'hr',
      tooltip: 'Professional color correction and grading. The process of adjusting the look and feel of footage.',
      'us-tier1': r(100, 200), 'us-tier2': r(60, 125), 'us-tier3': r(35, 75),
      'ca-tier1': r(80, 175),  'ca-tier2': r(50, 100), 'ca-tier3': r(38, 78),
      'uk-tier1': r(70, 150),  'uk-tier2': r(40, 85),  'eu-west': r(50, 125),
    },
    audioMixPerEp: {
      label: 'Audio Mix / Master (per episode)',
      unit: 'episode',
      tooltip: 'Audio mixing and mastering for a video or podcast episode. Includes levels, EQ, compression.',
      'us-tier1': r(200, 1000), 'us-tier2': r(100, 500), 'us-tier3': r(75, 300),
      'ca-tier1': r(175, 800),  'ca-tier2': r(80, 400),  'ca-tier3': r(60, 310),
      'uk-tier1': r(150, 700),  'uk-tier2': r(75, 350),  'eu-west': r(100, 600),
    },
    motionGraphicsHourly: {
      label: 'Motion Graphics (per hour)',
      unit: 'hr',
      tooltip: 'Animated graphics, titles, lower thirds, transitions, and visual effects.',
      'us-tier1': r(100, 200), 'us-tier2': r(65, 150), 'us-tier3': r(40, 100),
      'ca-tier1': r(80, 175),  'ca-tier2': r(55, 125), 'ca-tier3': r(41, 97),
      'uk-tier1': r(70, 150),  'uk-tier2': r(45, 100), 'eu-west': r(55, 130),
    },
    photoRetouchingPerImg: {
      label: 'Photo Retouching (per image)',
      unit: 'image',
      tooltip: 'Per-image retouching: skin, color, object removal. Complexity determines time.',
      'us-tier1': r(5, 50), 'us-tier2': r(3, 30), 'us-tier3': r(2, 20),
      'ca-tier1': r(4, 40), 'ca-tier2': r(3, 25), 'ca-tier3': r(2, 19),
      'uk-tier1': r(3, 35), 'uk-tier2': r(2, 20), 'eu-west': r(3, 30),
    },
    shortProject: {
      label: 'Short Project (social media)',
      unit: 'project',
      tooltip: 'Flat rate for a short post-production project, typically under 3 minutes.',
      'us-tier1': r(100, 500), 'us-tier2': r(75, 350), 'us-tier3': r(50, 200),
      'ca-tier1': r(80, 400),  'ca-tier2': r(60, 275), 'ca-tier3': r(45, 213),
      'uk-tier1': r(70, 350),  'uk-tier2': r(50, 200), 'eu-west': r(60, 300),
    },
    mediumProject: {
      label: 'Medium Project (corporate)',
      unit: 'project',
      tooltip: 'Flat rate for a medium-length post-production project, typically 3–10 minutes.',
      'us-tier1': r(500, 2500), 'us-tier2': r(350, 1500), 'us-tier3': r(200, 800),
      'ca-tier1': r(400, 2000), 'ca-tier2': r(275, 1200), 'ca-tier3': r(206, 930),
      'uk-tier1': r(350, 1800), 'uk-tier2': r(250, 1000), 'eu-west': r(300, 1500),
    },
    largeProject: {
      label: 'Large Project (commercial)',
      unit: 'project',
      tooltip: 'Flat rate for large post-production projects, typically 10+ minutes or complex deliverables.',
      'us-tier1': r(2500, 10000), 'us-tier2': r(1500, 5000), 'us-tier3': r(800, 3000),
      'ca-tier1': r(2000, 8000),  'ca-tier2': r(1200, 4000), 'ca-tier3': r(900, 3100),
      'uk-tier1': r(1800, 7000),  'uk-tier2': r(1000, 3500), 'eu-west': r(1500, 6000),
    },
  },

  // ─── CORPORATE EVENTS ────────────────────────────────────────
  corporate_events: {
    halfDayRate: { label: 'Half-Day Rate (4 hrs)', unit: 'half-day' },
    fullDayRate: { label: 'Full-Day Rate (8 hrs)', unit: 'day' },
    conferenceDay: { label: 'Conference Day Rate', unit: 'day' },
    executivePortraits: { label: 'Executive Portraits Session', unit: 'session' },
    tradeShowDay: { label: 'Trade Show Day Rate', unit: 'day' },
  },

  // ─── LIVE EVENTS ─────────────────────────────────────────────
  liveevents: {
    halfDayEvent: {
      label: 'Half-Day Event Coverage (4 hrs)',
      unit: 'session',
      tooltip: 'On-site coverage for live events: conferences, performances, corporate gatherings. Approximately 4 hours.',
      'us-tier1': r(600, 1800), 'us-tier2': r(400, 1200), 'us-tier3': r(300, 800),
      'ca-tier1': r(500, 1500), 'ca-tier2': r(350, 1000), 'ca-tier3': r(260, 780),
      'uk-tier1': r(400, 1200), 'uk-tier2': r(280, 800),  'eu-west': r(350, 1100),
    },
    fullDayEvent: {
      label: 'Full-Day Event Coverage (8 hrs)',
      unit: 'day',
      tooltip: 'Full-day on-site coverage. Includes setup, full event, and basic post-production.',
      'us-tier1': r(1200, 4000), 'us-tier2': r(800, 2500), 'us-tier3': r(500, 1500),
      'ca-tier1': r(1000, 3200), 'ca-tier2': r(700, 2000), 'ca-tier3': r(520, 1550),
      'uk-tier1': r(700, 2500),  'uk-tier2': r(500, 1500), 'eu-west': r(600, 2200),
    },
    multiDayEvent: {
      label: 'Multi-Day Event (per day)',
      unit: 'day',
      tooltip: 'Per-day rate for multi-day events such as festivals or conferences. Includes travel accommodation at actual cost.',
      'us-tier1': r(1000, 3500), 'us-tier2': r(700, 2200), 'us-tier3': r(450, 1400),
      'ca-tier1': r(850, 2800),  'ca-tier2': r(600, 1800), 'ca-tier3': r(450, 1760),
      'uk-tier1': r(600, 2200),  'uk-tier2': r(450, 1400), 'eu-west': r(550, 2000),
    },
    streamingSetup: {
      label: 'Live Stream Setup & Operation',
      unit: 'event',
      tooltip: 'Full live streaming service: encoder setup, multi-camera switching, broadcast to platform.',
      'us-tier1': r(800, 3000), 'us-tier2': r(500, 2000), 'us-tier3': r(300, 1200),
      'ca-tier1': r(700, 2500), 'ca-tier2': r(400, 1600), 'ca-tier3': r(300, 1240),
      'uk-tier1': r(500, 2000), 'uk-tier2': r(350, 1200), 'eu-west': r(400, 1800),
    },
    highlightEdit: {
      label: 'Event Highlight Reel (edit)',
      unit: 'project',
      tooltip: 'Post-production edit of a 2–5 minute highlight video from event footage.',
      'us-tier1': r(300, 1200), 'us-tier2': r(200, 800),  'us-tier3': r(150, 500),
      'ca-tier1': r(250, 1000), 'ca-tier2': r(175, 650),  'ca-tier3': r(131, 488),
      'uk-tier1': r(200, 800),  'uk-tier2': r(150, 500),  'eu-west': r(175, 700),
    },
    photographyEvent: {
      label: 'Event Photography (per hour)',
      unit: 'hr',
      tooltip: 'On-site event photography rate. Includes one set of selects delivered within 48 hours.',
      'us-tier1': r(150, 500), 'us-tier2': r(100, 300), 'us-tier3': r(75, 200),
      'ca-tier1': r(125, 400), 'ca-tier2': r(80, 250),  'ca-tier3': r(60, 243),
      'uk-tier1': r(100, 350), 'uk-tier2': r(75, 200),  'eu-west': r(80, 275),
    },
  },
};

// ─── SERVICE DEFINITIONS ───────────────────────────────────────
export const SERVICES = {
  video: {
    id: 'video',
    name: 'Video Production',
    icon: '🎬',
    color: 'from-gold-500 to-gold-700',
    accent: '#d4a941',
    subtypes: ['Corporate', 'Wedding', 'Event', 'Music Video', 'Documentary', 'Social Media Content', 'Podcast (Video)', 'Podcast (Audio Only)'],
    description: 'Corporate, wedding, event, music video, documentary, podcast',
    primaryRates: ['hourlyShoot', 'halfDay', 'fullDay', 'editHourly'],
    packageRates: ['weddingPackage', 'corporateProject', 'musicVideoProject'],
  },
  photography: {
    id: 'photography',
    name: 'Photography',
    icon: '📷',
    color: 'from-gold-400 to-gold-700',
    accent: '#c99a2e',
    subtypes: ['Event', 'Commercial', 'Portraits', 'Headshots', 'Real Estate', 'Product'],
    description: 'Real estate, commercial, portraits, product, events',
    primaryRates: ['hourlyEvent', 'dayRateCommercial', 'editHourly'],
    packageRates: ['weddingPackage', 'headshotsSession', 'realEstatePerListing', 'productPerImage'],
  },
  drone: {
    id: 'drone',
    name: 'Video Production · Drone & Aerial Video',
    icon: '🚁',
    color: 'from-gold-500 to-charcoal-800',
    accent: '#d4a941',
    subtypes: ['Real Estate', 'Event', 'Commercial', 'Mapping/Survey', 'Film/TV'],
    description: 'FAA Part 107 aerial video, real estate, commercial, and film work',
    primaryRates: ['hourlyPhoto', 'hourlyVideo', 'editingHourly'],
    packageRates: ['halfDay', 'fullDay', 'realEstatePerProperty', 'mappingPerAcre'],
  },
  social: {
    id: 'social',
    name: 'Video Production · Short-Form & Social',
    icon: '📱',
    color: 'from-gold-400 to-charcoal-900',
    accent: '#c99a2e',
    subtypes: ['Reels/TikTok', 'YouTube', 'UGC', 'Brand Campaign', 'Monthly Package'],
    description: 'Short-form video, UGC, brand campaigns, monthly content',
    primaryRates: ['singleReelTikTok', 'ugcPerVideo'],
    packageRates: ['contentDay', 'monthlyBasic', 'monthlyStandard', 'monthlyPremium', 'brandCampaignProject'],
  },
  postProduction: {
    id: 'postProduction',
    name: 'Post Production',
    icon: '🎛️',
    color: 'from-gold-600 to-charcoal-900',
    accent: '#b88622',
    subtypes: ['Video Editing', 'Color Grading', 'Audio Mix/Master', 'Motion Graphics', 'Photo Retouching'],
    description: 'Video editing, color, audio, motion graphics, retouching',
    primaryRates: ['videoEditingHourly', 'colorGradingHourly', 'audioMixPerEp', 'motionGraphicsHourly', 'photoRetouchingPerImg'],
    packageRates: ['shortProject', 'mediumProject', 'largeProject'],
  },
  liveevents: {
    id: 'liveevents',
    name: 'Video Production · Event & Conference Video',
    icon: '🎪',
    color: 'from-gold-500 to-charcoal-950',
    accent: '#d4a941',
    subtypes: ['Conference', 'Concert / Performance', 'Corporate Event', 'Festival', 'Sports', 'Gala / Awards'],
    description: 'Conferences, concerts, festivals, multi-day events, live streaming',
    primaryRates: ['halfDayEvent', 'fullDayEvent', 'photographyEvent'],
    packageRates: ['multiDayEvent', 'streamingSetup', 'highlightEdit'],
  },
  corporate_events: {
    id: 'corporate_events',
    name: 'Video Production · Corporate & Internal Video',
    icon: '🏢',
    color: 'from-gold-400 to-gold-800',
    accent: '#c99a2e',
    subtypes: ['Conference Coverage', 'Product Launch', 'Award Ceremony', 'Trade Show', 'Company Retreat', 'Executive Portraits at Events', 'Investor Presentation', 'Town Hall / All-Hands', 'Other'],
    description: 'Conference coverage, product launches, award ceremonies, trade shows, and executive events',
    primaryRates: ['halfDayRate', 'fullDayRate', 'conferenceDay'],
    packageRates: ['executivePortraits', 'tradeShowDay'],
  },
  podcast: {
    id: 'podcast',
    name: 'Post Production · Podcast Audio Editing',
    icon: '🎙️',
    color: 'from-gold-300 to-charcoal-900',
    accent: '#d4a941',
    subtypes: ['Audio Only', 'Video Podcast', 'Remote Recording', 'In-Studio Recording', 'Show Launch Package', 'Monthly Retainer', 'Other'],
    description: 'Audio and video podcast production, remote and in-studio recording, show launches',
    primaryRates: ['episodeEdit', 'fullProductionPerEp', 'remoteRecordingPerEp'],
    packageRates: ['monthlyRetainer4Eps', 'showLaunchPackage'],
  },
};

export const SERVICE_TYPE_OPTIONS = ['Video Production', 'Photography', 'Post Production'];

export const MARKETPLACE_CATEGORIES = [
  {
    id: 'all',
    name: 'All Services',
    icon: '✦',
    description: 'Browse all verified production talent',
    serviceIds: Object.keys(SERVICES),
  },
  {
    id: 'video',
    name: 'Video Production',
    icon: '🎬',
    description: 'Brand films, events, drone, social, corporate, documentary, campaign work',
    serviceIds: ['video', 'drone', 'social', 'liveevents', 'corporate_events'],
  },
  {
    id: 'photo',
    name: 'Photography',
    icon: '📷',
    description: 'Commercial, event, product, real estate, portraits',
    serviceIds: ['photography'],
  },
  {
    id: 'post',
    name: 'Post Production',
    icon: '🎛️',
    description: 'Editing, color, sound, motion graphics, podcast audio, retouching',
    serviceIds: ['postProduction', 'podcast'],
  },
];

const MARKETPLACE_CATEGORY_ALIASES = {
  photography: 'photo',
  post_production: 'post',
  postProduction: 'post',
  editing: 'post',
  podcast: 'post',
  aerial: 'video',
  drone: 'video',
  events: 'video',
  event: 'video',
  corporate: 'video',
  corporate_events: 'video',
  brand_content: 'video',
  social: 'video',
};

export function getMarketplaceCategory(categoryId) {
  const resolvedId = MARKETPLACE_CATEGORY_ALIASES[categoryId] || categoryId;
  return MARKETPLACE_CATEGORIES.find(category => category.id === resolvedId) || MARKETPLACE_CATEGORIES[0];
}

export function getMarketplaceServiceIds(categoryId) {
  return getMarketplaceCategory(categoryId).serviceIds || Object.keys(SERVICES);
}

export function serviceMatchesMarketplaceCategory(serviceId, categoryId) {
  return getMarketplaceServiceIds(categoryId).includes(serviceId);
}

const SERVICE_ID_ALIASES = {
  video: 'video',
  video_production: 'video',
  videoproduction: 'video',
  'Video Production': 'video',
  photography: 'photography',
  photo: 'photography',
  Photography: 'photography',
  drone: 'drone',
  drone_aerial: 'drone',
  droneaerial: 'drone',
  'Drone/Aerial': 'drone',
  'Drone / Aerial': 'drone',
  'Drone and Aerial': 'drone',
  'Drone & Aerial Video': 'drone',
  'Drone and Aerial Video': 'drone',
  social: 'social',
  socialmedia: 'social',
  social_media: 'social',
  socialmediacontent: 'social',
  'Social Media Content': 'social',
  'Brand & Short-Form Content': 'social',
  'Brand and Short-Form Content': 'social',
  'Short-Form & Social': 'social',
  'Short-Form and Social': 'social',
  brandcontent: 'social',
  brandshortformcontent: 'social',
  post: 'postProduction',
  post_production: 'postProduction',
  postproduction: 'postProduction',
  'Post-Production': 'postProduction',
  'Editing & Post': 'postProduction',
  'Editing and Post': 'postProduction',
  editingpost: 'postProduction',
  'Post Production': 'postProduction',
  liveevents: 'liveevents',
  live_events: 'liveevents',
  liveeventcoverage: 'liveevents',
  'Live Event Coverage': 'liveevents',
  'Live Events': 'liveevents',
  'Event & Conference Video': 'liveevents',
  'Event and Conference Video': 'liveevents',
  eventscorporate: 'liveevents',
  'Events & Corporate': 'liveevents',
  corporate_events: 'corporate_events',
  corporateevents: 'corporate_events',
  'Corporate Events': 'corporate_events',
  'Corporate & Internal Video': 'corporate_events',
  'Corporate and Internal Video': 'corporate_events',
  podcast: 'podcast',
  podcastproduction: 'podcast',
  'Podcast Production': 'podcast',
  'Podcast Audio Editing': 'podcast',
};

export function normalizeServiceId(value) {
  if (!value) return null;
  if (SERVICES[value]) return value;
  if (SERVICE_ID_ALIASES[value]) return SERVICE_ID_ALIASES[value];
  const compact = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  return SERVICE_ID_ALIASES[compact] || null;
}

// ─── PACKAGE TIER DEFINITIONS ──────────────────────────────────
export const PACKAGE_TIERS = {
  video: {
    basic: {
      name: 'Basic',
      description: 'Straightforward shoot and edit',
      items: [
        { rateKey: 'hourlyShoot', quantity: 4, label: 'On-Site Shoot' },
        { rateKey: 'editHourly', quantity: 4, label: 'Video Editing' },
      ],
      includes: ['4 hrs on-site', '4 hrs editing', '1 deliverable', '1 revision'],
    },
    standard: {
      name: 'Standard',
      description: 'Full shoot day with polished edit',
      items: [
        { rateKey: 'hourlyShoot', quantity: 8, label: 'On-Site Shoot' },
        { rateKey: 'editHourly', quantity: 10, label: 'Video Editing' },
        { rateKey: 'equipmentHourly', quantity: 8, label: 'Equipment Fee' },
      ],
      includes: ['8 hrs on-site', '10 hrs editing', 'Equipment package', '2 deliverables', '2 revisions'],
    },
    premium: {
      name: 'Premium',
      description: 'Complete production package',
      items: [
        { rateKey: 'hourlyShoot', quantity: 10, label: 'On-Site Shoot' },
        { rateKey: 'editHourly', quantity: 20, label: 'Video Editing' },
        { rateKey: 'equipmentHourly', quantity: 10, label: 'Equipment Fee' },
      ],
      includes: ['Full day on-site', '20 hrs editing', 'Full equipment package', '5 deliverables', '3 revisions', 'Color grading included'],
    },
  },
  photography: {
    basic: {
      name: 'Basic',
      description: 'Quick shoot session',
      items: [
        { rateKey: 'hourlyEvent', quantity: 2, label: 'Shoot Time' },
        { rateKey: 'editHourly', quantity: 2, label: 'Photo Editing' },
      ],
      includes: ['2 hr shoot', '10–15 final images', '1 revision round'],
    },
    standard: {
      name: 'Standard',
      description: 'Half-day with full edit',
      items: [
        { rateKey: 'hourlyEvent', quantity: 4, label: 'Shoot Time' },
        { rateKey: 'editHourly', quantity: 5, label: 'Photo Editing' },
      ],
      includes: ['4 hr shoot', '30–50 final images', 'Location scouting', '2 revision rounds'],
    },
    premium: {
      name: 'Premium',
      description: 'Full day commercial package',
      items: [
        { rateKey: 'dayRateCommercial', quantity: 1, label: 'Full Day Rate' },
        { rateKey: 'editHourly', quantity: 10, label: 'Photo Editing' },
      ],
      includes: ['Full day shoot', '100+ final images', 'Styling assistance', 'Commercial license', '3 revision rounds'],
    },
  },
  podcast: {
    basic: {
      name: 'Basic',
      description: 'Edit-only service',
      items: [
        { rateKey: 'basicEditPerEp', quantity: 1, label: 'Episode Edit' },
      ],
      includes: ['Audio editing', 'Noise reduction', 'Basic leveling', 'MP3 export'],
    },
    standard: {
      name: 'Standard',
      description: 'Full episode production',
      items: [
        { rateKey: 'fullProductionPerEp', quantity: 1, label: 'Full Production' },
      ],
      includes: ['Recording support', 'Full edit + master', 'Show notes', 'Social clips', '2 revisions'],
    },
    premium: {
      name: 'Premium',
      description: 'Monthly retainer (4 eps)',
      items: [
        { rateKey: 'monthlyRetainer4Eps', quantity: 1, label: 'Monthly Retainer' },
      ],
      includes: ['4 episodes/month', 'Full production', 'Show notes + clips', 'Priority turnaround', 'Analytics review'],
    },
  },
  drone: {
    basic: {
      name: 'Basic',
      description: 'Hourly aerial session',
      items: [
        { rateKey: 'hourlyVideo', quantity: 2, label: 'Drone Video' },
        { rateKey: 'editingHourly', quantity: 2, label: 'Editing' },
      ],
      includes: ['2 hr flight time', 'Basic edit', '1 deliverable'],
    },
    standard: {
      name: 'Standard',
      description: 'Half-day deployment',
      items: [
        { rateKey: 'halfDay', quantity: 1, label: 'Half-Day Rate' },
        { rateKey: 'editingHourly', quantity: 4, label: 'Editing' },
      ],
      includes: ['Half-day on-site', 'Color graded edit', 'Photo + Video', '2 deliverables'],
    },
    premium: {
      name: 'Premium',
      description: 'Full-day package',
      items: [
        { rateKey: 'fullDay', quantity: 1, label: 'Full Day Rate' },
        { rateKey: 'editingHourly', quantity: 8, label: 'Editing' },
      ],
      includes: ['Full day on-site', 'Full edit suite', 'Cinematic grading', 'Multiple deliverables', 'FAA waiver handling'],
    },
  },
  social: {
    basic: {
      name: 'Basic',
      description: 'Content creation day',
      items: [
        { rateKey: 'singleReelTikTok', quantity: 4, label: 'Short-Form Videos' },
      ],
      includes: ['4 short-form videos', 'Basic captions', '1 revision round'],
    },
    standard: {
      name: 'Standard',
      description: 'Monthly content package',
      items: [
        { rateKey: 'monthlyStandard', quantity: 1, label: 'Monthly Standard' },
      ],
      includes: ['12–20 pieces/month', 'Content calendar', 'Captions + hashtags', 'Monthly report'],
    },
    premium: {
      name: 'Premium',
      description: 'Full brand campaign',
      items: [
        { rateKey: 'monthlyPremium', quantity: 1, label: 'Monthly Premium' },
      ],
      includes: ['25–40 pieces/month', 'Strategy + planning', 'Ad creative', 'Analytics + reporting', 'Priority support'],
    },
  },
  postProduction: {
    basic: {
      name: 'Basic',
      description: 'Short-form project',
      items: [
        { rateKey: 'shortProject', quantity: 1, label: 'Short Project' },
      ],
      includes: ['Up to 3 min video', 'Basic edit + audio', '1 revision'],
    },
    standard: {
      name: 'Standard',
      description: 'Corporate-length project',
      items: [
        { rateKey: 'mediumProject', quantity: 1, label: 'Medium Project' },
        { rateKey: 'colorGradingHourly', quantity: 3, label: 'Color Grade' },
      ],
      includes: ['Up to 10 min video', 'Full edit + color', 'Audio mastering', '2 revisions'],
    },
    premium: {
      name: 'Premium',
      description: 'Commercial-level production',
      items: [
        { rateKey: 'largeProject', quantity: 1, label: 'Large Project' },
        { rateKey: 'colorGradingHourly', quantity: 6, label: 'Color Grade' },
        { rateKey: 'motionGraphicsHourly', quantity: 4, label: 'Motion Graphics' },
      ],
      includes: ['10+ min video', 'Full edit + color', 'Motion graphics', 'Audio mix/master', '3 revisions'],
    },
  },
};

// ─── LICENSING MULTIPLIERS ─────────────────────────────────────
export const LICENSING_OPTIONS = [
  { id: 'personal',    label: 'Personal Use',      multiplier: 1.0, description: 'Non-commercial, private use only' },
  { id: 'social',      label: 'Social Media',       multiplier: 1.3, description: 'Organic social posts, no paid promotion' },
  { id: 'commercial',  label: 'Commercial License', multiplier: 1.75, description: 'Advertising, marketing, business use' },
  { id: 'broadcast',   label: 'Broadcast / TV',     multiplier: 2.5, description: 'Television, streaming platforms, wide distribution' },
  { id: 'buyout',      label: 'Full Buyout',        multiplier: 3.0, description: 'All rights, unlimited use, perpetual license' },
];

// ─── TURNAROUND OPTIONS ────────────────────────────────────────
export const TURNAROUND_OPTIONS = [
  { id: 'standard',  label: 'Standard',   days: '7–14 days',   multiplier: 0,    description: 'Normal production schedule' },
  { id: 'rush',      label: 'Rush',       days: '3–6 days',    multiplier: 0.25, description: '+25% of subtotal' },
  { id: 'same-day',  label: 'Same Day',   days: '24 hours',    multiplier: 0.50, description: '+50% of subtotal' },
  { id: 'custom',    label: 'Custom',     days: 'Negotiate',   multiplier: null, description: 'Set your own rush percentage' },
];
