import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  const expected = Deno.env.get('PLATFORM_INTELLIGENCE_JOB_SECRET');
  if (expected && req.headers.get('x-job-secret') !== expected) {
    return json({ error: 'Unauthorized retention job' }, 401);
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc('retain_platform_intelligence');
    if (error) throw error;
    return json({ ok: true, retention: data });
  } catch (error) {
    return json({ error: error?.message ?? 'Retention job failed' }, 400);
  }
});
