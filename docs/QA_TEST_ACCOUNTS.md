# CreatorBridge QA Test Accounts

These accounts are for realistic end-to-end testing. They are created in Supabase Auth with confirmed email status and should be used in a Vercel preview or local app build.

## Emails

Use aliases that route to the CreatorBridge admin inbox:

```text
drl33+creator@creatorbridge.studio
drl33+client@creatorbridge.studio
```

Do not use the exact same email for both roles. Supabase Auth allows one user per email address.

## Retired Creator Test Profile

This fixture is retained below only as historical QA documentation. Do not
recreate or publish it. New automated tests use the unmistakable
`CreatorBridge QA Creator` identity and must clean up their temporary rows.

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

The Marcus Reed / Copper Line Media creator listing and its cascaded sample
services, portfolio items, and packages were deleted from the live database on
2026-08-23. The live `creator_listings` count was verified as zero immediately
after deletion. The Auth account may remain for private sign-in QA, but it has
no creator listing and must not be counted or shown as platform talent.

The client QA account also remains private and must not own any public project
brief at launch.

Do not commit or store the generated passwords in this document.
