# CreatorBridge Closed-Loop Network and Platform Language Design

## Objective

CreatorBridge will describe itself publicly as a verified media production platform rather than a marketplace. The state network will remain a professional communication space, not a classifieds or commerce surface. Members can discuss work, request feedback, collaborate, refer other CreatorBridge members, and point to formal Project Board opportunities without creating an exit path from CreatorBridge.

## Approved Network Scope

The network will support Portfolio Work & Feedback, Collaborations, Referrals, Industry Discussion, and Gig Leads. Gear Swap will be removed as a post type and as a chat channel. CreatorBridge will not provide gear listings, prices, sales, trades, rentals, shipping, checkout, gear-specific uploads, or transaction tools. If members independently discuss equipment, the rules will state that CreatorBridge does not facilitate, verify, insure, or accept responsibility for that arrangement.

Network posts and chat remain text-first. Direct image attachments will not be added to the network. This avoids turning the network into a resale product and eliminates a second media-upload path that could be used to hide contact information.

## Portfolio Project Sharing

A verified creator can choose one of their existing portfolio items while composing a Portfolio Work & Feedback post. The post stores the creator listing ID and portfolio item ID as structured references rather than accepting a pasted URL. The rendered post displays a CreatorBridge project card using the portfolio title, category, and approved media preview already stored on the creator profile.

Selecting the card opens the creator profile and jumps directly to the referenced portfolio project. The profile route will support a CreatorBridge-owned deep link such as `/creator/{listingId}?portfolio={portfolioItemId}`. The profile validates the referenced item against the current listing before opening it. Invalid, removed, or mismatched item references render as unavailable and never redirect externally.

The composer will not accept arbitrary URLs. CreatorBridge profile and project references are selected through platform controls, preventing forged internal links and preserving mobile usability.

## Closed-Loop Moderation

Existing text moderation continues to block external URLs, domains, email addresses, phone numbers, social handles, named social platforms, and payment applications in posts, replies, chat, creator profile copy, and portfolio descriptions. Internal portfolio references bypass pasted-text link parsing because they are stored as verified IDs.

Portfolio media remains part of the existing creator profile and manual approval pipeline. The network will not introduce a second image-upload surface, so the proposed gear-photo OCR path is unnecessary. Only portfolio items attached to an approved creator listing can be shared in the network. This keeps image review in one established place and prevents current OpenAI quota limitations from becoming either a publishing outage or a moderation bypass.

## Network Rules and Tone

The rules will become friendlier without weakening the wall. The composer guidance will welcome portfolio feedback, referrals, collaborations, industry discussion, and internal Project Board leads. It will explain that communication and bookings stay on CreatorBridge, external contact details are not permitted, and formal paid briefs belong on the Project Board.

The rules card will explain that CreatorBridge is a communication platform and does not facilitate or accept responsibility for private equipment arrangements members choose to discuss. Enforcement remains strongest for fraud, harassment, contact leakage, payment diversion, and repeated attempts to move users off-platform.

## Platform Terminology

Customer-facing uses of “marketplace” will become “platform,” including navigation-adjacent copy, landing-page copy, onboarding, creator application language, chatbot knowledge, metadata, image alternative text, policies, privacy copy, and network descriptions. The preferred descriptor is “CreatorBridge — the verified media production platform.”

Internal JavaScript identifiers and database names such as `MARKETPLACE_CATEGORIES` may remain unchanged because renaming them provides no customer benefit and adds unnecessary regression risk. Language that makes a precise legal distinction about two-sided transactions may describe the booking function, but the product itself will still be called a platform.

## Data and Security

The network post record will gain nullable `creator_listing_id` and `portfolio_item_id` references. Database constraints or a server-side validation function will ensure the portfolio item belongs to the listing and that the posting user owns the listing. Ordinary posts keep both fields null. Row-level security continues to require a verified signed-in member for writes and allows the existing browsing behavior for approved, unflagged posts.

No external URL is stored for a shared project. The card derives its route and preview from trusted CreatorBridge records. Portfolio removal or moderation automatically makes the network card unavailable without leaving a stale outbound link.

## Error Handling

If a creator has no portfolio projects, the Work & Feedback option explains that work must first be added to the creator profile. If a selected project is removed before submission, the post is rejected with a clear refresh message. If the project later becomes unavailable, the post remains readable but its card shows “Portfolio project unavailable.”

## Verification

Automated checks will prove that external URLs and contact details remain blocked, internal portfolio references are accepted only for the owning creator, invalid cross-creator references are rejected, gear categories and upload controls are absent, project cards deep-link to the exact portfolio item, and customer-facing copy uses “platform.” Desktop and mobile browser checks will verify the composer, project card, deep link, rules copy, and chat categories. Existing messaging, Project Board, profile media, RLS, build, and launch-sweep checks must remain green.
