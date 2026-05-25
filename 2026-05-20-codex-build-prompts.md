# CreatorBridge — Codex Build Prompts (All 14)
**Last updated:** 2026-05-20  
**Project:** `/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc`  
**Live site:** https://www.creatorbridge.studio

These prompts are self-contained. Give them to Codex one at a time in the order listed.
Each prompt includes enough platform context to execute without additional explanation.

**Recommended run order:**
Prompts 1 → 2 → 3 → 4 touch different parts of the codebase and can run in parallel.
For the second batch, run: 6 → 7 → 5 → 8 → 9 → 10 → 11 → 12 → 13 → 14.

---

## PROMPT 1 — Customer Support Ticket System

```
You are working on a platform called CreatorBridge. It is a media production 
marketplace built with React 18, Vite, Tailwind CSS, and Supabase as the backend. 
The design palette is dark charcoal and gold only. No other accent colors.

Task: Build a customer support ticket system with the following requirements.

SUPABASE SIDE:
Create a new table called support_tickets with these columns:
- id (uuid, primary key, default gen_random_uuid())
- created_at (timestamptz, default now())
- user_id (uuid, references auth.users)
- user_type (text, either 'client' or 'creator')
- category (text, one of: 'payment', 'account', 'violation_report', 
  'technical', 'other')
- subject (text)
- description (text)
- status (text, default 'open', values: 'open', 'in_progress', 'resolved')
- priority (text, default 'normal', values: 'low', 'normal', 'high', 'urgent')
- admin_notes (text, nullable)
- updated_at (timestamptz, default now())

Enable RLS on support_tickets. Policy rules:
- Authenticated users can INSERT their own tickets
- Authenticated users can SELECT only their own tickets
- Service role (admin) can SELECT, UPDATE all tickets

USER-FACING SIDE:
Create a new component at src/components/SupportTicketForm.jsx
- A modal form that any logged-in user (client or creator) can open
- Fields: category (dropdown), subject (text input), description (textarea)
- User type is determined automatically from their Supabase profile
- On submit, insert a row into support_tickets
- Show a confirmation message with a ticket reference (the uuid, first 8 chars)
- Style in dark charcoal and gold to match the existing platform
- Add a Support link in the nav or footer that opens this modal

ADMIN SIDE:
Create a new page at src/pages/AdminSupport.jsx
- Only accessible if the logged-in user has role = 'admin' in their profile
- Shows a table of all support tickets sorted by created_at descending
- Columns: date, user type, category, subject, priority, status
- Color-coded status badges (gold for open, muted for in_progress, 
  dark for resolved)
- Clicking a row expands it to show description and an admin_notes textarea
- Admin can update status and priority inline and save back to Supabase
- Filter controls at the top for status and category

Do not touch src/components/SupportChatbot.jsx. That file handles the 
Bridge chatbot and must not be restructured.
Do not touch src/data/rates.js.
```

---

## PROMPT 2 — Creator Earnings and Finance Dashboard

```
You are working on a platform called CreatorBridge. It is a media production 
marketplace built with React 18, Vite, Tailwind CSS, and Supabase as the backend. 
Payments are handled through Stripe Connect. The design palette is dark charcoal 
and gold only.

Task: Build a creator earnings dashboard and an admin revenue overview.

ASSUMPTIONS ABOUT EXISTING DATA:
There is a transactions table in Supabase that stores payment records.
Each record has: id, project_id, creator_id, client_id, project_amount (cents),
creator_fee_amount (cents), client_fee_pct, retainer_status, final_status,
final_transfer_id, retainer_payment_intent, final_payment_intent,
retainer_paid_at, final_paid_at, final_released_at, created_at.

Creator net payout = project_amount - creator_fee_amount.
Platform revenue per transaction = creator_fee_amount + (project_amount * client_fee_pct/100).

CREATOR EARNINGS PAGE:
Add a new tab or section in src/pages/CreatorDashboard.jsx called Earnings.
- Total earned: sum of (project_amount - creator_fee_amount) where final_status = 'released'
- Pending payout: sum of project_amount where final_status = 'paid' but not 'released'
- Platform fees paid: sum of creator_fee_amount where final_status = 'released'
- A transaction history table: date, project reference (first 8 chars of project_id),
  gross amount, fee deducted, amount received, status
- Status badge: 'paid' in gold (awaiting transfer), 'released' in charcoal-green, 
  'held' in muted gold
- All amounts in dollars (divide cents values by 100)
- No external charting libraries — use simple styled divs for summary cards

ADMIN REVENUE PAGE:
Create a new page at src/pages/AdminFinance.jsx
- Only accessible to admin role users
- Summary cards: total platform revenue, total held, total released, active job count
- Full transaction table: date, project id, client id, creator id, gross amount,
  client fee, creator fee, total platform revenue per transaction, status
- Export to CSV button that downloads the visible table as a .csv file
- Filter by status and by date range

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
Follow the dark charcoal and gold design rules throughout.
```

---

## PROMPT 3 — Admin Operations Panel (Violations and canPublish Gate)

```
You are working on a platform called CreatorBridge. It is a media production 
marketplace built with React 18, Vite, Tailwind CSS, and Supabase as the backend. 
The design palette is dark charcoal and gold only.

Task: Build an admin operations panel that covers creator verification review 
and the violation/strike system.

CONTEXT ON THE CREATOR SYSTEM:
Creators go through a 5-step registration process defined in 
src/components/CreatorDirectory.jsx. There is a canPublish gate with 13 
conditions that must pass before a profile goes live. There is also a 90-day 
profile lock after registration. The platform has a three-strike rule for 
violations such as attempting to take transactions off-platform.

SUPABASE SIDE:
Create a violations table with these columns:
- id (uuid, primary key)
- created_at (timestamptz, default now())
- creator_id (uuid, references auth.users)
- reported_by (uuid, references auth.users, nullable)
- violation_type (text: 'off_platform_contact', 'payment_bypass', 
  'fake_credentials', 'harassment', 'other')
- description (text)
- strike_number (integer, 1, 2, or 3)
- status (text: 'under_review', 'confirmed', 'dismissed')
- admin_notes (text, nullable)

RLS: Only service role (admin) can read and write. Creators cannot see 
their own violation records.

Add a strike_count column (integer, default 0) and is_suspended (boolean, 
default false) to the creator_listings table if they do not already exist.

ADMIN OPERATIONS PAGE:
Create a new page at src/pages/AdminOperations.jsx
- Only accessible to admin role users
- Two tabs: Creator Review and Violations

Creator Review tab:
- Table of all creator listings where verified = false or review_status = 'pending_review'
- Shows: display name, registration date, days since registration
- Admin can click a row to see profile data and manually approve
- Approval requires a reason field, which is logged to Supabase

Violations tab:
- Table of all violations sorted by created_at descending
- Shows: date, creator name, violation type, strike number, status
- Admin can click to expand, read description, update status, add notes
- When a violation is confirmed and it is strike 3, show a Suspend Account 
  button that sets is_suspended = true on the creator_listings row
- Suspended creators must not appear in any public directory query

Do not touch src/components/CreatorDirectory.jsx logic directly.
Do not touch src/components/SupportChatbot.jsx.
Follow the dark charcoal and gold design rules throughout.
```

---

## PROMPT 4 — Platform Search

```
You are working on a platform called CreatorBridge. It is a media production 
marketplace built with React 18, Vite, Tailwind CSS, and Supabase as the backend. 
The design palette is dark charcoal and gold only.

Task: Build a full-text search feature that lets clients search for creators 
and lets admins search across the entire platform.

SUPABASE SIDE:
Enable the pg_trgm extension if not already enabled:
  create extension if not exists pg_trgm;
  create extension if not exists unaccent;

Add a generated tsvector search column to creator_listings:
  alter table creator_listings add column if not exists search_vector tsvector 
  generated always as (
    to_tsvector('english', 
      coalesce(display_name,'') || ' ' || 
      coalesce(bio,'') || ' ' || 
      coalesce(location,'') || ' ' ||
      coalesce(tier,'')
    )
  ) stored;
  create index if not exists creator_listings_search_idx 
  on creator_listings using gin(search_vector);

Create a Supabase RPC function called search_creators that accepts a query
text parameter and returns matching creator_listings rows ordered by rank,
filtered to only approved/verified creators.

PUBLIC SEARCH PAGE:
Create src/pages/Search.jsx
- Search bar at the top accepting plain text input
- Creator result cards: display name, tier badge, top specialties, location, 
  View Profile button
- Tier badge colors stay within charcoal and gold palette only
- Empty state message when no results found
- Debounce the search input by 300ms before querying
- Add a Search link to the main navigation in src/App.jsx

ADMIN GLOBAL SEARCH:
In AdminOperations.jsx, add a search bar at the top that queries across 
creator_listings, support_tickets, and violations simultaneously.
Display results grouped by source with a clear source label on each result.

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
Tier badge colors must stay within the dark charcoal and gold palette.
No coral. No sky blue.
```

---

## PROMPT 5 — SEO and Marketing Infrastructure

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Dark charcoal and gold palette only. No coral, no sky blue.

Task: Build SEO infrastructure and marketing capture tools into the platform.

SEO META TAGS:
Install react-helmet-async if not already installed.
Add a HelmetProvider wrapper in src/main.jsx.
Create a reusable SEO component at src/components/SEO.jsx that accepts 
title, description, image, and url props and renders:
- <title>
- meta description
- Open Graph tags (og:title, og:description, og:image, og:url, og:type)
- Twitter card tags
- Canonical URL tag

Apply the SEO component to every page with appropriate unique titles and 
descriptions:
- Home: "CreatorBridge — Hire Verified Media Creators"
- Creator directory: "Find Freelance Video, Podcast, and Event Creators"
- How it works: "How CreatorBridge Works for Clients and Creators"
- Each creator profile page: use the creator's name and top specialty

SITEMAP:
Create a script at scripts/generate-sitemap.js that queries Supabase for 
all public creator profile slugs and generates a sitemap.xml in public/.
Include all static routes and all public creator profile URLs.
Add a robots.txt to public/ that allows all crawlers and points to the sitemap.

STRUCTURED DATA:
On the home page and creator profile pages, add JSON-LD structured data 
for Organization (home) and Person/Service (creator profiles).

EMAIL CAPTURE:
Create a component at src/components/EmailCapture.jsx.
- A simple one-field form: email input and a Join the Waitlist button
- On submit, insert the email into a waitlist table in Supabase with 
  columns: id, email, created_at, source (text, default 'homepage')
- Show a gold-accented thank you message on success
- Validate email format before submitting
- Add this component to the home page hero section and footer

Create the waitlist table with RLS allowing anonymous INSERT and no 
SELECT for public users.

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
```

---

## PROMPT 6 — Legal Pages and Acceptance Flows

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Dark charcoal and gold palette only. No coral, no sky blue.

Task: Build legal document pages and track acceptance in Supabase.

LEGAL PAGES:
Create three new pages:
- src/pages/TermsOfService.jsx — platform terms for all users
- src/pages/CreatorAgreement.jsx — creator-specific agreement covering 
  fee structure (10% platform fee at Launch tier, scaling down with tier),
  payment terms, off-platform contact prohibition, three-strike policy, 
  and 90-day profile lock
- src/pages/DisputePolicy.jsx — explains how payment disputes are handled,
  the 50/50 payment split (retainer on start, final on delivery approval),
  and how admins resolve conflicts

Each page should:
- Render the document in a clean readable layout with section headings
- Include a last updated date field at the top
- Be linked from the footer
- Be accessible without login

ACCEPTANCE TRACKING:
Create a legal_acceptances table in Supabase:
- id (uuid, primary key)
- user_id (uuid, references auth.users)
- document_type (text: 'terms_of_service', 'creator_agreement')
- document_version (text, e.g. '1.0')
- accepted_at (timestamptz, default now())
- ip_address (text, nullable)

RLS: Users can INSERT and SELECT only their own records.

ACCEPTANCE GATES:
In src/components/auth/AuthModal.jsx — treat this file as fragile, make 
minimal changes only. After a new user completes registration, show a modal 
requiring Terms of Service acceptance before proceeding. Record to legal_acceptances.

In src/components/CreatorDirectory.jsx — at Step 5, add a required Creator 
Agreement checkbox. Record acceptance to legal_acceptances on registration complete.

If a returning user has no acceptance record for the current TOS version, 
show the acceptance modal on next login before they can proceed.

Do not restructure AuthModal.jsx or CreatorDirectory.jsx logic.
Do not touch src/components/SupportChatbot.jsx.
```

---

## PROMPT 7 — Creator Recruitment Landing Page

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Dark charcoal and gold palette only. No coral, no sky blue.
The UX principle is: feels like social media, safe and trustworthy, not corporate.

Task: Build a dedicated creator recruitment landing page.

Create a new page at src/pages/JoinAsCreator.jsx with the following sections:

HERO SECTION:
- Headline: "Get Paid for the Work You Already Do"
- Subheadline for freelance media professionals: videographers, podcast 
  producers, event coverage crews, brand film directors, social media 
  content creators
- CTA button: "Apply as a Creator" — links to the creator registration flow

HOW IT WORKS SECTION:
Three steps in a horizontal card layout:
1. Register and get verified (mention Launch, Proven, Elite, Signature tiers)
2. Get matched with clients who post booking briefs
3. Quote jobs, get hired, get paid through secure Stripe payouts

WHAT YOU EARN SECTION:
- Explain the 90/10 split — creators keep 90% of every job at Launch tier,
  increasing to 95% at Signature tier
- Simple example: $1,000 job → creator receives $900 (Launch), $950 (Signature)
- Mention the 50% upfront on project start, 50% on delivery approval

NICHES WE SERVE SECTION:
Six cards in a grid:
- Video Production, Podcast Production, Corporate Event Coverage,
  Brand Films, Social Media Content, Photography
Each card has an icon, the niche name, and one sentence description.

TRUST SIGNALS SECTION:
- Platform based in Phoenix, AZ
- Stripe-secured payments — held until work is approved
- Verified creator profiles with tier reputation system
- No subscription to join

FINAL CTA:
Repeat the Apply as a Creator button with:
"Registration is free. Your first job is waiting."

Add a link to this page in the main navigation Join dropdown.

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
Do not touch src/components/CreatorDirectory.jsx logic.
```

---

## PROMPT 8 — Accessibility and Design System Audit

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Dark charcoal and gold palette only. No coral, no sky blue.

Task: Run a WCAG 2.1 AA accessibility pass across all components and pages.

Audit and fix the following everywhere:

COLOR CONTRAST:
- All text must meet 4.5:1 contrast ratio against its background
- Gold text on dark charcoal must be verified — adjust the gold hex if it 
  falls below the threshold
- Disabled state elements must meet 3:1

KEYBOARD NAVIGATION:
- All interactive elements must be reachable via Tab in logical order
- Modal dialogs must trap focus while open and return focus to trigger on close
- Dropdown menus must be navigable with arrow keys

SCREEN READER SUPPORT:
- All images must have descriptive alt text or aria-hidden if decorative
- All form inputs must have associated labels or aria-label
- All icon-only buttons must have aria-label
- Modal dialogs must have role="dialog" and aria-labelledby pointing to the title
- Status messages (success, error) must use aria-live="polite"

TOUCH TARGETS:
- All clickable elements must be at least 44x44px
- Increase padding on any button or link smaller than this

FOCUS INDICATORS:
- All focusable elements must have a visible focus ring
- Do not use outline:none without a replacement
- Use a gold-toned focus ring consistent with the palette

FORM VALIDATION:
- Error messages must be associated with their input via aria-describedby
- Required fields must have aria-required="true"
- Invalid fields must have aria-invalid="true" when validation fails

SPECIFIC FILES TO AUDIT:
- src/components/auth/AuthModal.jsx (fragile — fix accessibility only)
- src/components/CreatorDirectory.jsx (fix accessibility only, do not 
  restructure registration logic)
- src/components/RequestQuoteModal.jsx
- src/App.jsx navigation
- All pages created in Prompts 5, 6, 7

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
```

---

## PROMPT 9 — Admin Analytics Dashboard

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Dark charcoal and gold palette only. No coral, no sky blue.

Task: Build an admin analytics dashboard showing platform health metrics.

Create a new page at src/pages/AdminAnalytics.jsx.
Only accessible to users with role = 'admin' in their profiles table.

SUMMARY CARDS (top of page):
- Total registered creators (count from creator_listings)
- Total clients (count from client_profiles)
- Total projects posted (count from projects)
- Total completed transactions (count where final_status = 'released' in transactions)
- Total platform revenue (sum of creator_fee_amount from released transactions, 
  plus client booking fees)
- Active projects in progress (count where status not in 'final_paid', 'cancelled')

CREATOR FUNNEL:
A horizontal funnel using styled divs — no charting library:
- Registered → Verified (stripe_onboarded = true) → Active (completed_projects > 0)
- Show counts and percentage at each stage

CREATOR TIER BREAKDOWN:
Four cards showing count of creators at each tier: 
Launch, Proven, Elite, Signature. Gold accents throughout.

PROJECT ACTIVITY TABLE:
- Last 30 days of projects
- Columns: date posted, title, service type, status
- Row click expands to show project_id, client_id, creator_id if assigned

WAITLIST TABLE (if the waitlist table from Prompt 5 exists):
- All emails from the waitlist table
- Columns: email, date joined, source
- Total count shown at the top
- Export to CSV button

RECENT VIOLATIONS (if violations table from Prompt 3 exists):
- Last 10 violation records
- Shows creator id, type, strike number, status

All data fetched from Supabase on page load.
Add a Refresh button that re-fetches all data.
Show a loading skeleton while fetching.

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
```

---

## PROMPT 10 — Creator Agreement PDF Generation

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Payments are handled through Stripe Connect.

Task: When a creator accepts the Creator Agreement during registration, 
generate a PDF of the signed agreement and store it.

SUPABASE EDGE FUNCTION:
Create a new edge function at supabase/functions/generate-agreement-pdf/
This function:
- Receives: creator_id, creator_name, accepted_at (ISO timestamp), 
  document_version
- Generates a PDF of the Creator Agreement with: creator name, acceptance 
  date, document version, reference number (first 8 chars of creator_id)
- Uses jsPDF to generate the PDF as a Buffer
- Uploads the PDF to Supabase Storage at path:
  creator-agreements/{creator_id}/agreement-v{version}.pdf
- Updates the legal_acceptances record for this creator to include 
  pdf_url pointing to the stored file
- Add a pdf_url column (text, nullable) to legal_acceptances if it does not exist

STORAGE SETUP:
Create a creator-agreements storage bucket if it does not exist.
RLS rules:
- Creators can only read files in their own creator_id folder
- Service role (admin) can read all files

CREATOR DASHBOARD:
In src/pages/CreatorDashboard.jsx, add a Documents section:
- List of accepted agreements with acceptance date and version
- Download Agreement button that fetches the PDF URL and opens it in a new tab

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
Follow the dark charcoal and gold design rules throughout.
```

---

## PROMPT 11 — Transactional Email Notifications

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
Payments are handled through Stripe Connect. The design palette is dark 
charcoal and gold only.

Task: Build a transactional email notification system so users are 
automatically notified at key moments in the platform lifecycle.

EMAIL PROVIDER:
Use Resend (resend.com) as the email provider. The API key should be stored 
as a Supabase Edge Function secret named RESEND_API_KEY.
All emails must be sent from drl33@creatorbridge.studio.

SUPABASE EDGE FUNCTION:
Create a new edge function at supabase/functions/send-notification-email/
This function accepts: to (email), template (string), and data (object).
It uses the template name to select the correct email body, substitutes 
the data variables, and sends via the Resend API.

EMAIL TEMPLATES TO BUILD:
Each template is a clean HTML email. Dark charcoal background, gold accents, 
CreatorBridge wordmark at the top. Plain readable body. No images required.

1. welcome_creator — sent when a creator completes registration
   Variables: creator_name
   Subject: "Welcome to CreatorBridge, {creator_name}"
   Body: confirms registration received, explains next steps (review process, 
   90-day lock, profile goes live after verification)

2. welcome_client — sent when a client completes onboarding
   Variables: client_name
   Subject: "You're on CreatorBridge"
   Body: confirms account, explains how to post a project and get matched

3. application_received — sent to creator when they apply to a project
   Variables: creator_name, project_title
   Subject: "Your application was submitted"

4. application_accepted — sent to creator when client accepts their proposal
   Variables: creator_name, project_title, retainer_amount (dollars)
   Subject: "You've been hired for {project_title}"
   Body: explains retainer will be paid shortly, project moves to retainer_paid

5. retainer_paid — sent to creator when retainer payment clears
   Variables: creator_name, project_title, retainer_amount
   Subject: "Retainer received — start your project"

6. delivery_submitted — sent to client when creator marks delivery done
   Variables: client_name, project_title, creator_name
   Subject: "{creator_name} submitted delivery for {project_title}"
   Body: explains they have 72 hours to approve or request a revision

7. final_paid — sent to creator when final payment is released to their 
   Stripe account
   Variables: creator_name, project_title, payout_amount (dollars)
   Subject: "Payment released: ${payout_amount}"

8. support_ticket_opened — sent to user when they submit a support ticket
   Variables: user_name, ticket_reference (first 8 chars of ticket id)
   Subject: "Support ticket #{ticket_reference} received"

TRIGGER POINTS:
Call send-notification-email from:
- stripe-webhook edge function after retainer_paid and final_paid transitions
- ProjectBoard.jsx after application submitted, application accepted, 
  delivery submitted
- AuthModal.jsx or the registration completion flow for welcome emails
- SupportTicketForm.jsx after ticket submitted

Use best-effort sending — if the email call fails, log the error but 
do not block the main flow.

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
```

---

## PROMPT 12 — Platform-Wide Copy and Brand Voice Audit

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
The design palette is dark charcoal and gold only. No coral, no sky blue.

Task: Audit and rewrite all user-facing copy across the platform to match 
the approved brand voice. Then add a brand voice reference file so future 
copy stays consistent.

BRAND VOICE RULES (apply these everywhere):
Tone: Clear, direct, confident. Feels like social media. Trustworthy but 
not corporate. No buzzwords. No generic marketplace language.
Vocabulary to remove from all copy:
- "leverage", "synergy", "game-changer", "seamless", "best-in-class",
  "cutting-edge", "robust", "holistic", "streamlined", "empower",
  "revolutionize", "innovative solution", "one-stop shop",
  "world-class", "next-level"
Replace with plain, specific, honest language that says what the thing 
actually does.

POSITIONING: CreatorBridge is an on-demand media production hub for 
companies that need video, podcast, event coverage, brand content, or 
photography without building an internal production department.
Primary client headline direction: "Your production team, without the overhead."
Primary creator headline direction: "Get paid for the work you already do."

AUDIT SCOPE — check every page and component for:
1. Any text using the banned vocabulary list above
2. Any text that says "marketplace" when "production hub" is more accurate
3. Empty state messages that say nothing useful (replace with specific guidance)
4. Error messages that are technical or unhelpful (replace with plain language)
5. Button copy that is vague ("Submit", "Continue") where specific copy 
   would be clearer ("Submit your brief", "Start your application")
6. Any placeholder text left in production (e.g., "Lorem ipsum", "Coming soon",
   "Feature in development")
7. Any copy that breaks the UX principle: feels like social media, safe 
   and trustworthy, not corporate

FILES TO AUDIT (do not restructure logic in any of these):
- src/App.jsx (nav labels, footer links)
- src/pages/CreatorDashboard.jsx
- src/components/CreatorDirectory.jsx (registration copy only)
- src/components/RequestQuoteModal.jsx
- src/components/auth/AuthModal.jsx (copy only, no logic changes)
- All pages created in Prompts 5, 6, 7, 9

BRAND VOICE REFERENCE FILE:
Create a file at src/content/brand-voice.md with:
- The positioning statement
- The tone description
- The banned vocabulary list
- 10 before/after rewrite examples taken from the actual audit findings
- A checklist Codex or Claude can use before publishing any new copy

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
```

---

## PROMPT 13 — Data Export and Reporting

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
The design palette is dark charcoal and gold only.

Task: Add data export capabilities and downloadable reports throughout 
the admin and creator sections of the platform.

CREATOR EXPORTS:
In src/pages/CreatorDashboard.jsx, add export buttons in the Earnings section:
- Export Transactions as CSV: downloads all transaction rows for this creator
  with columns: date, project_id (first 8 chars), gross_amount, fee_deducted, 
  net_payout, status
- Export Quote Requests as CSV: downloads all incoming quote requests with 
  columns: date, client_name, service_type, budget, status

CLIENT EXPORTS:
In the client profile page (src/components/ClientProfile.jsx or similar):
- Export Projects as CSV: downloads all projects posted by this client with 
  columns: date, title, service_type, budget, status, creator_assigned

ADMIN EXPORTS (add to AdminFinance.jsx and AdminSupport.jsx):
- AdminFinance: Export All Transactions CSV — every transaction row on the platform
- AdminFinance: Export Platform Revenue Summary CSV — aggregated by month,
  columns: month, total_gross, total_creator_fees, total_client_fees, 
  total_platform_revenue, transaction_count
- AdminSupport: Export Support Tickets CSV — all tickets with columns: 
  date, ticket_id, user_type, category, subject, priority, status

CSV UTILITY:
Create a reusable utility at src/utils/exportCsv.js that accepts an array 
of objects and a filename, converts to CSV format, and triggers a browser 
download. Use this utility for all export buttons — do not duplicate the 
download logic across components.

All export buttons use the same style: a small outlined gold button with 
a download icon. Position them in the top-right corner of the relevant section.

Do not touch src/components/SupportChatbot.jsx.
Do not touch src/data/rates.js.
Follow the dark charcoal and gold design rules throughout.
```

---

## PROMPT 14 — Mobile Optimization Pass

```
You are working on CreatorBridge, a media production marketplace at 
creatorbridge.studio. Built with React 18, Vite, Tailwind CSS, and Supabase. 
The design palette is dark charcoal and gold only. No coral, no sky blue.

Task: Run a full mobile and responsive optimization pass across the platform.

VIEWPORT AND LAYOUT:
- All pages must be fully usable on a 375px wide viewport (iPhone SE) and 
  a 768px viewport (tablet)
- Any horizontal overflow or cut-off content must be fixed
- Wide desktop-only layouts (multi-column grids) must stack gracefully on mobile
- The animated background must not cause performance issues on mobile — 
  reduce particle count or animation complexity on viewports under 768px

NAVIGATION:
- The mobile nav must include all primary links: Home, Find Creators, 
  How It Works, Search, Join (dropdown), and role-specific dashboard links
- The nav hamburger menu (if present) must open/close correctly and trap 
  focus while open
- The avatar/profile button must be tappable at minimum 44x44px on mobile

MODALS:
- All modals (auth, quote request, support ticket, project posting) must 
  be full-screen or near-full-screen on mobile with a clear close button
- Modals must not overflow the viewport vertically — add scroll inside the 
  modal if the content is long

CHATBOT:
- The chatbot panel must not auto-open on mobile
- The chatbot button (bottom right) must not overlap key page content on 
  small screens
- The chat panel must be full-width on mobile (width: 100vw, max-width: none)
- The session key that controls auto-open is cb-chat-shown — do not change 
  this key name
- Do not restructure SupportChatbot.jsx logic. Only adjust responsive 
  width/height styles if needed.

FORMS:
- All form inputs must have font-size at least 16px on mobile to prevent 
  iOS auto-zoom on focus
- Form labels must stack above inputs on mobile, not inline
- Submit buttons must be full-width on mobile

CREATOR PROFILE PAGE:
- Service offer cards must stack vertically on mobile
- Portfolio sample grid must reduce to 1 column on mobile
- The intro video embed must be responsive (aspect-ratio: 16/9, width: 100%)

PROJECT BOARD:
- Project cards must be full-width on mobile
- The filter/sort controls must collapse into a single row or a dropdown on mobile
- The project detail modal must be scrollable on small screens

TESTING REQUIREMENT:
After making changes, verify on these breakpoints: 375px, 768px, 1024px, 1440px.
Call out any component where mobile behavior required a compromise and explain why.

Do not restructure any business logic.
Do not touch src/data/rates.js.
```

---

## Run Order Reference

| Priority | Prompt | Feature | Depends On |
|----------|--------|---------|-----------|
| 1 | Prompt 6 | Legal pages + acceptance tracking | Nothing |
| 2 | Prompt 7 | Creator recruitment landing page | Nothing |
| 3 | Prompt 1 | Support ticket system | Nothing |
| 4 | Prompt 3 | Admin operations + violations | Nothing |
| 5 | Prompt 5 | SEO + email waitlist capture | Nothing |
| 6 | Prompt 4 | Platform search | Nothing |
| 7 | Prompt 2 | Creator earnings + admin finance | Prompt 3 (violations table) |
| 8 | Prompt 9 | Admin analytics dashboard | Prompts 1, 3, 5 (tables) |
| 9 | Prompt 8 | Accessibility audit | All pages from above prompts |
| 10 | Prompt 11 | Transactional email notifications | Prompt 1 (support tickets) |
| 11 | Prompt 12 | Brand voice copy audit | All pages from above prompts |
| 12 | Prompt 13 | Data export and CSV reporting | Prompts 2, 9 |
| 13 | Prompt 10 | Creator agreement PDF generation | Prompt 6 (legal_acceptances) |
| 14 | Prompt 14 | Mobile optimization pass | All of the above |

**Prompts 1, 3, 4, 5, 6, 7 touch different parts of the codebase and can run in parallel.**
**Prompts 8, 12, 14 are audit passes — always run last after the feature prompts they audit.**
