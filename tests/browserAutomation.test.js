import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');

test('Playwright launch matrix covers public, authenticated, desktop, and mobile projects', () => {
  assert.equal(existsSync(join(root, 'playwright.config.js')), true);
  const config = read('playwright.config.js');
  for (const project of ['auth-setup', 'public-desktop', 'public-mobile', 'authenticated-desktop', 'authenticated-mobile']) {
    assert.match(config, new RegExp(project));
  }
  assert.match(config, /trace:\s*'retain-on-failure'/);
  assert.match(config, /screenshot:\s*'only-on-failure'/);
  assert.match(config, /video:\s*'retain-on-failure'/);
});

test('browser completion coverage uses disposable QA records and scoped cleanup', () => {
  const setup = read('e2e/auth.setup.js');
  const helper = read('e2e/helpers/qa.js');
  const completion = read('e2e/project-completion.spec.js');
  assert.match(setup, /CREATORBRIDGE|signInQa/);
  assert.match(helper, /cleanupQaProjects/);
  assert.match(completion, /finally/);
  assert.match(completion, /5_000_000_001/);
  assert.match(completion, /Purchase one revision for \$50\.00/);
  assert.match(completion, /project_delivery_holds/);
  assert.match(completion, /final_payment_attention/);
  assert.match(completion, /get_or_create_project_conversation/);
});

test('launch sweep includes every new project-completion security gate', () => {
  const sweep = read('scripts/verify-launch-sweep.mjs');
  for (const command of [
    'verify:launch-trust-guards',
    'verify:two-revisions',
    'verify:revision-ledgers',
    'verify:paid-revisions',
    'verify:project-deliveries',
    'verify:project-review-jobs',
    'verify:final-payment-policy',
    'verify:public-launch-cleanup',
    'verify:distributed-rate-limits',
    'test:e2e',
  ]) assert.match(sweep, new RegExp(command));
});
