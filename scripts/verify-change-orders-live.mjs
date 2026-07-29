import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log('SKIP: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(0);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const table of [
  'contract_change_orders',
  'change_order_signatures',
  'change_order_payments',
  'project_guide_acknowledgments',
]) {
  const { error } = await admin.from(table).select('*', { head: true, count: 'exact' });
  assert(!error, `${table} is unavailable: ${error?.message}`);
}

const missingProjectId = randomUUID();
const changeOrders = await admin.rpc('get_project_change_orders', { p_project_id: missingProjectId });
assert(Boolean(changeOrders.error), 'Unknown projects must not expose a change-order collection');
const documents = await admin.rpc('get_project_documents', { p_project_id: missingProjectId });
assert(Boolean(documents.error), 'Unknown projects must not expose a document collection');

for (const functionName of [
  'generate-change-order',
  'sign-change-order',
  'create-change-order-payment',
]) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert(response.status !== 404, `${functionName} is not deployed`);
  assert(response.status < 500, `${functionName} failed its unauthenticated health probe with ${response.status}`);
}

console.log(JSON.stringify({
  ok: true,
  changeOrderTablesReachable: true,
  unauthorizedProjectLookupBlocked: true,
  changeOrderFunctionsDeployed: true,
}, null, 2));
