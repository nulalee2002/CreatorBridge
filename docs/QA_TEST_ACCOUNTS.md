# CreatorBridge QA Test Accounts

These accounts are for realistic end-to-end testing. They are created in Supabase Auth with confirmed email status and should be used in a Vercel preview or local app build.

## Emails

Use aliases that route to the CreatorBridge admin inbox:

```text
drl33+creator@creatorbridge.studio
drl33+client@creatorbridge.studio
```

Do not use the exact same email for both roles. Supabase Auth allows one user per email address.

## Creator Test Profile

Name: Marcus Reed

Business name: Copper Line Media

Location: Phoenix, AZ 85004, United States

Experience: 8 years

Bio:

```text
Phoenix based commercial videographer and production lead with 8 years of paid experience helping small businesses, nonprofits, and event teams turn practical briefs into polished video, photo, and podcast content. This QA profile is fully filled out to test CreatorBridge onboarding, service packaging, portfolio review, quote requests, and client booking flows from end to end.
```

Services:

- Video Production: corporate brand film, event recap, interview setup
- Photography: event photography, commercial portraits, brand stills
- Podcast Production: studio setup, episode recording, podcast editing

Portfolio links:

- Founder Story Brand Film: `https://example.com/creatorbridge-test/founder-story-brand-film`
- Corporate Event Photo Set: `https://example.com/creatorbridge-test/corporate-event-photo-set`
- Podcast Launch Package: `https://example.com/creatorbridge-test/podcast-launch-package`

Intro video:

```text
https://example.com/creatorbridge-test/60-second-intro-video
```

Packages:

- Brand Film Starter, $2,200
- Podcast Launch Kit, $1,800

## Client Test Profile

Name: Avery Thompson

Company: Sonoran Launch Group

Phone: 480-555-0142

Use this client to create quote requests, accept a creator proposal, test retainer checkout, and test final payment.

## Creation Script

Preferred script:

```bash
npm run qa:create-accounts
```

The script requires:

```bash
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
```

It prints the generated test passwords after creation. Do not commit those passwords.

## Current Status

Created on 2026-05-08 through the Supabase connector.

Creator listing ID:

```text
ff6c1f99-4ca0-41a9-9861-39ce4e993924
```

Verification:

- creator Auth user confirmed
- client Auth user confirmed
- creator listing seeded as verified
- 3 creator services seeded
- 3 portfolio items seeded
- 2 packages seeded

Do not commit or store the generated passwords in this document.
