import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import {
  buildIdentitySessionParams,
  IDENTITY_CONSENT_VERSION,
  validateIdentityPurpose,
} from '../_shared/identityPolicy.js';

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

function auditIp(req: Request) {
  const raw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  return /^[0-9a-fA-F:.]+$/.test(raw) ? raw : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const rateLimited = await checkRateLimit(req, { maxRequests: 5, windowMs: 60_000, failClosed: true });
  if (rateLimited) return rateLimited;

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const siteUrl = Deno.env.get('SITE_URL')?.trim() || 'http://localhost:5174';
    if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Identity verification is not configured yet.' }, 503);
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in before verifying your identity.' }, 401);
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: 'Sign in before verifying your identity.' }, 401);

    const body = await req.json().catch(() => ({}));
    const purpose = validateIdentityPurpose(body?.purpose);
    if (body?.consentVersion !== IDENTITY_CONSENT_VERSION || body?.consented !== true) {
      return json({ error: 'Accept the current identity and live-selfie notice before continuing.' }, 400);
    }

    const { data: latestIdentity, error: trustError } = await admin
      .from('identity_verifications')
      .select('status')
      .eq('user_id', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (trustError) throw trustError;
    if (latestIdentity?.status === 'verified') {
      return json({ ok: true, alreadyVerified: true, status: 'verified' });
    }
    if (['manual_review', 'duplicate_restricted', 'rejected', 'reverification_required'].includes(latestIdentity?.status)) {
      return json({
        error: 'This identity check requires support review before another attempt.',
        code: String(latestIdentity.status || '').toUpperCase(),
      }, 409);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { data: existing } = await admin
      .from('identity_verifications')
      .select('id,provider_session_id,status,attempt_count,purpose')
      .eq('user_id', authData.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.provider_session_id) {
      const session = await stripe.identity.verificationSessions.retrieve(existing.provider_session_id);
      if (session.status === 'requires_input' && session.url) {
        return json({ ok: true, url: session.url, status: 'pending', reused: true });
      }
      if (session.status === 'processing' || session.status === 'verified') {
        return json({ ok: true, pending: true, status: 'pending', reused: true });
      }
    }

    const consentRow = {
      user_id: authData.user.id,
      consent_version: IDENTITY_CONSENT_VERSION,
      purpose,
      accepted_at: new Date().toISOString(),
      ip_address: auditIp(req),
      user_agent: req.headers.get('user-agent') || null,
    };
    const { data: insertedConsent, error: consentInsertError } = await admin
      .from('identity_consents')
      .upsert(consentRow, {
        onConflict: 'user_id,consent_version,purpose',
        ignoreDuplicates: true,
      })
      .select('id')
      .maybeSingle();
    if (consentInsertError) throw consentInsertError;

    let consent = insertedConsent;
    if (!consent) {
      const { data: existingConsent, error: consentLookupError } = await admin
        .from('identity_consents')
        .select('id')
        .eq('user_id', authData.user.id)
        .eq('consent_version', IDENTITY_CONSENT_VERSION)
        .eq('purpose', purpose)
        .single();
      if (consentLookupError || !existingConsent) throw consentLookupError || new Error('Identity consent could not be recorded.');
      consent = existingConsent;
    }

    const { data: latestAttempt } = await admin
      .from('identity_verifications')
      .select('attempt_count')
      .eq('user_id', authData.user.id)
      .eq('purpose', purpose)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const attemptCount = Number(latestAttempt?.attempt_count || 0) + 1;
    if (attemptCount > 3) {
      return json({ error: 'Your identity check needs secure support review before another attempt.', code: 'IDENTITY_REVIEW_REQUIRED' }, 409);
    }

    const params = buildIdentitySessionParams({
      userId: authData.user.id,
      purpose,
      siteUrl,
    });
    const session = await stripe.identity.verificationSessions.create(params, {
      idempotencyKey: `identity_${authData.user.id}_${purpose}_${consent.id}_${attemptCount}`,
    });
    if (!session.url) throw new Error('Stripe did not return a secure verification URL.');

    const { error: verificationError } = await admin.from('identity_verifications').insert({
      user_id: authData.user.id,
      consent_id: consent.id,
      provider_session_id: session.id,
      purpose,
      status: 'pending',
      attempt_count: attemptCount,
      updated_at: new Date().toISOString(),
    });
    if (verificationError) {
      await stripe.identity.verificationSessions.cancel(session.id).catch(() => undefined);
      if (verificationError.code === '23505') {
        const { data: concurrent } = await admin
          .from('identity_verifications')
          .select('provider_session_id')
          .eq('user_id', authData.user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (concurrent?.provider_session_id) {
          const active = await stripe.identity.verificationSessions.retrieve(concurrent.provider_session_id);
          if (active.url) return json({ ok: true, url: active.url, status: 'pending', reused: true });
        }
      }
      throw verificationError;
    }

    return json({ ok: true, url: session.url, status: 'pending' });
  } catch (error) {
    console.error('create-identity-session error:', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof Error ? error.message : 'Identity verification could not be started.' }, 500);
  }
});
