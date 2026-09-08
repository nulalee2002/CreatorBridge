import assert from 'node:assert/strict';
import { seedCompletionProjects, cleanupQaProjects, signInQa } from '../e2e/helpers/qa.js';

const fixture = await seedCompletionProjects();
const project = fixture.projects[0];
const a = fixture.admin;
let creatorApi;
try {
  const auth = await signInQa('creator');
  creatorApi = auth.client;
  const delivery = await a.from('project_deliveries').insert({
    project_id: project.id, creator_user_id: auth.user.id, status: 'draft',
    idempotency_key: `cleanup-guard-${crypto.randomUUID()}`,
  }).select('id').single();
  if (delivery.error) throw delivery.error;
  const item = await a.from('project_delivery_items').insert({
    delivery_id: delivery.data.id, item_type: 'external', label: 'QA cleanup guard',
    external_url: 'https://drive.google.com/drive/folders/qa-cleanup-guard',
    size_bytes: 0, upload_status: 'uploaded', uploaded_at: new Date().toISOString(),
  }).select('id').single();
  if (item.error) throw item.error;
  const submitted = await a.from('project_deliveries').update({
    status: 'under_review', version: 1, submitted_at: new Date().toISOString(),
    review_started_at: new Date().toISOString(), review_deadline_at: new Date(Date.now()+432000000).toISOString(),
  }).eq('id', delivery.data.id);
  if (submitted.error) throw submitted.error;

  const creatorDelete = await creatorApi.from('project_delivery_items').delete().eq('id', item.data.id);
  const afterCreator = await a.from('project_delivery_items').select('id').eq('id', item.data.id).single();
  assert.ok(afterCreator.data, 'ordinary creator must not delete a submitted item');
  const update = await a.from('project_delivery_items').update({ label: 'altered' }).eq('id', item.data.id);
  assert.equal(update.error?.code, '42501', 'submitted content stays immutable even for service role');

  const renamed = await a.from('projects').update({ title: 'Unmarked cleanup rejection fixture' }).eq('id', project.id);
  if (renamed.error) throw renamed.error;
  try {
    const unmarked = await a.from('project_delivery_items').delete().eq('id', item.data.id);
    assert.equal(unmarked.error?.code, '42501', 'unmarked project must retain deletion protection');
  } finally {
    const restored = await a.from('projects').update({ title: project.title }).eq('id', project.id);
    if (restored.error) throw restored.error;
  }
  const allowed = await a.from('project_delivery_items').delete().eq('id', item.data.id).select('id');
  if (allowed.error) throw allowed.error;
  assert.equal(allowed.data.length, 1, 'only marked QA service deletion should succeed');
  console.log('PASS: ordinary creator blocked; unmarked project blocked; content updates blocked; marked QA service deletion succeeds');
} finally {
  await cleanupQaProjects(a, fixture.projectIds, fixture.phoneTrustState);
  await creatorApi?.auth.signOut({ scope: 'local' });
}
