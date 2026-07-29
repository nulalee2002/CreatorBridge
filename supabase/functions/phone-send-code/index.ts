import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { normalizePhoneE164 } from '../_shared/phoneVerification.js';

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

  const rateLimited = checkRateLimit(req, { maxRequests: 5, windowMs: 60_000 });
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

    const { phone } = await req.json().catch(() => ({}));
    const normalizedPhone = normalizePhoneE164(phone);
    const now = new Date().toISOString();
    const { data: existing } = await admin
      .from('account_phone_verifications')
      .select('phone_e164,attempt_count')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const attemptCount = existing?.phone_e164 === normalizedPhone
      ? Number(existing.attempt_count || 0) + 1
      : 1;

    const { error: trustError } = await admin.from('account_phone_verifications').upsert({
      user_id: userData.user.id,
      phone_e164: normalizedPhone,
      status: 'pending',
      verified_at: null,
      provider: 'twilio',
      provider_service_reference: verifyServiceSid,
      last_sent_at: now,
      attempt_count: attemptCount,
      updated_at: now,
    }, { onConflict: 'user_id' });
    if (trustError) throw trustError;

    await admin
      .from('client_profiles')
      .update({
        phone: normalizedPhone,
        phone_verified: false,
        phone_verified_at: null,
        updated_at: now,
      })
      .eq('user_id', userData.user.id);

    const twilioResponse = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: normalizedPhone, Channel: 'sms' }),
      },
    );

    if (!twilioResponse.ok) {
      const provider = await twilioResponse.json().catch(() => ({}));
      return json({
        error: provider?.message || 'Could not send verification code.',
        providerStatus: twilioResponse.status,
      }, 502);
    }

    return json({ ok: true, phone: normalizedPhone, phoneVerified: false });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Phone code could not be sent.' }, 400);
  }
});
