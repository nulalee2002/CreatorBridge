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

function normalizePhone(input: unknown) {
  const raw = String(input || '').trim();
  const cleaned = raw.startsWith('+')
    ? `+${raw.slice(1).replace(/\D/g, '')}`
    : raw.replace(/\D/g, '');
  const normalized = cleaned.startsWith('+')
    ? cleaned
    : cleaned.length === 10
      ? `+1${cleaned}`
      : `+${cleaned}`;

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error('Enter a valid phone number with country code.');
  }
  return normalized;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rateLimited = checkRateLimit(req, { maxRequests: 8, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const verifyServiceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');

    if (!supabaseUrl || !serviceRoleKey || !accountSid || !authToken || !verifyServiceSid) {
      return json({ error: 'Phone verification is not configured yet.' }, 503);
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before verifying your phone.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Sign in before verifying your phone.' }, 401);

    const { phone, code } = await req.json().catch(() => ({}));
    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = String(code || '').trim();
    if (!/^\d{4,10}$/.test(normalizedCode)) {
      return json({ error: 'Enter the verification code sent by SMS.' }, 400);
    }

    const body = new URLSearchParams({ To: normalizedPhone, Code: normalizedCode });
    const twilioResponse = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );

    const provider = await twilioResponse.json().catch(() => ({}));
    if (!twilioResponse.ok || provider?.status !== 'approved') {
      return json({
        error: 'Invalid verification code.',
        providerStatus: twilioResponse.status,
      }, 400);
    }

    const now = new Date().toISOString();
    const { error: profileError } = await admin.from('client_profiles').upsert({
      user_id: userData.user.id,
      phone: normalizedPhone,
      phone_verified: true,
      phone_verified_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' });
    if (profileError) throw profileError;

    return json({ ok: true, phone: normalizedPhone, phoneVerified: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Phone code could not be checked.' }, 400);
  }
});
