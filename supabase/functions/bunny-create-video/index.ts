import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanTitle(value: unknown) {
  return String(value || 'CreatorBridge video')
    .replace(/[^\w\s.,:()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'CreatorBridge video';
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rateLimited = checkRateLimit(req, { maxRequests: 12, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const libraryId = Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
    const apiKey = Deno.env.get('BUNNY_STREAM_API_KEY');
    const playbackKey = Deno.env.get('BUNNY_STREAM_PLAYBACK_KEY');

    if (!supabaseUrl || !serviceRoleKey || !libraryId || !apiKey || !playbackKey) {
      return json({ error: 'Bunny Stream is not configured yet.' }, 503);
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before uploading video.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Sign in before uploading video.' }, 401);

    const body = await req.json().catch(() => ({}));
    const purpose = body?.purpose === 'intro' ? 'intro' : 'portfolio';
    const title = cleanTitle(`${purpose === 'intro' ? 'Intro' : 'Portfolio'} - ${body?.title || body?.fileName || userData.user.id}`);

    const createResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!createResponse.ok) {
      const provider = await createResponse.json().catch(() => ({}));
      return json({
        error: provider?.message || 'Bunny video could not be created.',
        providerStatus: createResponse.status,
      }, 502);
    }

    const created = await createResponse.json();
    const videoId = created?.guid;
    if (!videoId) return json({ error: 'Bunny did not return a video id.' }, 502);

    const expires = Math.floor(Date.now() / 1000) + 60 * 60;
    const signature = await sha256Hex(`${libraryId}${apiKey}${expires}${videoId}`);

    return json({
      ok: true,
      libraryId,
      videoId,
      videoRef: `bunny:${videoId}`,
      tusEndpoint: 'https://video.bunnycdn.com/tusupload',
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expires),
        VideoId: videoId,
        LibraryId: libraryId,
      },
      embedUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`,
      thumbnailUrl: `https://vz-${libraryId}.b-cdn.net/${videoId}/thumbnail.jpg`,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Video upload could not start.' }, 400);
  }
});
