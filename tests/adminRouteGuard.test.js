import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const guardUrl = new URL('../src/components/auth/AdminRequired.jsx', import.meta.url);

test('uses a dedicated admin guard on every admin route', () => {
  assert.equal(existsSync(guardUrl), true, 'AdminRequired.jsx must exist');
  for (const route of ['/admin', '/admin/support', '/admin/operations', '/admin/finance', '/admin/analytics']) {
    const routeIndex = appSource.indexOf(`path="${route}"`);
    assert.notEqual(routeIndex, -1, `${route} route must exist`);
    const routeBlock = appSource.slice(routeIndex, routeIndex + 520);
    assert.match(routeBlock, /<AdminRequired\b/, `${route} must use AdminRequired`);
    assert.doesNotMatch(routeBlock, /<AuthRequired\b/, `${route} must not mount through the client guard`);
  }
});

test('checks the server admin roster before rendering child content', () => {
  assert.equal(existsSync(guardUrl), true, 'AdminRequired.jsx must exist');
  const source = readFileSync(guardUrl, 'utf8');
  assert.match(source, /rpc\(['"]is_platform_admin['"]\)/);
  assert.match(source, /setAllowed\(data === true\)/);
  assert.match(source, /if \(allowed === true\)/);
  assert.match(source, /return children/);
  assert.match(source, /Access denied/);
});
