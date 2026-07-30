export function buildQaCreatorListingPayload({ userId, email, now }) {
  return {
    user_id: userId,
    name: 'Marcus Reed',
    business_name: 'Copper Line Media',
    avatar: 'CB',
    bio: 'Phoenix based commercial videographer and production lead with 8 years of paid experience helping small businesses, nonprofits, and event teams turn practical briefs into polished video, photo, and podcast content. This QA profile is fully filled out to test CreatorBridge onboarding, service packaging, portfolio review, quote requests, and client booking flows from end to end.',
    experience: 'senior',
    years_experience: 8,
    tags: ['Corporate', 'Brand Film', 'Podcast', 'Event Coverage', 'Editing'],
    availability: 'available',
    verified: true,
    verification_status: 'verified',
    review_status: 'approved',
    plan: 'pro',
    city: 'Phoenix',
    state: 'AZ',
    country: 'US',
    zip: '85004',
    region_key: 'us-tier2',
    email,
    phone: '480-555-0188',
    rating: 4.9,
    review_count: 12,
    completed_projects: 14,
    tier: 'proven',
    completion_rate: 96,
    video_intro_url: 'bunny:qa-creator-intro',
    updated_at: now,
  };
}

export function buildQaCreatorPortfolioItems(listingId) {
  return [
    {
      listing_id: listingId,
      service_id: 'video',
      title: 'Founder Story Brand Film',
      description: 'Test portfolio item for a 90-second founder story with interview lighting, b-roll, music, color, and captions.',
      media_type: 'video',
      bunny_video_id: 'qa-founder-story-brand-film',
      display_order: 0,
    },
    {
      listing_id: listingId,
      service_id: 'video',
      title: 'Corporate Event Recap',
      description: 'Test portfolio item for conference coverage, speaker highlights, candid networking, and sponsor deliverables.',
      media_type: 'video',
      bunny_video_id: 'qa-corporate-event-recap',
      display_order: 1,
    },
    {
      listing_id: listingId,
      service_id: 'video',
      title: 'Podcast Launch Trailer',
      description: 'Test portfolio item for a branded podcast trailer, edited episodes, show notes, and social clips.',
      media_type: 'video',
      bunny_video_id: 'qa-podcast-launch-trailer',
      display_order: 2,
    },
  ];
}
