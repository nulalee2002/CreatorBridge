import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 40, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'AI not configured' }, 503);
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return jsonResponse({ error: 'messages array required' }, 400);
    }

    // Split system message from chat history
    const systemMsg = messages.find((m: { role: string }) => m.role === 'system');
    const chatMessages = messages
      .filter((m: { role: string }) => m.role !== 'system')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    if (chatMessages.length === 0) {
      return jsonResponse({ error: 'no chat messages provided' }, 400);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        system: systemMsg?.content || '',
        messages: chatMessages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return jsonResponse({ error: 'AI service error' }, 502);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
    if (!reply) return jsonResponse({ error: 'empty AI response' }, 502);

    return jsonResponse({ reply });
  } catch (err) {
    console.error('chatbot function error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});
