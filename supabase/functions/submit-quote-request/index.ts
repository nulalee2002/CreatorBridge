import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  );
}

async function verifyTurnstile(req: Request, token: string) {
  const secret =
    Deno.env.get('TURNSTILE_SECRET_KEY') ||
    Deno.env.get('CLOUDFLARE_SECRET_KEY') ||
    '';

  if (!secret) {
    return { ok: false, status: 500, error: 'Turnstile secret is not configured' };
  }

  if (!token) {
    return { ok: false, status: 400, error: 'Security check is required' };
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  const ip = clientIp(req);
  if (ip) formData.append('remoteip', ip);

  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });
  const outcome = await result.json();

  if (!outcome?.success) {
    return { ok: false, status: 403, error: 'Security check failed' };
  }

  return { ok: true, status: 200, error: '' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 8, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const body = await req.json();
    const { turnstileToken, ...quotePayload } = body || {};

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const verification = await verifyTurnstile(req, String(turnstileToken || ''));
    if (!verification.ok) {
      return new Response(
        JSON.stringify({ error: verification.error }),
        { status: verification.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error } = await supabase.rpc('submit_quote_request', quotePayload);
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid quote request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
