import test from 'node:test';
import assert from 'node:assert/strict';

import { toLocalDateKey } from '../src/utils/dateKeys.js';

test('keeps the Phoenix calendar date after UTC has crossed midnight', () => {
  process.env.TZ = 'America/Phoenix';

  const eveningInPhoenix = new Date('2026-07-21T01:49:00Z');

  assert.equal(toLocalDateKey(eveningInPhoenix), '2026-07-20');
});
