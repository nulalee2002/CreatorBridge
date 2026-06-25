import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 4, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return json({ error: 'Authentication required' }, 401);
    const body = await req.json().catch(() => ({}));
    const subjectUserId = body.subjectUserId || auth.user.id;
    const { data: isAdmin } = await admin.rpc('is_platform_admin', { p_user_id: auth.user.id });
    if (subjectUserId !== auth.user.id && !isAdmin) return json({ error: 'Admin access required for another subject' }, 403);

    const { data, error } = await admin.rpc('delete_platform_intelligence_subject', {
      p_subject_user_id: subjectUserId,
      p_requested_by: auth.user.id,
    });
    if (error) throw error;

    return json({ ok: true, deletion: data });
  } catch (error) {
    return json({ error: error?.message ?? 'Deletion request failed' }, 400);
  }
});
