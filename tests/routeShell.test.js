import test from 'node:test';
import assert from 'node:assert/strict';

import { getRouteShellClass } from '../src/lib/routeShell.js';

test('marks authenticated account routes for fixed-navigation clearance', () => {
  assert.equal(getRouteShellClass('/dashboard'), 'cb-inner-route cb-account-route');
  assert.equal(getRouteShellClass('/dashboard/build-team'), 'cb-inner-route cb-account-route');
  assert.equal(getRouteShellClass('/client'), 'cb-inner-route cb-account-route');
});

test('marks every admin route for its own fixed-navigation clearance', () => {
  assert.equal(getRouteShellClass('/admin'), 'cb-inner-route cb-admin-route');
  assert.equal(getRouteShellClass('/admin/support'), 'cb-inner-route cb-admin-route');
});

test('leaves public inner routes and the home route in their existing shells', () => {
  assert.equal(getRouteShellClass('/'), 'cb-home-route');
  assert.equal(getRouteShellClass('/find'), 'cb-inner-route');
});
