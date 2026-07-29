import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { CALL_CONSENT_TEXT } from '../_shared/callLegal.ts';

// Signs the Zoom Video SDK session JWT for a project call. The token is only
// issued after BOTH parties have recorded recording consent. Consent rows are
// written here so the caller's IP and user agent come from the request, not
// from client-supplied values.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function auditIp(req: Request) {
  const raw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  return /^[0-9a-fA-F:.]+$/.test(raw) ? raw : null;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signVideoSdkJwt(sdkKey: string, sdkSecret: string, payload: Record<string, unknown>) {
  const encoder = new TextEncoder();
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sdkSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`)));
  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

function firstNameOnly(fullName: string, fallback: string) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || '';
  return first ? first.slice(0, 40) : fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const rateLimited = checkRateLimit(req, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  try {
    // Fail closed: no signing material, no call tokens.
    const sdkKey = Deno.env.get('ZOOM_VIDEO_SDK_KEY') || '';
    const sdkSecret = Deno.env.get('ZOOM_VIDEO_SDK_SECRET') || '';
    if (!sdkKey || !sdkSecret) {
      return json({ error: 'Video calls are not configured on the server' }, 503);
    }

    const { callId, consent } = await req.json();
    if (!callId) return json({ error: 'callId is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: authData, error: authError } = token
      ? await admin.auth.getUser(token)
      : { data: { user: null }, error: new Error('Missing authorization token') };
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);
    const userId = authData.user.id;

    const { data: call, error: callError } = await admin
      .from('project_calls')
      .select('*')
      .eq('id', callId)
      .maybeSingle();
    if (callError || !call) return json({ error: 'Call not found' }, 404);

    const role = userId === call.creator_id ? 'creator' : userId === call.client_id ? 'client' : null;
    if (!role) return json({ error: 'Only the call parties can join this call' }, 403);

    const { data: trustRows, error: trustError } = await admin
      .rpc('require_verified_project_parties', { p_project_id: call.project_id });
    const trust = Array.isArray(trustRows) ? trustRows[0] : trustRows;
    if (trustError) {
      console.error('create-call-token identity gate error:', trustError);
      return json({ error: 'Identity status could not be verified', code: 'IDENTITY_GATE_UNAVAILABLE' }, 503);
    }
    if (!trust?.both_verified) {
      return json({
        error: 'Both project parties must complete identity verification before joining a call.',
        code: 'IDENTITY_VERIFICATION_REQUIRED',
      }, 409);
    }

    if (!['scheduled', 'in_progress'].includes(call.status)) {
      return json({ error: 'This call is not open to join' }, 409);
    }

    const scheduledAt = new Date(call.scheduled_at).getTime();
    const durationMs = Number(call.duration_minutes || 60) * 60_000;
    const now = Date.now();
    if (now < scheduledAt - 15 * 60_000) {
      return json({ error: 'The call room opens 15 minutes before the scheduled time' }, 409);
    }
    if (now > scheduledAt + durationMs + 30 * 60_000) {
      return json({ error: 'The scheduled window for this call has passed' }, 409);
    }

    // Record this party's consent when submitted. The wording must match the
    // canonical consent text exactly; anything else is rejected.
    if (consent) {
      const participantName = String(consent.participantName || '').trim();
      if (participantName.length < 2 || participantName.length > 160) {
        return json({ error: 'Enter your name to consent to recording' }, 400);
      }
      if (consent.consentText !== CALL_CONSENT_TEXT) {
        return json({ error: 'Recording consent wording mismatch. Refresh and try again.' }, 409);
      }
      const { error: consentError } = await admin
        .from('call_consents')
        .upsert({
          call_id: call.id,
          user_id: userId,
          role,
          participant_name: participantName,
          consent_text: CALL_CONSENT_TEXT,
          ip_address: auditIp(req),
          user_agent: req.headers.get('user-agent') || null,
        }, { onConflict: 'call_id,user_id', ignoreDuplicates: true });
      if (consentError) {
        console.error('create-call-token consent error:', consentError);
        return json({ error: 'Consent could not be recorded' }, 500);
      }
    }

    const { data: consents, error: consentsError } = await admin
      .from('call_consents')
      .select('user_id, role, consented_at')
      .eq('call_id', call.id);
    if (consentsError) return json({ error: 'Consent state could not be verified' }, 500);

    const consentedIds = new Set((consents || []).map((row) => row.user_id));
    const selfConsented = consentedIds.has(userId);
    const bothConsented = consentedIds.has(call.creator_id) && consentedIds.has(call.client_id);

    if (!selfConsented) {
      return json({ waiting: true, selfConsented: false, bothConsented: false });
    }
    if (!bothConsented) {
      return json({ waiting: true, selfConsented: true, bothConsented: false });
    }

    // Both parties consented: atomically open the call and establish one
    // shared start time for every participant's 60 minute deadline.
    const startedAtCandidate = new Date().toISOString();
    const { data: liveCall, error: liveCallError } = await admin
      .from('project_calls')
      .update({ status: 'in_progress' })
      .eq('id', call.id)
      .in('status', ['scheduled', 'in_progress'])
      .select('id, started_at')
      .maybeSingle();
    if (liveCallError) return json({ error: 'The call could not be opened' }, 500);
    if (!liveCall) return json({ error: 'This call is no longer open to join' }, 409);

    if (!liveCall.started_at) {
      const { error: startError } = await admin
        .from('project_calls')
        .update({ started_at: startedAtCandidate })
        .eq('id', call.id)
        .is('started_at', null);
      if (startError) return json({ error: 'The call start time could not be recorded' }, 500);
    }
    const { data: startedCall, error: startedCallError } = await admin
      .from('project_calls')
      .select('started_at')
      .eq('id', call.id)
      .single();
    if (startedCallError || !startedCall?.started_at) {
      return json({ error: 'The call start time could not be verified' }, 500);
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    const displayName = firstNameOnly(profile?.full_name || '', role === 'creator' ? 'Creator' : 'Client');

    const iat = Math.floor(now / 1000) - 30;
    const sessionEnd = Math.floor((scheduledAt + durationMs) / 1000);
    const exp = Math.max(iat + 1860, sessionEnd + 600);
    const jwt = await signVideoSdkJwt(sdkKey, sdkSecret, {
      app_key: sdkKey,
      tpc: call.zoom_session_name,
      role_type: role === 'creator' ? 1 : 0,
      user_identity: `${role}-${userId.slice(0, 8)}`,
      session_key: call.id,
      version: 1,
      iat,
      exp,
      cloud_recording_option: 1,
      cloud_recording_transcript_option: 1,
    });

    return json({
      token: jwt,
      sessionName: call.zoom_session_name,
      displayName,
      role,
      durationMinutes: Number(call.duration_minutes || 60),
      scheduledAt: call.scheduled_at,
      startedAt: startedCall.started_at,
      bothConsented: true,
      selfConsented: true,
    });
  } catch (error) {
    console.error('create-call-token error:', error);
    return json({ error: error instanceof Error ? error.message : 'Call token could not be created' }, 500);
  }
});
