import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = path => readFileSync(join(root, path), 'utf8');

function filesBelow(path) {
  const output = [];
  for (const entry of readdirSync(join(root, path))) {
    const relative = join(path, entry);
    if (statSync(join(root, relative)).isDirectory()) output.push(...filesBelow(relative));
    else output.push(relative);
  }
  return output;
}

test('public Network has no fabricated people, activity, counts, or local fallbacks', () => {
  const source = read('src/pages/NetworkingPage.jsx');
  for (const forbidden of ['net-seed-', 'm-seed-', 'MOCK_STATES', 'MOCK_CHAT', 'SEED_NETWORK_POSTS', 'fallbackUsers', 'cm-network-posts', 'cm-state-chat-']) {
    assert.equal(source.includes(forbidden), false, `Network still contains ${forbidden}`);
  }
  assert.match(source, /data provider is not configured/i);
  assert.match(source, /No verified members have been active/i);
});

test('support address is centralized and recipient addresses are not logged', () => {
  assert.equal(existsSync(join(root, 'src/config/support.js')), true);
  for (const file of filesBelow('src').filter(file => file !== 'src/config/support.js')) {
    assert.equal(read(file).includes('drl33@creatorbridge.studio'), false, `${file} contains a scattered support literal`);
  }
  for (const file of filesBelow('supabase/functions').filter(file => file !== 'supabase/functions/_shared/support.ts')) {
    assert.equal(read(file).includes('drl33@creatorbridge.studio'), false, `${file} contains a scattered server support literal`);
  }
  const email = read('supabase/functions/send-notification-email/index.ts');
  const notifications = read('src/lib/notifications.js');
  assert.doesNotMatch(email, /Would send email to \$\{to\}/);
  assert.doesNotMatch(notifications, /email to \$\{to\}/);
});

test('canonical sitemap exists and robots points to it', () => {
  const sitemapPath = join(root, 'public/sitemap.xml');
  assert.equal(existsSync(sitemapPath), true);
  const sitemap = readFileSync(sitemapPath, 'utf8');
  assert.match(sitemap, /https:\/\/www\.creatorbridge\.studio\//);
  assert.match(read('public/robots.txt'), /Sitemap:\s*https:\/\/www\.creatorbridge\.studio\/sitemap\.xml/i);
});

test('release source contains no named launch QA identity', () => {
  const retiredQaName = ['Marcus', 'Reed'].join(' ');
  for (const path of ['src', 'scripts', 'tests']) {
    for (const file of filesBelow(path)) {
      assert.equal(read(file).includes(retiredQaName), false, `${file} still contains the launch QA identity`);
    }
  }
});

test('heavy application routes and vendor libraries are split deliberately', () => {
  const app = read('src/App.jsx');
  const vite = read('vite.config.js');
  assert.match(app, /React\.lazy|lazy\(/);
  assert.match(app, /Suspense/);
  assert.match(vite, /manualChunks/);
  assert.match(vite, /zoom/i);
  assert.match(vite, /pdf/i);
});
