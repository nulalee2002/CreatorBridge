import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHAT_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1600;
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_MAX_TOKENS = 220;
const DEFAULT_DAILY_QUOTA = 3;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function providerErrorMessage(errBody: string) {
  try {
    const parsed = JSON.parse(errBody);
    const message = parsed?.error?.message || parsed?.message;
    const type = parsed?.error?.type || parsed?.type;
    return {
      providerErrorType: typeof type === 'string' ? type : undefined,
      providerErrorMessage: typeof message === 'string' ? message.slice(0, 240) : undefined,
    };
  } catch {
    return { providerErrorMessage: errBody.slice(0, 240) };
  }
}

function clampInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    if (Deno.env.get('CHATBOT_AI_ENABLED') === 'false') {
      return jsonResponse({ error: 'AI disabled' }, 503);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Auth not configured' }, 503);
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse({ error: 'Live AI help requires a signed-in account' }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: 'Live AI help requires a valid signed-in account' }, 401);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'AI not configured' }, 503);
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: 'messages array required' }, 400);
    }

    if (messages.length > MAX_CHAT_MESSAGES + 1) {
      return jsonResponse({ error: 'too many messages' }, 400);
    }

    const dailyQuota = clampInteger(Deno.env.get('CHATBOT_AI_DAILY_QUOTA'), DEFAULT_DAILY_QUOTA, 0, 25);
    const quota = await supabase.rpc('consume_chatbot_ai_quota', {
      p_user_id: userData.user.id,
      p_limit: dailyQuota,
    });

    if (quota.error) {
      console.error('chatbot quota error:', quota.error);
      return jsonResponse({ error: 'AI quota check failed' }, 500);
    }

    const quotaRow = Array.isArray(quota.data) ? quota.data[0] : quota.data;
    if (!quotaRow?.allowed) {
      return jsonResponse({
        error: 'Daily live AI limit reached',
        dailyLimit: quotaRow?.daily_limit ?? dailyQuota,
        requestCount: quotaRow?.request_count ?? dailyQuota,
      }, 429);
    }

    const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL;
    const maxTokens = clampInteger(Deno.env.get('OPENAI_MAX_TOKENS'), DEFAULT_MAX_TOKENS, 80, 420);
    const safeMessages = messages
      .slice(-MAX_CHAT_MESSAGES - 1)
      .map((m: { role: string; content: string }) => ({
        role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
        content: String(m.content || '').slice(0, m.role === 'system' ? 8000 : MAX_MESSAGE_CHARS),
      }))
      .filter((m: { content: string }) => m.content.trim().length > 0);

    if (safeMessages.length === 0) {
      return jsonResponse({ error: 'no chat messages provided' }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.25,
        messages: safeMessages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenAI API error:', response.status, errBody);
      return jsonResponse({
        error: 'AI service error',
        providerStatus: response.status,
        ...providerErrorMessage(errBody),
      }, 502);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    if (!reply) return jsonResponse({ error: 'empty AI response' }, 502);

    return jsonResponse({
      reply,
      provider: 'OpenAI',
      model,
      usage: data.usage || {},
      dailyLimit: quotaRow.daily_limit ?? dailyQuota,
      requestCount: quotaRow.request_count ?? 1,
    });
  } catch (err) {
    console.error('chatbot function error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});
