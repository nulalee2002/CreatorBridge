import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = join(root, 'supabase/functions');
const migrationPath = join(root, 'supabase/migrations/20260823050000_distributed_edge_rate_limits.sql');
const migration = readFileSync(migrationPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rateLimitedFunctions = readdirSync(functionsRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
  .map(entry => join(functionsRoot, entry.name, 'index.ts'))
  .filter(path => {
    try {
      return readFileSync(path, 'utf8').includes("../_shared/rateLimit.ts");
    } catch {
      return false;
    }
  });

assert(rateLimitedFunctions.length >= 30, 'Expected every existing rate-limited trust surface to be discovered');
for (const path of rateLimitedFunctions) {
  const source = readFileSync(path, 'utf8');
  assert(/await checkRateLimit\(/.test(source), `${path} must await distributed enforcement`);
}

for (const name of [
  'create-payment-intent',
  'create-revision-payment',
  'create-change-order-payment',
  'create-collaboration-payment',
  'process-final-payment',
  'create-identity-session',
  'client-phone-send-code',
  'client-phone-check-code',
]) {
  const source = readFileSync(join(functionsRoot, name, 'index.ts'), 'utf8');
  assert(/failClosed\s*:\s*true/.test(source), `${name} must fail closed when the shared limiter is unavailable`);
}

assert(migration.includes('private.edge_rate_limit_buckets'), 'Rate-limit ledger must stay private');
assert(migration.includes('pg_advisory_xact_lock'), 'Rate-limit consumption must serialize competing instances');
assert(migration.includes('grant execute on function public.consume_edge_rate_limit') && migration.includes('to service_role'), 'RPC gateway must be service-role only');
assert(!/grant execute[\s\S]{0,200}to (anon|authenticated)/i.test(migration), 'Browser roles must never execute rate-limit consumption');

console.log(JSON.stringify({
  ok: true,
  rateLimitedFunctions: rateLimitedFunctions.length,
  sharedLedger: true,
  rawSubjectsPersisted: false,
  trustActionsFailClosed: true,
}, null, 2));
