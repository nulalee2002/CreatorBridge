# CreatorBridge Chatbot AI Operations

Updated: 2026-06-03

Bridge is meant to be a real platform assistant, not a generic FAQ widget. It should help clients and creators understand booking, project briefs, fees, payments, creator approval, disputes, scope control, dashboards, support tickets, and the 24-hour response rule.

## Operating Model

Bridge uses a hybrid model:

1. Built-in platform guide answers common CreatorBridge questions for free.
2. Guided flows handle booking requests, creator quote help, and support-ticket routing without paid AI.
3. Paid Anthropic/Claude AI is used only for custom or nuanced support questions that the built-in guide cannot answer well.

This keeps the chatbot useful while preventing casual testing or repeated FAQ questions from draining credits.

## Current Guardrails

- Common platform questions do not call paid AI.
- Prompt-injection and security-bypass requests are blocked before AI.
- Contact information is blocked in chatbot booking/support text.
- Guest browser sessions are limited to 8 paid-AI replies.
- Logged-in browser sessions are limited to 16 paid-AI replies.
- Supabase Edge Function rate limit remains active.
- The Edge Function caps chat history, message size, system prompt size, and max response tokens.
- If paid AI is unavailable, Bridge falls back to platform-guide mode instead of breaking.

## Enabling Paid AI

Paid AI is controlled by Supabase Edge Function secrets, not browser environment variables.

To enable paid AI after confirming the Anthropic account has funds:

```bash
cd "/Volumes/2Work 1-Drive/Claude & ChatGPT/content-pricing-calc"
supabase secrets set CHATBOT_AI_ENABLED=true --project-ref mxizhszqhbhxzkkhgnmg
supabase secrets set ANTHROPIC_MODEL=claude-3-5-haiku-20241022 --project-ref mxizhszqhbhxzkkhgnmg
supabase secrets set ANTHROPIC_MAX_TOKENS=220 --project-ref mxizhszqhbhxzkkhgnmg
supabase functions deploy chatbot --project-ref mxizhszqhbhxzkkhgnmg
npm run verify:chatbot-ai
```

If the account balance is low or the model starts failing, disable paid AI without breaking the chatbot:

```bash
supabase secrets set CHATBOT_AI_ENABLED=false --project-ref mxizhszqhbhxzkkhgnmg
supabase functions deploy chatbot --project-ref mxizhszqhbhxzkkhgnmg
npm run verify:chatbot-guide
```

## Launch Recommendation

Launch with the hybrid assistant enabled only if the Anthropic balance is funded and `npm run verify:chatbot-ai` passes. The default paid model is `claude-3-5-haiku-20241022` so custom help uses a low-cost Haiku path instead of a more expensive model. If funds are not ready, launch with guide mode; users still get platform-specific support, booking guidance, support-ticket routing, and scope-control help.
