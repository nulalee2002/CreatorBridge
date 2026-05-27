// ── Demo creator seed data ────────────────────────────────────────
//
// Toggle this to false to hide demo creators from the directory.
// CreatorDirectory checks this before loading seed data.
export const SHOW_DEMO_CREATORS = true;

// Bump this number whenever SEED_CREATORS changes.
// initSeedData() compares against localStorage 'creator-seed-version'
// and forces a full re-write when the version is out of date.
// This is what guarantees the profile-page "Creator not found" bug
// cannot happen from stale localStorage.
const SEED_VERSION = 9;

// ── Three demo creators: filmmaker, photographer, podcast producer ─
export const SEED_CREATORS = [

  // ── 1. Filmmaker / Videographer ───────────────────────────────
  {
    id: 'seed-1',
    user_id: null,
    name: 'Marcus Chen',
    businessName: 'Elevation Films',
    avatar: '/images/creatorbridge/handoff/photo-1531746020798-e6953c6e8e04.png',
    cover: '/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png',
    primary_pillar: 'video_production',
    sub_niches: ['vp_brand_films', 'vp_documentary', 'vp_drone_video'],
    bio: 'Award-winning cinematographer and director with 12 years producing brand films, corporate stories, and documentary content for Fortune 500 clients. RED and ARRI certified. Available for single-day shoots, full campaigns, and long-term production partnerships.',
    experience: 'senior',
    yearsExperience: 12,
    availability: 'available',
    verified: true,
    verification_status: 'pro_verified',
    tier: 'signature',
    completed_projects: 87,
    completion_rate: 98,
    rating: 4.9,
    reviewCount: 87,
    plan: 'pro',
    tags: ['Brand Films & Commercials', 'Documentary & Interviews', 'Drone & Aerial Video'],
    location: {
      city: 'Los Angeles',
      state: 'CA',
      country: 'US',
      zip: '90028',
      regionKey: 'us-tier1',
    },
    contact: {
      email: 'marcus@elevationfilms.co',
      phone: '(323) 555-0247',
      website: 'elevationfilms.co',
      instagram: '@elevationfilms',
    },
    services: [
      {
        serviceId: 'video',
        subtypes: ['Corporate', 'Documentary', 'Music Video', 'Social Media Content'],
        description: 'Full-service video production from concept to final cut. Pre-production planning, on-site direction, and post-production all included. I bring a full grip package and work with a trusted crew of 2-4 depending on scope.',
        rates: {
          hourlyShoot:      350,
          halfDay:         1400,
          fullDay:         2800,
          corporateProject: 8500,
          musicVideoProject: 6000,
          editHourly:       125,
        },
      },
      {
        serviceId: 'photography',
        description: 'Commercial and editorial photography for brands, events, and corporate clients.',
        rates: {
          halfDayRate: 800,
          fullDayRate: 1500,
          eventRate: 600,
        },
      },
      {
        serviceId: 'drone',
        description: 'FAA Part 107 certified aerial cinematography for real estate, events, and film.',
        rates: {
          halfDayAerial: 600,
          fullDayAerial: 1100,
          realEstatePackage: 350,
        },
      },
    ],
    portfolio: [
      {
        title: 'Nike Brand Film — "Rise Every Day"',
        description: '3-day shoot across 5 LA locations. Brand story campaign used across broadcast and digital. Directed, DP\'d, and edited in-house.',
        serviceId: 'video',
        link: 'https://vimeo.com',
      },
      {
        title: 'Salesforce Annual Keynote Film',
        description: 'Corporate documentary showcasing customer impact stories. Screened at Dreamforce to 40,000 attendees.',
        serviceId: 'video',
        link: 'https://vimeo.com',
      },
      {
        title: 'TechCorp Culture Documentary',
        description: '18-minute internal documentary on company culture. Used for recruiting and investor relations.',
        serviceId: 'video',
      },
    ],
    packages: [
      {
        name: 'Basic',
        serviceId: 'video',
        price: 2800,
        description: 'Perfect for single-location shoots and social media content.',
        deliverables: [
          'Full-day shoot (8 hrs)',
          'Up to 3 finished video edits',
          '1-minute hero cut + 2 social cuts (30s, 15s)',
          'Licensed background music',
          'Subtitles and captions',
        ],
        turnaround_days: 7,
        revisions: 2,
      },
      {
        name: 'Standard',
        serviceId: 'video',
        price: 6500,
        description: 'Multi-day production for brand films and corporate content.',
        deliverables: [
          '2-day full shoot',
          'Full pre-production planning call',
          '1 hero edit (2–4 min) + 3 cut-downs',
          'Color grade and audio mix',
          'Drone footage (if location permits)',
          'Licensed music from premium library',
          'Subtitles and 2 social aspect ratios',
        ],
        turnaround_days: 14,
        revisions: 3,
      },
      {
        name: 'Premium',
        serviceId: 'video',
        price: 12000,
        description: 'Full campaign production — concept to delivery.',
        deliverables: [
          '3-day production (locations, crew, lighting)',
          'Creative concept development and script',
          '1 flagship film (3–5 min)',
          '6 social cuts optimized per platform',
          'Full color grade (DaVinci Resolve)',
          'Professional audio mix and master',
          'Motion graphics and titles',
          'Two rounds of client revisions',
          'Final delivery in all formats',
        ],
        turnaround_days: 21,
        revisions: 5,
      },
    ],
  },

  // ── 2. Photographer ──────────────────────────────────────────
  {
    id: 'seed-2',
    user_id: null,
    name: 'Aria Vasquez',
    businessName: 'Aria Visual Studio',
    avatar: '/images/creatorbridge/handoff/photo-1494790108377-be9c29b29330.png',
    cover: '/images/creatorbridge/handoff/photo-1542038784456-1ea8e935640e.png',
    primary_pillar: 'photography',
    sub_niches: ['ph_brand_commercial', 'ph_real_estate', 'ph_lifestyle_fashion'],
    bio: 'Commercial and portrait photographer with a bold, editorial aesthetic. Featured in Vogue Business, Harper\'s Bazaar, and Architectural Digest. I specialize in luxury real estate, fashion campaigns, and executive portraits. Every image is delivered fully retouched, color-graded, and ready for print or digital.',
    experience: 'senior',
    yearsExperience: 9,
    availability: 'available',
    verified: true,
    verification_status: 'verified',
    tier: 'elite',
    completed_projects: 64,
    completion_rate: 95,
    rating: 4.9,
    reviewCount: 64,
    plan: 'studio',
    tags: ['Brand & Commercial Photography', 'Real Estate Photography', 'Lifestyle & Fashion'],
    location: {
      city: 'Miami',
      state: 'FL',
      country: 'US',
      zip: '33101',
      regionKey: 'us-tier1',
    },
    contact: {
      email: 'aria@ariavisual.com',
      phone: '(305) 555-0182',
      website: 'ariavisual.com',
      instagram: '@ariavisualstudio',
    },
    services: [
      {
        serviceId: 'photography',
        subtypes: ['Commercial', 'Real Estate', 'Portraits', 'Headshots', 'Product', 'Editorial'],
        description: 'Editorial-quality photography for brands, real estate developers, and executives. All packages include full RAW processing, retouching, and delivery via private online gallery. Studio in Wynwood or on-location throughout South Florida.',
        rates: {
          hourlyEvent:         400,
          dayRateCommercial:  3500,
          realEstatePerListing: 400,
          headshotsSession:    800,
          productPerImage:     120,
        },
      },
      {
        serviceId: 'video',
        description: 'Brand films, corporate videos, and social media content for businesses.',
        rates: {
          halfDayShoot: 1200,
          fullDayShoot: 2200,
          socialMediaPackage: 800,
        },
      },
      {
        serviceId: 'drone',
        description: 'Aerial photography for real estate listings and commercial properties.',
        rates: {
          realEstateAerial: 400,
          commercialAerial: 700,
        },
      },
    ],
    portfolio: [
      {
        title: 'South Beach Luxury Condos — Brickell',
        description: 'Marketing photography package for a 40-unit luxury waterfront development. 200+ final images delivered for print, OOH, and digital advertising.',
        serviceId: 'photography',
        link: 'https://instagram.com',
      },
      {
        title: 'Zara Spring Campaign — South Florida',
        description: 'Spring/summer lookbook shoot at Art Basel locations. 220 final images, licensing included for 12-month North America digital use.',
        serviceId: 'photography',
        link: 'https://instagram.com',
      },
      {
        title: 'C-Suite Portrait Series — Fortune 500',
        description: 'Executive portrait series for a financial services firm. 12 subjects across 2 days, used across annual report, LinkedIn, and press materials.',
        serviceId: 'photography',
      },
    ],
    packages: [
      {
        name: 'Basic',
        serviceId: 'photography',
        price: 1200,
        description: 'Ideal for headshots, small product shoots, and social content.',
        deliverables: [
          '2-hour studio session',
          '20 fully retouched final images',
          'Private online gallery',
          'Commercial usage license (digital)',
          '48-hour delivery',
        ],
        turnaround_days: 2,
        revisions: 1,
      },
      {
        name: 'Standard',
        serviceId: 'photography',
        price: 3800,
        description: 'Half-day commercial shoot for brands and real estate.',
        deliverables: [
          'Half-day shoot (4 hrs, studio or location)',
          '60 fully retouched final images',
          'Art direction and shot list planning',
          'Commercial license (print + digital, 12 months)',
          'Private gallery within 5 business days',
          'Two background/color variants per hero image',
        ],
        turnaround_days: 5,
        revisions: 2,
      },
      {
        name: 'Premium',
        serviceId: 'photography',
        price: 7500,
        description: 'Full-day campaign production with unlimited usage licensing.',
        deliverables: [
          'Full-day shoot (8 hrs, any location)',
          '150+ fully retouched final images',
          'Full creative direction and mood board',
          'Hair/makeup coordination',
          'Unlimited commercial license (worldwide)',
          'Priority 3-day turnaround',
          'Print-ready files + web-optimized exports',
        ],
        turnaround_days: 3,
        revisions: 3,
      },
    ],
  },

  // ── 3. Podcast Producer ──────────────────────────────────────
  {
    id: 'seed-3',
    user_id: null,
    name: 'Jordan Mitchell',
    businessName: 'SoundWave Podcast Co.',
    avatar: '/images/creatorbridge/handoff/photo-1507003211169-0a1dd7228f2d.png',
    cover: '/images/creatorbridge/handoff/photo-1590602847861-f357a9332bbc.png',
    primary_pillar: 'post_production',
    sub_niches: ['pp_podcast_audio', 'pp_sound_design', 'pp_short_form_edit'],
    bio: 'Full-service podcast production studio in NYC. We\'ve launched over 200 shows from scratch and taken dozens of existing podcasts from hobbyist recordings to top-charting. Our team handles recording, editing, mastering, show notes, and distribution setup — you just show up and talk.',
    experience: 'senior',
    yearsExperience: 8,
    availability: 'available',
    verified: true,
    verification_status: 'verified',
    tier: 'proven',
    completed_projects: 53,
    completion_rate: 92,
    rating: 4.8,
    reviewCount: 53,
    plan: 'pro',
    tags: ['Podcast Audio Editing', 'Sound Design & Mixing', 'Short-Form Editing'],
    location: {
      city: 'New York',
      state: 'NY',
      country: 'US',
      zip: '10001',
      regionKey: 'us-tier1',
    },
    contact: {
      email: 'studio@soundwavepod.com',
      phone: '(212) 555-0319',
      website: 'soundwavepod.com',
      instagram: '@soundwavepodco',
    },
    services: [
      {
        serviceId: 'video',
        subtypes: ['Audio Only', 'Video Podcast', 'In-Studio Recording', 'Remote Recording', 'Show Launch'],
        description: 'End-to-end podcast production. In-studio recording at our Midtown NYC facility, or remote recording support via Riverside.fm or SquadCast. Editing, mastering, show notes, transcription, and social audio clips all included depending on tier.',
        rates: {
          basicEditPerEp:        300,
          fullProductionPerEp:  1400,
          monthlyRetainer4Eps:  4200,
          recordingSession:      500,
          showNotesClipsPerEp:   125,
        },
      },
      {
        serviceId: 'video',
        description: 'Video podcast production including recording, editing, and YouTube optimization.',
        rates: {
          episodeEdit: 300,
          fullProductionPerEp: 1400,
          monthlyRetainer4Eps: 4200,
        },
      },
      {
        serviceId: 'social',
        description: 'Audiogram clips, social media cuts, and podcast promotional content.',
        rates: {
          audiogramPerEp: 150,
          socialPackage5Clips: 600,
          monthlyContent: 1200,
        },
      },
    ],
    portfolio: [
      {
        title: 'The Growth Playbook — Top 50 Business Podcast',
        description: 'Full production partnership since launch. 180+ episodes, currently ranked #34 in Business on Apple Podcasts. We handle everything post-record.',
        serviceId: 'video',
        link: 'https://podcasts.apple.com',
      },
      {
        title: 'Culture Shift — Video Podcast',
        description: 'Weekly video podcast with 500K+ monthly downloads across YouTube and audio platforms. Studio recording in Midtown with full video edit and chapter markers.',
        serviceId: 'video',
        link: 'https://youtube.com',
      },
      {
        title: 'The Founder Files — Launch Package',
        description: 'Took a founder from zero to launched in 6 weeks. Trailer, first 5 episodes, Spotify/Apple distribution setup, and PR pitch kit.',
        serviceId: 'video',
      },
    ],
    packages: [
      {
        name: 'Basic',
        serviceId: 'video',
        price: 350,
        description: 'Per-episode editing for established shows. You record, we polish.',
        deliverables: [
          'Audio editing and noise removal',
          'Levels normalization and mastering',
          'Intro/outro insertion',
          'ID3 tags and metadata',
          'MP3 delivery (podcast-ready)',
        ],
        turnaround_days: 3,
        revisions: 1,
      },
      {
        name: 'Standard',
        serviceId: 'video',
        price: 1500,
        description: 'Per-episode full production. Remote or in-studio recording included.',
        deliverables: [
          'Remote recording session (Riverside.fm)',
          'Full audio edit and mastering',
          'Intro/outro + ad break insertion',
          'Show notes (300–500 words)',
          'Transcript (AI-assisted, proofed)',
          '3 audiogram social clips',
          'Chapter markers (Spotify)',
        ],
        turnaround_days: 5,
        revisions: 2,
      },
      {
        name: 'Premium',
        serviceId: 'video',
        price: 4500,
        description: 'Monthly retainer for 4 episodes. Best value for weekly shows.',
        deliverables: [
          '4 episodes per month (full production)',
          'In-studio recording (NYC) or remote',
          'Full audio + video edit (if video podcast)',
          'YouTube upload and thumbnail',
          'Show notes, transcript, and chapters',
          'Social clips (5 per episode)',
          'Monthly analytics review call',
          'Guest coordination support',
        ],
        turnaround_days: 5,
        revisions: 3,
      },
    ],
  },

  // ── 4. David Park — Video Production, LA ───────────────────────
  {
    id: 'seed-4', user_id: null,
    name: 'David Park', businessName: 'LensCraft Studios',
    avatar: '/images/creatorbridge/handoff/photo-1438761681033-6461ffad8d80.png',
    cover: '/images/creatorbridge/handoff/photo-1485846234645-a62644f84728.png',
    primary_pillar: 'video_production',
    sub_niches: ['vp_brand_films', 'vp_music_video', 'vp_corporate_video'],
    bio: 'Cinematic brand films. RED-certified cinematography with a small crew.',
    experience: 'mid', yearsExperience: 5,
    availability: 'within_2_weeks',
    verified: true, verification_status: 'verified',
    tier: 'elite',
    rating: 5.0, reviewCount: 31, plan: 'pro',
    tags: ['Brand Films & Commercials', 'Music Videos', 'Corporate & Internal Video'],
    location: { city: 'Los Angeles', state: 'CA', country: 'US', regionKey: 'us-tier1' },
    services: [{ serviceId: 'video', rates: { fullDay: 2500 } }],
  },

  // ── 5. Mateo Reyes — Drone & Aerial Video, Austin ──────────────
  {
    id: 'seed-5', user_id: null,
    name: 'Mateo Reyes', businessName: 'Skyframe Aerial',
    avatar: '/images/creatorbridge/handoff/photo-1500648767791-00dcc994a43e.png',
    cover: '/images/creatorbridge/handoff/photo-1506947411487-a56738267384.png',
    primary_pillar: 'video_production',
    sub_niches: ['vp_drone_video', 'vp_real_estate_video'],
    bio: 'Part 107 certified. Aerial cinematography for real estate, hospitality, brand.',
    experience: 'mid', yearsExperience: 4,
    availability: 'available',
    verified: true, verification_status: 'verified',
    tier: 'verified',
    rating: 4.7, reviewCount: 22, plan: 'pro',
    tags: ['Drone & Aerial Video', 'Real Estate Video'],
    location: { city: 'Austin', state: 'TX', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'video', rates: { fullDay: 650 } }],
  },

  // ── 6. Maya Chen — Short-form Social, Chicago ──────────────────
  {
    id: 'seed-6', user_id: null,
    name: 'Maya Chen', businessName: 'Bondi Studio',
    avatar: '/images/creatorbridge/handoff/photo-1573497019940-1c28c88b4f3e.png',
    cover: '/images/creatorbridge/handoff/photo-1516035069371-29a1b244cc32.png',
    primary_pillar: 'video_production',
    sub_niches: ['vp_short_form', 'vp_brand_films'],
    bio: 'Monthly social-first video for boutique brands. Reels, UGC, short-form ads.',
    experience: 'mid', yearsExperience: 6,
    availability: 'within_2_weeks',
    verified: true, verification_status: 'verified',
    tier: 'verified',
    rating: 4.8, reviewCount: 48, plan: 'pro',
    tags: ['Short-Form & Social (Reels/TikTok/UGC)', 'Brand Films & Commercials'],
    location: { city: 'Chicago', state: 'IL', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'video', rates: { fullDay: 1200 } }],
  },

  // ── 7. Aaron Wei — Color Grading, Seattle ──────────────────────
  {
    id: 'seed-7', user_id: null,
    name: 'Aaron Wei', businessName: 'Northgrade Color',
    avatar: '/images/creatorbridge/handoff/photo-1463453091185-61582044d556.png',
    cover: '/images/creatorbridge/handoff/photo-1574717024653-61fd2cf4d44d.png',
    primary_pillar: 'post_production',
    sub_niches: ['pp_color_grading', 'pp_video_editing_long'],
    bio: 'DaVinci-certified colorist. Editorial commercials and music videos.',
    experience: 'senior', yearsExperience: 8,
    availability: 'within_4_weeks',
    verified: true, verification_status: 'verified',
    tier: 'elite',
    rating: 4.9, reviewCount: 41, plan: 'pro',
    tags: ['Color Grading', 'Video Editing (Long-Form)'],
    location: { city: 'Seattle', state: 'WA', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'post-production', rates: { editHourly: 95, fullDay: 400 } }],
  },

  // ── 8. Naomi Greene — Brand films, Brooklyn ────────────────────
  {
    id: 'seed-8', user_id: null,
    name: 'Naomi Greene', businessName: 'Greene Street Films',
    avatar: '/images/creatorbridge/handoff/photo-1531746020798-e6953c6e8e04.png',
    cover: '/images/creatorbridge/handoff/photo-1492691527719-9d1e07e534b4.png',
    primary_pillar: 'video_production',
    sub_niches: ['vp_brand_films', 'vp_documentary', 'vp_event_video'],
    bio: 'Narrative-driven brand films. Past clients: Equinox, Aesop, Tribeca Film Fest.',
    experience: 'senior', yearsExperience: 9,
    availability: 'within_4_weeks',
    verified: true, verification_status: 'pro_verified',
    tier: 'elite',
    rating: 4.9, reviewCount: 28, plan: 'pro',
    tags: ['Brand Films & Commercials', 'Documentary & Interviews', 'Event & Conference Video'],
    location: { city: 'Brooklyn', state: 'NY', country: 'US', regionKey: 'us-tier1' },
    services: [{ serviceId: 'video', rates: { fullDay: 3500 } }],
  },

  // ── 9. Iris Patel — Hospitality photography, Phoenix ───────────
  {
    id: 'seed-9', user_id: null,
    name: 'Iris Patel', businessName: 'Studio Mojave',
    avatar: '/images/creatorbridge/handoff/photo-1544005313-94ddf0286df2.png',
    cover: '/images/creatorbridge/handoff/photo-1502672260266-1c1ef2d93688.png',
    primary_pillar: 'photography',
    sub_niches: ['ph_food_hospitality', 'ph_real_estate', 'ph_lifestyle_fashion'],
    bio: 'Hospitality + interiors photography. Hotels, restaurants, resorts.',
    experience: 'mid', yearsExperience: 5,
    availability: 'available',
    verified: true, verification_status: 'verified',
    tier: 'proven',
    rating: 4.6, reviewCount: 19, plan: 'pro',
    tags: ['Food & Hospitality', 'Real Estate Photography', 'Lifestyle & Fashion'],
    location: { city: 'Phoenix', state: 'AZ', country: 'US', regionKey: 'us-tier3' },
    services: [{ serviceId: 'photography', rates: { fullDay: 750 } }],
  },

  // ── 10. Dre Williams — Event coverage, Atlanta ─────────────────
  {
    id: 'seed-10', user_id: null,
    name: 'Dre Williams', businessName: 'Cumulus Events Co',
    avatar: '/images/creatorbridge/handoff/photo-1607746882042-944635dfe10e.png',
    cover: '/images/creatorbridge/handoff/photo-1540575467063-178a50c2df87.png',
    primary_pillar: 'video_production',
    sub_niches: ['vp_event_video', 'vp_short_form'],
    bio: 'Conference and corporate event coverage. Same-day social cutdowns.',
    experience: 'mid', yearsExperience: 6,
    availability: 'within_2_weeks',
    verified: true, verification_status: 'verified',
    tier: 'verified',
    rating: 4.8, reviewCount: 36, plan: 'pro',
    tags: ['Event & Conference Video', 'Short-Form & Social (Reels/TikTok/UGC)'],
    location: { city: 'Atlanta', state: 'GA', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'video', rates: { fullDay: 900 } }],
  },

  // ── 11. Sofia Pellizzari — Editorial fashion, Boston ───────────
  {
    id: 'seed-11', user_id: null,
    name: 'Sofia Pellizzari', businessName: 'Pellizzari Editorial',
    avatar: '/images/creatorbridge/handoff/photo-1487412720507-e7ab37603c6f.png',
    cover: '/images/creatorbridge/handoff/photo-1496217590455-aa63a8350eea.png',
    primary_pillar: 'photography',
    sub_niches: ['ph_editorial', 'ph_lifestyle_fashion', 'ph_headshots'],
    bio: 'Editorial fashion + portrait. Featured in Harper\'s, Vogue Italia.',
    experience: 'senior', yearsExperience: 8,
    availability: 'available',
    verified: true, verification_status: 'pro_verified',
    tier: 'elite',
    rating: 4.9, reviewCount: 52, plan: 'pro',
    tags: ['Editorial & Press', 'Lifestyle & Fashion', 'Headshots & Portraits'],
    location: { city: 'Boston', state: 'MA', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'photography', rates: { fullDay: 1100 } }],
  },

  // ── 12. Marcus Bell — Motion + edit, Portland ──────────────────
  {
    id: 'seed-12', user_id: null,
    name: 'Marcus Bell', businessName: 'Crosscut Edit Room',
    avatar: '/images/creatorbridge/handoff/photo-1633332755192-727a05c4013d.png',
    cover: '/images/creatorbridge/handoff/photo-1633419461186-7d40a38105ec.png',
    primary_pillar: 'post_production',
    sub_niches: ['pp_motion_vfx', 'pp_short_form_edit', 'pp_video_editing_long'],
    bio: 'Motion + edit suite. After Effects, kinetic typography, brand-channel cutdowns.',
    experience: 'mid', yearsExperience: 6,
    availability: 'available',
    verified: true, verification_status: 'verified',
    tier: 'proven',
    rating: 4.7, reviewCount: 33, plan: 'pro',
    tags: ['Motion Graphics & VFX', 'Short-Form Editing', 'Video Editing (Long-Form)'],
    location: { city: 'Portland', state: 'OR', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'post-production', rates: { editHourly: 115, fullDay: 550 } }],
  },

  // ── 13. Reese Sterling — Product photography, Denver ───────────
  {
    id: 'seed-13', user_id: null,
    name: 'Reese Sterling', businessName: 'Sterling Product Studio',
    avatar: '/images/creatorbridge/handoff/photo-1502823403499-6ccfcf4fb453.png',
    cover: '/images/creatorbridge/handoff/photo-1556228720-195a672e8a03.png',
    primary_pillar: 'photography',
    sub_niches: ['ph_product', 'ph_brand_commercial'],
    bio: 'Tabletop + product photography for DTC brands. Clean white + lifestyle composition.',
    experience: 'mid', yearsExperience: 6,
    availability: 'available',
    verified: true, verification_status: 'verified',
    tier: 'proven',
    rating: 4.8, reviewCount: 27, plan: 'pro',
    tags: ['Product & Still Life', 'Brand & Commercial Photography'],
    location: { city: 'Denver', state: 'CO', country: 'US', regionKey: 'us-tier2' },
    services: [{ serviceId: 'photography', rates: { fullDay: 950 } }],
  },
];

// ── Pre-seeded reviews ────────────────────────────────────────────
// These give profiles a realistic feel on first load.
// Keyed by listing_id so ReviewsSection can filter them.
const SEED_REVIEWS = [
  // seed-1 (Marcus Chen)
  {
    id: 'srev-1a', listing_id: 'seed-1', reviewer_name: 'Jamie R.', rating: 5,
    comment: 'Marcus delivered a brand film that stopped everyone in their tracks at our all-hands. The pre-production process was incredibly organized and he brought ideas we hadn\'t even considered. Highly recommend for any corporate video project.',
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
  {
    id: 'srev-1b', listing_id: 'seed-1', reviewer_name: 'Danielle P.', rating: 5,
    comment: 'We hired Elevation Films for a product launch and the result was cinematic quality we didn\'t expect at this budget. Fast turnaround, professional crew, and Marcus is great to work with on set.',
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
  },
  {
    id: 'srev-1c', listing_id: 'seed-1', reviewer_name: 'Thomas N.', rating: 4,
    comment: 'Solid production quality and very responsive communication. The final edit was excellent. Would have loved slightly faster turnaround but the quality made it worth the wait.',
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
  },
  // seed-2 (Aria Vasquez)
  {
    id: 'srev-2a', listing_id: 'seed-2', reviewer_name: 'Sofia M.', rating: 5,
    comment: 'Aria shot our entire condo development campaign and the images are stunning. Every real estate agent who sees them asks who the photographer is. She made our properties look like they belong in Architectural Digest.',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'srev-2b', listing_id: 'seed-2', reviewer_name: 'Carlos E.', rating: 5,
    comment: 'Booked Aria for executive headshots and she made the whole process easy and comfortable. The final images are professional and distinctive — exactly what we needed for press and LinkedIn.',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'srev-2c', listing_id: 'seed-2', reviewer_name: 'Michelle T.', rating: 5,
    comment: 'We\'ve worked with a lot of photographers for our brand campaigns. Aria stands apart — she understands light, story, and brand in a way that produces images that actually perform. Our email CTR went up 40% after switching to her photography.',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  // seed-3 (Jordan Mitchell)
  {
    id: 'srev-3a', listing_id: 'seed-3', reviewer_name: 'Alex K.', rating: 5,
    comment: 'SoundWave took our podcast from a side project to a serious production. The editing quality is top-tier — every episode sounds like it was recorded in a professional studio even when we\'re remote. Jordan\'s show notes are better than anything I\'d write myself.',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'srev-3b', listing_id: 'seed-3', reviewer_name: 'Rachel B.', rating: 5,
    comment: 'We launched with Jordan from day one. Within 6 weeks we were on Apple Podcasts New and Noteworthy. The launch package was worth every penny — they handled everything we didn\'t even know we needed.',
    createdAt: new Date(Date.now() - 86400000 * 21).toISOString(),
  },
  {
    id: 'srev-3c', listing_id: 'seed-3', reviewer_name: 'David W.', rating: 4,
    comment: 'Consistent, high-quality production every single week for 18 months. That kind of reliability is priceless for a weekly show. Minor note: scheduling can take a bit of lead time since they\'re popular, so plan ahead.',
    createdAt: new Date(Date.now() - 86400000 * 75).toISOString(),
  },
];

// ── Initialize localStorage ───────────────────────────────────────
export function initSeedData() {
  // If demo creators are disabled, remove any existing seed entries and exit.
  if (!SHOW_DEMO_CREATORS) {
    try {
      const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
      const userListings = all.filter(l => !l.id.startsWith('seed-'));
      localStorage.setItem('creator-directory', JSON.stringify(userListings));
    } catch {}
    return;
  }

  try {
    const storedVersion = parseInt(localStorage.getItem('creator-seed-version') || '0', 10);

    if (storedVersion < SEED_VERSION) {
      // ── Re-write seed creators ─────────────────────────────────
      // Always keep user-added listings (anything not prefixed 'seed-').
      const all = JSON.parse(localStorage.getItem('creator-directory') || '[]');
      const userListings = all.filter(l => !l.id.startsWith('seed-'));
      localStorage.setItem(
        'creator-directory',
        JSON.stringify([...SEED_CREATORS, ...userListings])
      );

      // ── Re-write seed reviews ──────────────────────────────────
      const existingReviews = JSON.parse(localStorage.getItem('creator-reviews') || '[]');
      const userReviews = existingReviews.filter(r => !r.id?.startsWith('srev-'));
      localStorage.setItem(
        'creator-reviews',
        JSON.stringify([...SEED_REVIEWS, ...userReviews])
      );

      // ── Stamp version so this only runs once per seed version ──
      localStorage.setItem('creator-seed-version', String(SEED_VERSION));
    }
  } catch {
    // Hard fallback: write seeds regardless
    localStorage.setItem('creator-directory', JSON.stringify(SEED_CREATORS));
    localStorage.setItem('creator-reviews', JSON.stringify(SEED_REVIEWS));
    localStorage.setItem('creator-seed-version', String(SEED_VERSION));
  }
}
