import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionQaTrust } from '../scripts/lib/qaTrust.mjs';

function fakeAdmin(failTable, originalPhone = null, failOperation = null) {
  const calls = [];
  const admin = { from(table) {
    let operation;
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve) => {
        calls.push({ table, ...operation });
        if (operation.type === 'select' && table === 'account_phone_verifications') return resolve({ data: originalPhone });
        if (table === failTable && (failOperation ? operation.type === failOperation : operation.type !== 'delete')) return resolve({ error: new Error('injected setup failure') });
        return resolve({ data: operation.type === 'insert' ? { id: `${table}-fixture` } : null });
      };
      return (...args) => { if (['select', 'insert', 'delete', 'upsert'].includes(method) && !operation) operation = { type: method, payload: args[0] }; return query; };
    } });
    return query;
  } };
  return { admin, calls };
}

test('identity read failure restores the existing phone record', async () => {
  const original = { user_id: 'qa', status: 'pending', provider_service_reference: 'original' };
  const { admin, calls } = fakeAdmin('identity_verifications', original);
  await assert.rejects(provisionQaTrust(admin, 'qa'), /injected setup failure/);
  assert.deepEqual(calls.at(-1).payload, original);
});

test('failed identity insert removes its consent and temporary phone', async () => {
  const { admin, calls } = fakeAdmin('identity_verifications', null, 'insert');
  await assert.rejects(provisionQaTrust(admin, 'qa'), /injected setup failure/);
  assert.deepEqual(calls.filter(c => c.type === 'delete').map(c => c.table), ['identity_consents', 'account_phone_verifications']);
});
