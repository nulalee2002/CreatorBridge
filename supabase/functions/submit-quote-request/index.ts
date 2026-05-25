import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

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
      return jsonResponse({ error: 'Authentication required', stage: 'auth' }, 401);
    }

    const verification = await verifyTurnstile(req, String(turnstileToken || ''));
    if (!verification.ok) {
      return jsonResponse({ error: verification.error, stage: 'turnstile' }, verification.status);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Quote service is not configured', stage: 'config' }, 500);
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.rpc('submit_quote_request', quotePayload);
    if (error) {
      return jsonResponse({ error: error.message, stage: 'database' }, 400);
    }

    if (!data?.project?.id || !data?.quote?.id) {
      return jsonResponse({ error: 'Quote request saved without a complete project record', stage: 'database' }, 500);
    }

    const listingId = quotePayload?.p_listing_id;
    if (listingId) {
      try {
        const { data: listing } = await supabaseAdmin
          .from('creator_listings')
          .select('email, business_name, name')
          .eq('id', listingId)
          .maybeSingle();

        if (listing?.email) {
          await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              to: listing.email,
              template: 'quote_request_received',
              data: {
                creator_name: listing.business_name || listing.name || 'Creator',
                client_name: data.quote?.client_name || 'A client',
                project_title: data.project?.title || data.quote?.project_title || 'CreatorBridge project',
              },
            }),
          });
        }
      } catch (emailError) {
        console.error('Quote request email notification failed:', emailError);
      }
    }

    return jsonResponse(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid quote request';
    return jsonResponse({ error: message, stage: 'request' }, 400);
  }
});
