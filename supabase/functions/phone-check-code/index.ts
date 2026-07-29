import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { normalizePhoneE164, normalizeVerificationCode } from '../_shared/phoneVerification.js';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

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

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before verifying your phone.' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Sign in before verifying your phone.' }, 401);

    const { phone, code } = await req.json().catch(() => ({}));
    const normalizedPhone = normalizePhoneE164(phone);
    const normalizedCode = normalizeVerificationCode(code);
    const { data: trust } = await admin
      .from('account_phone_verifications')
      .select('phone_e164,status')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!trust || trust.phone_e164 !== normalizedPhone || trust.status !== 'pending') {
      return json({ error: 'Request a new verification code for this phone number.' }, 409);
    }

    const twilioResponse = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: normalizedPhone, Code: normalizedCode }),
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
    const { data: updated, error: trustError } = await admin
      .from('account_phone_verifications')
      .update({
        status: 'verified',
        verified_at: now,
        updated_at: now,
      })
      .eq('user_id', userData.user.id)
      .eq('phone_e164', normalizedPhone)
      .eq('status', 'pending')
      .select('user_id')
      .maybeSingle();
    if (trustError || !updated) {
      return json({ error: 'Phone verification state changed. Request a new code.' }, 409);
    }

    await admin
      .from('client_profiles')
      .update({
        phone: normalizedPhone,
        phone_verified: true,
        phone_verified_at: now,
        updated_at: now,
      })
      .eq('user_id', userData.user.id);

    return json({
      ok: true,
      phone: normalizedPhone,
      phoneVerified: true,
      phoneVerifiedAt: now,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Phone code could not be checked.' }, 400);
  }
});
