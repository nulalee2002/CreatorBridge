import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = token
      ? await supabaseAdmin.auth.getUser(token)
      : { data: { user: null }, error: new Error('Missing authorization token') };

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Authentication is required to record signup audit details' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawForwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const forwardedFor = /^[0-9a-fA-F:.]+$/.test(rawForwardedFor) ? rawForwardedFor : null;
    const userAgent = req.headers.get('user-agent') || null;

    await supabaseAdmin
      .from('profiles')
      .update({
        signup_ip: forwardedFor,
        signup_user_agent: userAgent,
      })
      .eq('id', authData.user.id)
      .is('signup_ip', null);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('record-signup-audit error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
