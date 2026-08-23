import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const audit = readFileSync(join(root, 'scripts/audit-env.mjs'), 'utf8');

test('environment audit inspects tracked source and production build without echoing matches', () => {
  assert.match(audit, /git['"], \['ls-files', '-z'\]/);
  assert.match(audit, /scanSecretSignatures\(tracked/);
  assert.match(audit, /scanSecretSignatures\(filesBelow\('dist'\)/);
  assert.match(audit, /Tracked environment file is not allowed/);
  assert.doesNotMatch(audit, /console\.(?:log|error)\([^\n]*match\[0\]/);
});

test('environment audit covers current server-only project completion secrets', () => {
  for (const name of ['PLATFORM_JOB_SECRET', 'RATE_LIMIT_HASH_SECRET', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.match(audit, new RegExp(name));
  }
});
