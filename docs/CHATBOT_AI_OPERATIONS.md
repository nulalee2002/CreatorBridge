# CreatorBridge Chatbot AI Operations

Updated: 2026-06-08

Bridge is meant to be a real platform assistant, not a generic FAQ widget. It should help clients and creators understand booking, project briefs, fees, payments, creator approval, disputes, scope control, dashboards, support tickets, and the 24-hour response rule.

## Operating Model

Bridge now uses a cost-protected hybrid model:

1. Built-in platform guide answers common CreatorBridge questions for free.
2. Guided flows handle booking requests, creator quote help, and support-ticket routing without paid AI.
3. Live paid AI is an explicit escalation button for logged-in users only.
4. Human support tickets handle account, payment, dispute, and private support issues.

This keeps Bridge useful before launch traffic grows, while preventing casual testing, guests, or repeated FAQ questions from draining AI credits.

## Current Guardrails

- Common platform questions do not call paid AI.
- Guests cannot call paid AI.
- Logged-in users must click `Use live AI help`; paid AI is never called automatically.
- Paid AI is account-scoped with a Supabase daily quota through `chatbot_ai_usage_daily`.
- Default daily quota is 3 live AI assists per user unless `CHATBOT_AI_DAILY_QUOTA` is changed.
- Prompt-injection and security-bypass requests are blocked before AI.
- Contact information is blocked in chatbot booking/support text.
- Supabase Edge Function rate limit remains active.
- The Edge Function caps chat history, message size, system prompt size, and max response tokens.
- If paid AI is unavailable, Bridge falls back to platform-guide mode and support-ticket escalation instead of breaking.

## Paid AI Provider

The paid layer is now configured for OpenAI by default:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`, default `gpt-4.1-mini`
- `OPENAI_MAX_TOKENS`, default `220`
- `CHATBOT_AI_DAILY_QUOTA`, default `3`
- `CHATBOT_AI_ENABLED`, set to `true` or `false`

The previous Anthropic/Claude path was removed from the active Edge Function because testing showed the Anthropic account could hit low-credit failures before real launch traffic.

## Enabling Paid AI

Paid AI is controlled by Supabase Edge Function secrets, not browser environment variables.

```bash
cd "/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc"
supabase secrets set OPENAI_API_KEY="YOUR_OPENAI_KEY" --project-ref mxizhszqhbhxzkkhgnmg
supabase secrets set OPENAI_MODEL=gpt-4.1-mini --project-ref mxizhszqhbhxzkkhgnmg
supabase secrets set OPENAI_MAX_TOKENS=220 --project-ref mxizhszqhbhxzkkhgnmg
supabase secrets set CHATBOT_AI_DAILY_QUOTA=3 --project-ref mxizhszqhbhxzkkhgnmg
supabase secrets set CHATBOT_AI_ENABLED=true --project-ref mxizhszqhbhxzkkhgnmg
supabase functions deploy chatbot --project-ref mxizhszqhbhxzkkhgnmg
npm run verify:chatbot-ai
```

If OpenAI funding, quota, or provider access is not ready, disable paid AI without breaking the chatbot:

```bash
supabase secrets set CHATBOT_AI_ENABLED=false --project-ref mxizhszqhbhxzkkhgnmg
supabase functions deploy chatbot --project-ref mxizhszqhbhxzkkhgnmg
npm run verify:chatbot-guide
```

## Launch Recommendation

Launch with Bridge in platform-guide mode first. Enable live AI only after:

- the OpenAI key is installed in Supabase secrets,
- `supabase db push --linked` has applied the daily quota migration,
- `npm run verify:chatbot-ai` passes,
- the daily quota is set low enough for the current support budget.

The launch-safe check remains `npm run verify:chatbot-guide`; paid AI is useful but should not block launch readiness.
