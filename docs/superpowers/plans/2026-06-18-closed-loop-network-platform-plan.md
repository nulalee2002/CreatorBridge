# CreatorBridge Closed-Loop Network and Platform Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe CreatorBridge as a platform and let verified creators share an exact, existing portfolio project for feedback without permitting external links, direct network uploads, or gear commerce.

**Architecture:** Network posts store nullable creator-listing and portfolio-item foreign keys, validated in Postgres against ownership. React renders those trusted references as internal project cards and opens the exact portfolio item through a profile query parameter. Customer-facing terminology changes are copy-only; internal identifiers remain stable.

**Tech Stack:** React 18, React Router, Tailwind CSS, Supabase Postgres/RLS, Supabase JavaScript client, Node verification scripts, Vite.

---

### Task 1: Add failing contracts for language and network scope

**Files:**
- Create: `scripts/verify-platform-language.mjs`
- Create: `scripts/verify-network-portfolio-sharing.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the platform-language verification**

Create a script that scans customer-facing JSX, support knowledge, metadata, and legal copy. It must fail when lowercase `marketplace` remains outside `src/data/rates.js` internal identifiers. It must assert the preferred descriptor is present.

```js
assert(!customerFacingMatches.length, `Customer-facing marketplace copy remains:\n${customerFacingMatches.join('\n')}`);
assert(app.includes('verified media production platform'), 'Footer must use the approved platform descriptor');
```

- [ ] **Step 2: Write the network-sharing verification**

The script must assert that Gear Swap labels and the gear chat channel are absent, Portfolio Work & Feedback is present, no network file input exists, external linkification is gone, structured portfolio IDs are used, and the profile supports an exact portfolio query parameter.

```js
assert(!network.includes("label: 'Gear swap'"), 'Gear Swap must not be a network post type');
assert(!network.includes("setSelectedChannel('gear')"), 'Gear chat must be removed');
assert(network.includes('Portfolio Work & Feedback'), 'Portfolio feedback lane must exist');
assert(!network.includes('type="file"'), 'Network must remain text-first without direct uploads');
assert(profile.includes("searchParams.get('portfolio')"), 'Profile must open an exact shared portfolio item');
```

- [ ] **Step 3: Register and run both checks to prove RED**

Add `verify:platform-language` and `verify:network-portfolio-sharing` package scripts. Run both and confirm they fail on existing marketplace copy, Gear Swap UI, missing structured references, and missing profile deep-link behavior.

### Task 2: Add database-enforced portfolio project references

**Files:**
- Create with `supabase migration new`: `supabase/migrations/20260619030000_network_portfolio_project_sharing.sql`
- Modify: `scripts/verify-network-portfolio-sharing.mjs`

- [ ] **Step 1: Extend the failing verification for schema contracts**

Assert the migration adds named foreign keys for `creator_listing_id` and `portfolio_item_id`, adds `referral` to allowed post types, and installs a validation trigger.

```js
assert(sql.includes('creator_listing_id uuid'), 'Posts need a creator listing reference');
assert(sql.includes('portfolio_item_id uuid'), 'Posts need a portfolio item reference');
assert(sql.includes('validate_network_portfolio_share'), 'Ownership must be validated in Postgres');
```

- [ ] **Step 2: Create the migration**

Add nullable references and a before-insert/update trigger. For `post_type = 'portfolio'`, both references are required and the database must confirm that the portfolio item belongs to the listing, the listing belongs to `new.user_id`, and the listing is approved. For all other post types, set both references to null. Extend the allowed post type constraint with `referral` while retaining existing historical values.

```sql
alter table public.network_posts
  add column if not exists creator_listing_id uuid,
  add column if not exists portfolio_item_id uuid;

create or replace function public.validate_network_portfolio_share()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.post_type = 'portfolio' then
    if new.creator_listing_id is null or new.portfolio_item_id is null then
      raise exception 'Choose one of your portfolio projects before posting.' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.creator_listings listing
      join public.portfolio_items item on item.listing_id = listing.id
      where listing.id = new.creator_listing_id
        and item.id = new.portfolio_item_id
        and listing.user_id = new.user_id
        and listing.review_status = 'approved'
    ) then
      raise exception 'That portfolio project is not available to share.' using errcode = '23514';
    end if;
  else
    new.creator_listing_id := null;
    new.portfolio_item_id := null;
  end if;
  return new;
end;
$$;
```

- [ ] **Step 3: Run the contract check to prove the migration is GREEN**

Run `npm run verify:network-portfolio-sharing`. It may still fail on React behavior, but all schema assertions must pass.

### Task 3: Implement closed-loop portfolio selection and cards

**Files:**
- Modify: `src/pages/NetworkingPage.jsx`
- Modify: `scripts/verify-network-portfolio-sharing.mjs`

- [ ] **Step 1: Load the signed-in creator's approved portfolio**

Add state for `shareableListing`, `shareableProjects`, and `selectedPortfolioItemId`. Query the current user's approved creator listing with its `portfolio_items`, and expose only items with an internal image reference or Bunny video ID.

```js
const { data } = await supabase
  .from('creator_listings')
  .select('id,review_status,portfolio_items(id,title,description,image_url,media_type,bunny_video_id,service_id)')
  .eq('user_id', user.id)
  .eq('review_status', 'approved')
  .maybeSingle();
```

- [ ] **Step 2: Replace post types and chat channels**

Use these post choices: General Discussion, Portfolio Work & Feedback, Collaboration, Referral, Gig Lead, and Industry Discussion. Remove Gear Swap and remove the gear chat tab and seed messages. Rename the existing `portfolio` type from Referral to Portfolio Work & Feedback and add the distinct `referral` type.

- [ ] **Step 3: Add the portfolio project selector**

When `postType === 'portfolio'`, render a required select control populated from `shareableProjects`. If there are no projects, explain that the creator must add work to their profile first and disable submission.

```jsx
<select value={selectedPortfolioItemId} onChange={event => setSelectedPortfolioItemId(event.target.value)}>
  <option value="">Choose a portfolio project</option>
  {shareableProjects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
</select>
```

- [ ] **Step 4: Save structured references**

Insert `creator_listing_id` and `portfolio_item_id` only for portfolio feedback posts. Keep external URL and contact checks unchanged. Replace the old Project Board phrase ban with positive guidance; formal opportunities may be discussed, but the structured Project Board remains the booking path.

- [ ] **Step 5: Load portfolio card data with posts**

Extend the PostgREST select with the named foreign-key relationships and map the returned portfolio item into the post model.

```js
.select('*, portfolio_item:portfolio_items!network_posts_portfolio_item_id_fkey(id,title,description,image_url,media_type,bunny_video_id,service_id,listing_id)')
```

- [ ] **Step 6: Render an internal project card**

For a valid referenced item, render a charcoal-and-gold card under the post copy with the existing media preview, title, category, and `View project on CreatorBridge`. Use React Router `Link` to `/creator/${post.creator_listing_id}?portfolio=${item.id}`. If the item is unavailable, render `Portfolio project unavailable` without a link.

- [ ] **Step 7: Rewrite network guidance and disclaimer**

The composer guidance must welcome work feedback, referrals, collaborations, industry discussion, and internal Project Board leads. The rules must state that communication and bookings stay on CreatorBridge, external contact details are prohibited, and CreatorBridge does not facilitate or accept responsibility for private equipment arrangements.

- [ ] **Step 8: Run the network contract check to GREEN**

Run `npm run verify:network-portfolio-sharing` and confirm every network UI and structured-reference assertion passes.

### Task 4: Open the exact portfolio project from a shared card

**Files:**
- Modify: `src/pages/CreatorProfilePage.jsx`
- Modify: `scripts/verify-network-portfolio-sharing.mjs`

- [ ] **Step 1: Add stable portfolio anchors**

Give the portfolio section `id="portfolio-section"` and each item `id={`portfolio-${p.id}`}` so the selected work has a stable internal target.

- [ ] **Step 2: Read and validate the deep-link parameter**

Use `useSearchParams`. In `HandoffCreatorProfile`, find the referenced item only in the current profile's `portfolio` array. If found, open the existing lightbox and scroll the validated item into view. If not found, do nothing.

```js
const [searchParams] = useSearchParams();
useEffect(() => {
  const requestedId = searchParams.get('portfolio');
  const requestedItem = portfolio.find(item => String(item.id) === requestedId);
  if (!requestedItem) return;
  setLightbox(requestedItem);
  document.getElementById(`portfolio-${requestedItem.id}`)?.scrollIntoView({ block: 'center' });
}, [searchParams]);
```

- [ ] **Step 3: Run the network contract check and profile-media check**

Run `npm run verify:network-portfolio-sharing` and `npm run verify:profile-media`. Both must pass.

### Task 5: Replace customer-facing marketplace terminology

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/LandingPage.jsx`
- Modify: `src/pages/NetworkingPage.jsx`
- Modify: `src/pages/TermsPage.jsx`
- Modify: `src/pages/TermsOfService.jsx`
- Modify: `src/pages/CreatorAgreement.jsx`
- Modify: `src/components/TermsModal.jsx`
- Modify: `src/components/PrivacyModal.jsx`
- Modify: `src/components/SupportChatbot.jsx`
- Modify: `src/components/RequestQuoteModal.jsx`
- Modify: `src/components/BrandLogo.jsx`
- Modify: `src/components/CreatorDirectory.jsx`
- Modify: `src/data/supportKnowledge.js`
- Modify: `scripts/verify-platform-language.mjs`

- [ ] **Step 1: Replace public product descriptors**

Use `platform`, `professional platform`, or `verified media production platform` according to sentence context. Change `Marketplace Pulse` to `Platform Pulse`. Preserve internal identifiers such as `MARKETPLACE_CATEGORIES`, function names, and historical migration code.

- [ ] **Step 2: Update legal and privacy wording without changing substance**

Use `two-sided platform` for the operating model and `operate the platform` for data-use language. Do not change fees, user obligations, licenses, dispute terms, or liability rules.

- [ ] **Step 3: Run the platform-language check to GREEN**

Run `npm run verify:platform-language`. It must report no customer-facing marketplace copy while ignoring internal identifiers.

### Task 6: Verify, deploy, and hand off

**Files:**
- Modify: `scripts/verify-launch-sweep.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add both new checks to the launch sweep**

Run the platform-language and network-portfolio-sharing checks before live workflow checks.

- [ ] **Step 2: Apply and verify the Supabase migration**

Run a migration dry-run, apply only the new migration, and query the two new columns and trigger. Run a live test that proves an owner can share their own project and cannot share another creator's project; clean up all temporary rows.

- [ ] **Step 3: Run all automated checks**

Run `npm run verify:launch-sweep`, `npm run audit:platform`, `npm run verify:network`, `npm run verify:profile-media`, and `npm run build`. Expected result is zero failures.

- [ ] **Step 4: Run desktop and mobile browser checks**

At desktop and 390px widths, confirm the post-type controls contain no Gear Swap, the chat contains no gear channel, portfolio selection is usable, the card opens the exact project, the rules remain readable, external links are rejected, and no horizontal overflow or console errors appear.

- [ ] **Step 5: Commit and publish**

Commit the migration and security contracts separately from the UI/copy implementation where practical, push `main`, verify the production deployment, and rerun the internal project link on the deployed site.
