import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDistributedRateLimit } from '../supabase/functions/_shared/distributedRateLimit.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');

globalThis.Deno = {
  env: { get: key => key === 'RATE_LIMIT_HASH_SECRET' ? 'a'.repeat(64) : undefined },
};

function sharedLedgerAdmin(clock) {
  const buckets = new Map();
  return {
    buckets,
    instance() {
      return {
        async rpc(_name, params) {
          assert.equal(Object.hasOwn(params, 'subject'), false);
          const key = `${params.p_action_key}:${params.p_subject_hash}`;
          const current = buckets.get(key);
          const expiresAt = clock.now + params.p_window_seconds * 1000;
          const next = !current || current.expiresAt <= clock.now
            ? { count: 1, expiresAt }
            : { ...current, count: current.count + 1 };
          buckets.set(key, next);
          return {
            data: [{
              allowed: next.count <= params.p_limit_count,
              remaining: Math.max(0, params.p_limit_count - next.count),
              retry_after_seconds: next.count <= params.p_limit_count ? 0 : Math.ceil((next.expiresAt - clock.now) / 1000),
            }],
            error: null,
          };
        },
      };
    },
  };
}

test('two edge instances share one quota and a new window resets it', async () => {
  const clock = { now: 1_000 };
  const ledger = sharedLedgerAdmin(clock);
  const options = { action: 'payment', subject: '203.0.113.4', limit: 2, windowSeconds: 60, failClosed: true };

  assert.equal((await checkDistributedRateLimit(ledger.instance(), options)).allowed, true);
  assert.equal((await checkDistributedRateLimit(ledger.instance(), options)).allowed, true);
  assert.equal((await checkDistributedRateLimit(ledger.instance(), options)).allowed, false);
  assert.equal([...ledger.buckets.keys()][0].includes(options.subject), false);

  clock.now += 61_000;
  assert.equal((await checkDistributedRateLimit(ledger.instance(), options)).allowed, true);
});

test('provider failure closes trust actions and degrades safely for low-risk actions', async () => {
  const unavailable = { rpc: async () => ({ data: null, error: { message: 'offline' } }) };
  const base = { action: 'test', subject: 'person@example.invalid', limit: 2, windowSeconds: 60 };
  assert.equal((await checkDistributedRateLimit(unavailable, { ...base, failClosed: true })).allowed, false);
  const lowRisk = await checkDistributedRateLimit(unavailable, { ...base, failClosed: false });
  assert.equal(lowRisk.allowed, true);
  assert.equal(lowRisk.degraded, true);
});

test('distributed limiter hashes subjects and never sends raw identifiers to the ledger', () => {
  assert.equal(existsSync(join(root, 'supabase/functions/_shared/distributedRateLimit.ts')), true);
  const source = read('supabase/functions/_shared/distributedRateLimit.ts');
  assert.match(source, /crypto\.subtle\.digest\(['"]SHA-256['"]/);
  assert.match(source, /RATE_LIMIT_HASH_SECRET/);
  assert.match(source, /subject_hash/);
  assert.doesNotMatch(source, /subject:\s*options\.subject/);
});

test('edge wrapper awaits shared enforcement and distinguishes fail-closed trust actions', () => {
  const wrapper = read('supabase/functions/_shared/rateLimit.ts');
  assert.match(wrapper, /checkDistributedRateLimit/);
  assert.match(wrapper, /failClosed/);
  assert.doesNotMatch(wrapper, /new Map/);

  for (const path of [
    'supabase/functions/create-payment-intent/index.ts',
    'supabase/functions/create-revision-payment/index.ts',
    'supabase/functions/create-identity-session/index.ts',
    'supabase/functions/client-phone-send-code/index.ts',
    'supabase/functions/client-phone-check-code/index.ts',
  ]) {
    const source = read(path);
    assert.match(source, /await checkRateLimit/);
    assert.match(source, /failClosed:\s*true/);
  }
});

test('migration uses one atomic conflict path, expiry reset, and scheduled pruning', () => {
  const migrationDir = join(root, 'supabase/migrations');
  const file = readFileSync(join(migrationDir, '20260823050000_distributed_edge_rate_limits.sql'), 'utf8');
  assert.match(file, /create table(?: if not exists)? private\.edge_rate_limit_buckets/i);
  assert.match(file, /insert into private\.edge_rate_limit_buckets[\s\S]*on conflict/i);
  assert.match(file, /window_expires_at\s*<=\s*clock_timestamp\(\)/i);
  assert.match(file, /pg_advisory_xact_lock/i);
  assert.match(file, /revoke all[\s\S]*anon[\s\S]*authenticated/i);
  assert.match(file, /grant execute[\s\S]*service_role/i);
  assert.match(file, /delete from private\.edge_rate_limit_buckets/i);
  assert.match(file, /cron\.schedule/i);
});
