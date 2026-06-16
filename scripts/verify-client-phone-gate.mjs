import { createClient } from '@supabase/supabase-js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx);
      if (env[key]) continue;
      env[key] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const clientVerification = read('src/components/ClientVerification.jsx');
const projectBoard = read('src/pages/ProjectBoard.jsx');
const migrations = [
  ...read('supabase/migrations/20260519120000_harden_project_budget_checkout.sql').split('\n'),
];
const migrationDir = new URL('supabase/migrations/', root);
const phoneGateMigration = readdirSync(migrationDir)
  .find(name => name.endsWith('_require_client_phone_verification_for_briefs.sql'));
if (phoneGateMigration) {
  migrations.push(...read(`supabase/migrations/${phoneGateMigration}`).split('\n'));
}
const migrationText = migrations.join('\n');

assert(
  existsSync(new URL('supabase/functions/client-phone-send-code/index.ts', root)),
  'Missing client-phone-send-code edge function'
);
assert(
  existsSync(new URL('supabase/functions/client-phone-check-code/index.ts', root)),
  'Missing client-phone-check-code edge function'
);
assert(
  clientVerification.includes("functions.invoke('client-phone-send-code'"),
  'ClientVerification must call client-phone-send-code'
);
assert(
  clientVerification.includes("functions.invoke('client-phone-check-code'"),
  'ClientVerification must call client-phone-check-code'
);
assert(
  !clientVerification.includes('Email confirmed'),
  'ClientVerification must not label mere email presence as Email confirmed'
);
assert(
  projectBoard.includes('phone_verified') && projectBoard.includes('verify your phone to post a brief'),
  'ProjectBoard UI must gate posting on phone verification with a clear prompt'
);
assert(
  migrationText.includes('phone_verified_at'),
  'Migration must add phone_verified_at'
);
assert(
  migrationText.includes('Client phone verification is required before posting a project brief'),
  'create_project_brief must block unverified clients'
);
assert(
  migrationText.includes('prevent_client_phone_verification_tamper'),
  'Migration must prevent clients from writing phone verification fields directly'
);

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const clientEmail = env.QA_CLIENT_EMAIL || env.CREATORBRIDGE_QA_CLIENT_EMAIL || 'drl33+client@creatorbridge.studio';
const clientPass = env.QA_CLIENT_PASS || env.CREATORBRIDGE_QA_CLIENT_PASSWORD;
const staticOnly = env.VERIFY_STATIC_ONLY === 'true';

if (!staticOnly && supabaseUrl && anonKey && serviceKey && clientPass) {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth, error: authError } = await client.auth.signInWithPassword({
    email: clientEmail,
    password: clientPass,
  });
  if (authError) throw authError;

  const userId = auth.user.id;
  const { data: originalProfile } = await admin
    .from('client_profiles')
    .select('phone, phone_verified, phone_verified_at, display_name, tos_accepted_at')
    .eq('user_id', userId)
    .maybeSingle();

  const baseProfile = {
    user_id: userId,
    display_name: originalProfile?.display_name || 'CreatorBridge QA Client',
    phone: originalProfile?.phone || '+16025550100',
    tos_accepted_at: originalProfile?.tos_accepted_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    await admin.from('client_profiles').upsert({
      ...baseProfile,
      phone_verified: false,
      phone_verified_at: null,
    }, { onConflict: 'user_id' });

    const blocked = await client.rpc('create_project_brief', {
      p_title: 'QA Phone Gate Blocked Brief',
      p_service_id: 'photography',
      p_description: 'This brief should be blocked until the client phone is verified by the CreatorBridge phone gate.',
      p_budget_min: 500,
      p_budget_max: 1500,
      p_project_duration: 'Half day',
      p_timeline: '2026-06-15',
      p_location: 'Phoenix, AZ',
    });
    assert(
      blocked.error?.message?.includes('Client phone verification is required'),
      `Unverified client should be blocked from posting. Got: ${blocked.error?.message || 'success'}`
    );

    await admin.from('client_profiles').upsert({
      ...baseProfile,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    const allowed = await client.rpc('create_project_brief', {
      p_title: 'QA Phone Gate Allowed Brief',
      p_service_id: 'photography',
      p_description: 'This brief should post because the QA client has a verified phone number and accepted platform terms.',
      p_budget_min: 500,
      p_budget_max: 1500,
      p_project_duration: 'Half day',
      p_timeline: '2026-06-15',
      p_location: 'Phoenix, AZ',
    });
    if (allowed.error) throw allowed.error;
    assert(allowed.data?.id, 'Verified client should be able to post a project brief');
    await admin.from('projects').delete().eq('id', allowed.data.id);
  } finally {
    if (originalProfile) {
      await admin.from('client_profiles').upsert({
        user_id: userId,
        phone: originalProfile.phone,
        phone_verified: originalProfile.phone_verified,
        phone_verified_at: originalProfile.phone_verified_at,
        display_name: originalProfile.display_name,
        tos_accepted_at: originalProfile.tos_accepted_at,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }
  }
}

console.log(JSON.stringify({
  ok: true,
  staticChecks: true,
  liveRpcChecks: !staticOnly && Boolean(supabaseUrl && anonKey && serviceKey && clientPass),
}, null, 2));
