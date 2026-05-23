# CreatorBridge Environment Readiness

This checklist is for preview and production readiness. It names required variables only. Do not paste secret values into this file.

## Vercel Variables

Required in Preview and Production:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STRIPE_PUBLISHABLE_KEY
```

Optional, but needed for those integrations:

```bash
VITE_TURNSTILE_SITE_KEY
VITE_GOOGLE_CLIENT_ID
```

Do not set these as `VITE_` variables:

```bash
VITE_SUPABASE_SERVICE_ROLE_KEY
VITE_STRIPE_SECRET_KEY
VITE_STRIPE_WEBHOOK_SECRET
VITE_ANTHROPIC_API_KEY
```

Anything prefixed with `VITE_` is exposed to the browser. That is fine for publishable keys and public site keys. It is not fine for secret keys.

## Supabase Edge Function Secrets

Required in Supabase Edge Function secrets:

```bash
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SITE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PLATFORM_JOB_SECRET
TURNSTILE_SECRET_KEY
```

Supabase provides `SUPABASE_URL` and service role access to Edge Functions, but verify them through the Supabase secrets screen or CLI before release. Current Supabase docs confirm Edge Functions read secrets with `Deno.env.get(...)`, and production secrets can be managed with `supabase secrets set` and inspected by name with `supabase secrets list`.

`PLATFORM_JOB_SECRET` is used only for trusted server-side jobs such as future auto-approval payout release. It should never be placed in a frontend `.env` file or sent from the browser.

## Current Release Risk

`SupportChatbot.jsx` previously referenced `VITE_ANTHROPIC_API_KEY`. That browser-side key path has been removed because it could expose the Anthropic key to visitors. The safer next fix is to move chatbot AI calls behind a Supabase Edge Function or another backend endpoint, then store the Anthropic key only in backend secrets.

Until that backend chatbot endpoint exists, the chatbot should use the built-in demo/platform response fallback instead of exposing a live Anthropic key to visitors.

## Storage Security

CreatorBridge user uploads must stay private by default. The storage migration creates these private buckets:

```bash
creator-portfolio
creator-intros
client-assets
project-attachments
project-deliveries
```

Every upload path should start with the authenticated user's id, for example:

```bash
{user_id}/portfolio/{file_name}
{user_id}/projects/{project_id}/{file_name}
```

Do not make these buckets public to make previews easier. Portfolio previews, intro videos, client assets, and paid project deliveries should be exposed later through signed URLs or a server function that verifies the viewer is allowed to see the file. Public marketing images belong in the repository `public/images` folder, not in user upload buckets.

## Verification Commands

Run:

```bash
npm run audit:env
npm run qa
```

Use Vercel to verify names per environment:

```bash
vercel env ls preview
vercel env ls production
```

Use Supabase to verify Edge Function secret names:

```bash
supabase secrets list
```

The checks should confirm names only. Do not print or paste secret values into chat, docs, commits, screenshots, or logs.
