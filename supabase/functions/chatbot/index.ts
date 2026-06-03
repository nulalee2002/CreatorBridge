import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHAT_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1600;

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

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
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

    // Split system message from chat history
    const systemMsg = messages.find((m: { role: string }) => m.role === 'system');
    const chatMessages = messages
      .filter((m: { role: string }) => m.role !== 'system')
      .slice(-MAX_CHAT_MESSAGES)
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content || '').slice(0, MAX_MESSAGE_CHARS),
      }));

    if (chatMessages.length === 0) {
      return jsonResponse({ error: 'no chat messages provided' }, 400);
    }

    const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-3-5-haiku-20241022';
    const maxTokens = Number(Deno.env.get('ANTHROPIC_MAX_TOKENS') || 220);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: Number.isFinite(maxTokens) ? Math.min(Math.max(maxTokens, 80), 360) : 220,
        system: String(systemMsg?.content || '').slice(0, 8000),
        messages: chatMessages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return jsonResponse({
        error: 'AI service error',
        providerStatus: response.status,
        ...providerErrorMessage(errBody),
      }, 502);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
    if (!reply) return jsonResponse({ error: 'empty AI response' }, 502);

    const usage = data.usage || {};
    return jsonResponse({ reply, provider: 'Anthropic', model, usage });
  } catch (err) {
    console.error('chatbot function error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});
