import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, 'supabase/migrations');
const sql = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
  .join('\n')
  .toLowerCase();
const helperPath = join(root, 'src/lib/platformIntelligence.js');
const helper = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';

const checks = [];
const expect = (name, passed) => checks.push({ name, passed: Boolean(passed) });

expect('versioned event definitions', /create table(?: if not exists)? public\.platform_event_definitions/.test(sql));
expect('append-only platform event ledger', /create table(?: if not exists)? public\.platform_events/.test(sql));
expect('transactional event outbox', /create table(?: if not exists)? public\.platform_event_outbox/.test(sql));
expect('authority contract', sql.includes("authority in ('server_authoritative', 'browser_directional')"));
expect('event idempotency', /idempotency_key text not null unique/.test(sql));
expect('definition version foreign key', /foreign key \(event_name, event_version\)/.test(sql));
expect('event ledger RLS', sql.includes('alter table public.platform_events enable row level security'));
expect('ordinary event reads revoked', /revoke all on table public\.platform_events from (?:public, )?anon, authenticated/.test(sql));
expect('directional event RPC', /public\.record_directional_platform_event\s*\(/.test(sql));
expect('privileged insertion lives in private schema', /creatorbridge_private\.insert_directional_platform_event\s*\(/.test(sql));
expect('browser actor comes from auth uid', /actor_id[\s\S]{0,200}\(select auth\.uid\(\)\)/.test(sql));
expect('forbidden property keys rejected', ['message', 'body', 'content', 'file', 'workspace_contents', 'email', 'phone', 'address', 'payment_token'].every((key) => sql.includes(`'${key}'`)));
expect('arbitrary directional keys rejected', sql.includes('allowed_property_keys'));
expect('email-shaped values rejected', sql.includes('directional properties cannot contain email addresses'));
expect('phone-shaped values rejected', sql.includes('directional properties cannot contain phone numbers'));
expect('platform-wide definitions seeded', ['auth.', 'onboarding.', 'discovery.', 'quote.', 'project.', 'booking.', 'collaboration.', 'payment.', 'network.', 'workspace.', 'delivery.', 'review.', 'dispute.', 'support.', 'referral.', 'retention.', 'rehire.', 'admin.'].every((prefix) => sql.includes(prefix)));
expect('non-blocking browser helper', helper.includes('export async function recordDirectionalEvent') && helper.includes('return { recorded: false'));
expect('caller cannot provide actor identity', helper.includes('name, version, entityType, entityId, surface, properties') && !helper.includes('actorId'));

const failures = checks.filter(({ passed }) => !passed);
if (failures.length) {
  console.error(`Platform Intelligence is incomplete (${failures.length} missing contracts):`);
  for (const { name } of failures) console.error(`- ${name}`);
  process.exit(1);
}

const liveConfig = {
  url: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  creatorEmail: process.env.CREATORBRIDGE_QA_CREATOR_EMAIL,
  creatorPassword: process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD,
};

let live = null;
if (Object.values(liveConfig).every(Boolean)) {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const creator = createClient(liveConfig.url, liveConfig.anonKey, options);
  const service = createClient(liveConfig.url, liveConfig.serviceKey, options);
  const { error: authError } = await creator.auth.signInWithPassword({
    email: liveConfig.creatorEmail,
    password: liveConfig.creatorPassword,
  });
  if (authError) throw authError;

  let eventId = null;
  let temporaryUserId = null;
  let temporaryProjectId = null;
  try {
    const rpc = (properties) => creator.rpc('record_directional_platform_event', {
      p_event_name: 'onboarding.intro_viewed',
      p_event_version: 1,
      p_entity_type: 'creator_dashboard',
      p_entity_id: null,
      p_surface: 'creator_dashboard',
      p_properties: properties,
    });

    const { data: validEventId, error: validError } = await rpc({ surface: 'creator_dashboard' });
    if (validError) throw validError;
    eventId = validEventId;

    const rejectionCases = [
      { label: 'private content key', properties: { message: 'never store this' } },
      { label: 'email-shaped value', properties: { surface: 'person@example.com' } },
      { label: 'phone-shaped value', properties: { surface: '602-555-1212' } },
      { label: 'unregistered key', properties: { campaign: 'unregistered' } },
    ];
    for (const testCase of rejectionCases) {
      const { error } = await rpc(testCase.properties);
      if (!error) throw new Error(`Directional RPC accepted ${testCase.label}.`);
    }

    const { error: readError } = await creator.from('platform_events').select('id').limit(1);
    if (!readError || readError.code !== '42501') {
      throw new Error('Ordinary creator could read the private event ledger.');
    }

    const { data: storedEvent, error: storedEventError } = await service
      .from('platform_events')
      .select('authority,actor_id,properties')
      .eq('id', eventId)
      .single();
    if (storedEventError) throw storedEventError;
    if (storedEvent.authority !== 'browser_directional' || !storedEvent.actor_id) {
      throw new Error('Directional event did not preserve server-assigned authority and actor.');
    }

    const { data: temporaryAuth, error: temporaryAuthError } = await service.auth.admin.createUser({
      email: `qa-platform-intelligence-${crypto.randomUUID()}@example.invalid`,
      email_confirm: true,
      user_metadata: { role: 'client', full_name: 'QA Intelligence Outbox' },
    });
    if (temporaryAuthError) throw temporaryAuthError;
    temporaryUserId = temporaryAuth.user.id;

    const { data: temporaryProject, error: temporaryProjectError } = await service
      .from('projects')
      .insert({
        client_id: temporaryUserId,
        title: 'QA Platform Intelligence outbox',
        description: 'Temporary automated event capture fixture.',
        status: 'closed',
      })
      .select('id')
      .single();
    if (temporaryProjectError) throw temporaryProjectError;
    temporaryProjectId = temporaryProject.id;

    const { data: outboxEvent, error: outboxError } = await service
      .from('platform_event_outbox')
      .select('event_name,status,entity_id')
      .eq('entity_id', temporaryProjectId)
      .eq('event_name', 'project.created')
      .single();
    if (outboxError) throw outboxError;
    if (outboxEvent.status !== 'pending') throw new Error('Authoritative outbox event was not queued.');

    live = {
      validDirectionalEventRecorded: true,
      privateContentRejected: true,
      emailRejected: true,
      phoneRejected: true,
      arbitraryPropertyRejected: true,
      ordinaryLedgerReadBlocked: true,
      actorAssignedByServer: true,
      authoritativeOutboxQueued: true,
    };
  } finally {
    if (eventId) await service.from('platform_events').delete().eq('id', eventId);
    if (temporaryProjectId) {
      await service.from('platform_event_outbox').delete().eq('entity_id', temporaryProjectId);
      await service.from('projects').delete().eq('id', temporaryProjectId);
    }
    if (temporaryUserId) await service.auth.admin.deleteUser(temporaryUserId);
    await creator.auth.signOut();
  }
}

console.log(JSON.stringify({ ok: true, checks: checks.length, live }, null, 2));
