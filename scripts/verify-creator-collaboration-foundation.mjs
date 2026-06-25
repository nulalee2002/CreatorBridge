import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'supabase/migrations');
const sources = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'));
const sql = sources.join('\n').toLowerCase();

const checks = [];
function expectContract(name, pattern) {
  const passed = typeof pattern === 'string' ? sql.includes(pattern) : pattern.test(sql);
  checks.push({ name, passed });
}

expectContract('account capabilities table', /create table(?: if not exists)? public\.account_capabilities/);
expectContract('client capability constraint', /capability[^;]+client/);
expectContract('creator capability constraint', /capability[^;]+creator/);
expectContract('admin capability constraint', /capability[^;]+admin/);
expectContract('unique capability membership', /(?:primary key|unique)\s*\(\s*user_id\s*,\s*capability\s*\)/);
expectContract('project participants table', /create table(?: if not exists)? public\.project_participants/);
expectContract('outside client participant role', /participant_role[^;]+outside_client/);
expectContract('prime contractor participant role', /participant_role[^;]+prime_contractor/);
expectContract('subcontractor participant role', /participant_role[^;]+subcontractor/);
expectContract('unique project participant membership', /(?:primary key|unique)\s*\(\s*project_id\s*,\s*user_id\s*\)/);
expectContract('capabilities RLS enabled', 'alter table public.account_capabilities enable row level security');
expectContract('participants RLS enabled', 'alter table public.project_participants enable row level security');
expectContract('private capability helper', /creatorbridge_private\.has_account_capability\s*\(/);
expectContract('private participant helper', /creatorbridge_private\.is_project_participant\s*\(/);
expectContract('authorization helpers use empty search path', /security definer\s+set search_path\s*=\s*''/);
expectContract('creator capability backfill', /insert into public\.account_capabilities[\s\S]+from public\.creator_listings/);
expectContract('client capability backfill', /insert into public\.account_capabilities[\s\S]+from public\.(?:client_profiles|projects)/);
expectContract('admin capability backfill', /insert into public\.account_capabilities[\s\S]+from public\.platform_admins/);
expectContract('ordinary capability writes revoked', /revoke (?:insert|all)[^;]+public\.account_capabilities[^;]+anon[^;]+authenticated/);
expectContract('ordinary participant writes revoked', /revoke (?:insert|all)[^;]+public\.project_participants[^;]+anon[^;]+authenticated/);

const failures = checks.filter(({ passed }) => !passed);
if (failures.length) {
  console.error(`Creator collaboration foundation is incomplete (${failures.length} missing contracts):`);
  for (const { name } of failures) console.error(`- ${name}`);
  process.exit(1);
}

const liveConfig = {
  url: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  creatorEmail: process.env.CREATORBRIDGE_QA_CREATOR_EMAIL,
  creatorPassword: process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD,
  clientEmail: process.env.CREATORBRIDGE_QA_CLIENT_EMAIL,
  clientPassword: process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD,
};

let live = null;
if (Object.values(liveConfig).every(Boolean)) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const creator = createClient(liveConfig.url, liveConfig.anonKey, options);
  const client = createClient(liveConfig.url, liveConfig.anonKey, options);
  const service = createClient(liveConfig.url, liveConfig.serviceKey, options);

  const { data: creatorAuth, error: creatorAuthError } = await creator.auth.signInWithPassword({
    email: liveConfig.creatorEmail,
    password: liveConfig.creatorPassword,
  });
  if (creatorAuthError) throw creatorAuthError;

  const { data: clientAuth, error: clientAuthError } = await client.auth.signInWithPassword({
    email: liveConfig.clientEmail,
    password: liveConfig.clientPassword,
  });
  if (clientAuthError) throw clientAuthError;

  let temporaryUserId = null;
  let temporaryProjectId = null;
  try {
    const { data: creatorCapabilities, error: creatorCapabilitiesError } = await creator
      .from('account_capabilities')
      .select('capability')
      .eq('user_id', creatorAuth.user.id);
    if (creatorCapabilitiesError) throw creatorCapabilitiesError;
    if (!creatorCapabilities.some(({ capability }) => capability === 'creator')) {
      throw new Error('QA creator is missing the trusted creator capability.');
    }

    const { data: clientCapabilities, error: clientCapabilitiesError } = await client
      .from('account_capabilities')
      .select('capability')
      .eq('user_id', clientAuth.user.id);
    if (clientCapabilitiesError) throw clientCapabilitiesError;
    if (!clientCapabilities.some(({ capability }) => capability === 'client')) {
      throw new Error('QA client is missing the trusted client capability.');
    }

    const { error: selfGrantError } = await creator.from('account_capabilities').insert({
      user_id: creatorAuth.user.id,
      capability: 'admin',
    });
    if (!selfGrantError || selfGrantError.code !== '42501') {
      throw new Error('Ordinary creator was not blocked from granting an admin capability.');
    }

    const { data: temporaryAuth, error: temporaryAuthError } = await service.auth.admin.createUser({
      email: `qa-collaboration-foundation-${crypto.randomUUID()}@example.invalid`,
      email_confirm: true,
      user_metadata: { role: 'client', full_name: 'QA Collaboration Isolation' },
    });
    if (temporaryAuthError) throw temporaryAuthError;
    temporaryUserId = temporaryAuth.user.id;

    const { data: temporaryProject, error: temporaryProjectError } = await service
      .from('projects')
      .insert({
        client_id: temporaryUserId,
        title: 'QA collaboration authorization isolation',
        description: 'Temporary automated security fixture.',
        status: 'closed',
      })
      .select('id')
      .single();
    if (temporaryProjectError) throw temporaryProjectError;
    temporaryProjectId = temporaryProject.id;
    const unrelatedProjectId = temporaryProjectId;

    if (unrelatedProjectId) {
      const { data: creatorLeak, error: creatorLeakError } = await creator
        .from('project_participants')
        .select('project_id,user_id,participant_role')
        .eq('project_id', unrelatedProjectId);
      if (creatorLeakError) throw creatorLeakError;
      if (creatorLeak.length !== 0) throw new Error('Creator could read unrelated project participation.');

      const { data: clientLeak, error: clientLeakError } = await client
        .from('project_participants')
        .select('project_id,user_id,participant_role')
        .eq('project_id', unrelatedProjectId);
      if (clientLeakError) throw clientLeakError;
      if (clientLeak.length !== 0) throw new Error('Client could read unrelated project participation.');

      const { error: membershipWriteError } = await creator.from('project_participants').insert({
        project_id: unrelatedProjectId,
        user_id: clientAuth.user.id,
        participant_role: 'subcontractor',
      });
      if (!membershipWriteError || membershipWriteError.code !== '42501') {
        throw new Error("Ordinary creator was not blocked from inserting another user's membership.");
      }
    }

    live = {
      creatorCapabilityVisible: true,
      clientCapabilityVisible: true,
      selfAdminGrantBlocked: true,
      unrelatedProjectIsolated: Boolean(unrelatedProjectId),
      foreignMembershipWriteBlocked: Boolean(unrelatedProjectId),
    };
  } finally {
    if (temporaryProjectId) await service.from('projects').delete().eq('id', temporaryProjectId);
    if (temporaryUserId) await service.auth.admin.deleteUser(temporaryUserId);
    await creator.auth.signOut();
    await client.auth.signOut();
  }
}

console.log(JSON.stringify({ ok: true, checks: checks.length, live }, null, 2));
