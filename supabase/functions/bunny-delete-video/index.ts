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

function cleanVideoId(value: unknown) {
  const raw = String(value || '').replace(/^bunny:/, '').trim();
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(raw)) throw new Error('Invalid Bunny video id.');
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const libraryId = Deno.env.get('BUNNY_STREAM_LIBRARY_ID');
    const apiKey = Deno.env.get('BUNNY_STREAM_API_KEY');

    if (!supabaseUrl || !serviceRoleKey || !libraryId || !apiKey) {
      return json({ error: 'Bunny Stream is not configured yet.' }, 503);
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before removing video.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Sign in before removing video.' }, 401);

    const { videoId: rawVideoId } = await req.json().catch(() => ({}));
    const videoId = cleanVideoId(rawVideoId);

    const [{ data: introRows }, { data: portfolioRows }] = await Promise.all([
      admin
        .from('creator_listings')
        .select('id')
        .eq('user_id', userData.user.id)
        .eq('video_intro_url', `bunny:${videoId}`)
        .limit(1),
      admin
        .from('portfolio_items')
        .select('id, creator_listings!inner(user_id)')
        .eq('bunny_video_id', videoId)
        .eq('creator_listings.user_id', userData.user.id)
        .limit(1),
    ]);

    const isReferencedByUser = (introRows?.length || 0) > 0 || (portfolioRows?.length || 0) > 0;
    if (!isReferencedByUser) {
      return json({ error: 'This video is not attached to your profile.' }, 403);
    }

    const deleteResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      method: 'DELETE',
      headers: { AccessKey: apiKey },
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const provider = await deleteResponse.json().catch(() => ({}));
      return json({
        error: provider?.message || 'Bunny video could not be deleted.',
        providerStatus: deleteResponse.status,
      }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Video could not be removed.' }, 400);
  }
});
