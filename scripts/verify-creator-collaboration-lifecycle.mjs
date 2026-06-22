import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sql = readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8')).join('\n').toLowerCase();
const files = [
  'src/components/creator/HireCollaboratorButton.jsx',
  'src/components/collaboration/CollaborationComposer.jsx',
  'src/components/collaboration/CreatorCollaborationIntro.jsx',
  'src/pages/CreatorHiringDashboard.jsx',
];
const ui = files.map((f) => existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : '').join('\n');
const profile = readFileSync(join(root, 'src/pages/CreatorProfilePage.jsx'), 'utf8');
const dashboard = readFileSync(join(root, 'src/pages/CreatorDashboard.jsx'), 'utf8');

const checks = [];
const expect = (name, pass) => checks.push({ name, pass: Boolean(pass) });
expect('collaboration lifecycle table', sql.includes('create table if not exists public.creator_collaborations'));
for (const state of ['invited','accepted','funding_pending','funded','in_progress','delivered','revision','approved','disputed','completed','declined','cancelled']) expect(`state ${state}`, sql.includes(`'${state}'`));
expect('self hire blocked', sql.includes('cannot hire yourself'));
expect('approved target required', sql.includes("review_status = 'approved'"));
expect('$250 floor enforced', sql.includes('p_amount_cents < 25000'));
expect('prime ownership enforced', sql.includes("array['prime_contractor']"));
expect('outside client isolated by RLS', sql.includes('creator collaboration members can read'));
expect('subcontractor participant created', sql.includes("'subcontractor'"));
expect('directional sub-floor event', sql.includes("collaboration.sub_floor_attempted"));
expect('profile collaborator CTA', ui.includes('Hire as a Collaborator') && profile.includes('HireCollaboratorButton'));
expect('active project CTA', ui.includes('Add to This Project'));
expect('outside client quote CTA', profile.includes('Request a Quote'));
expect('dashboard team CTA', dashboard.includes('Build Your Team'));
expect('finishing team language', ui.includes('Find Your Finishing Team'));
expect('collaboration badge', ui.includes('Open to Creator Collaborations'));
expect('two hiring paths', ui.includes('Attach to an existing project') && ui.includes('Create a standalone collaboration'));
expect('required disclosures', ['$250 minimum','ACH','processing cost','private team workspace','will not see the subcontractor'].every((text) => ui.includes(text)));
expect('first visit guidance', ui.includes('one account') && ui.includes('offer services') && ui.includes('hire collaborators'));
expect('forbidden wording absent', !ui.includes("Let's subcontract"));

const failed = checks.filter((c) => !c.pass);
if (failed.length) {
  console.error(`Creator collaboration lifecycle incomplete (${failed.length}):`);
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}

const config = {
  url: process.env.VITE_SUPABASE_URL,
  anon: process.env.VITE_SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  creatorEmail: process.env.CREATORBRIDGE_QA_CREATOR_EMAIL,
  creatorPassword: process.env.CREATORBRIDGE_QA_CREATOR_PASSWORD,
  clientEmail: process.env.CREATORBRIDGE_QA_CLIENT_EMAIL,
  clientPassword: process.env.CREATORBRIDGE_QA_CLIENT_PASSWORD,
};
let live = null;
if (Object.values(config).every(Boolean)) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const prime = createClient(config.url, config.anon, opts);
  const client = createClient(config.url, config.anon, opts);
  const service = createClient(config.url, config.service, opts);
  const target = createClient(config.url, config.anon, opts);
  const { data: primeAuth, error: primeAuthError } = await prime.auth.signInWithPassword({ email: config.creatorEmail, password: config.creatorPassword });
  if (primeAuthError) throw primeAuthError;
  const { error: clientAuthError } = await client.auth.signInWithPassword({ email: config.clientEmail, password: config.clientPassword });
  if (clientAuthError) throw clientAuthError;
  let targetUserId; let targetListingId; let collaborationId; let projectId;
  try {
    const { data: primeListing, error: primeListingError } = await service.from('creator_listings').select('*').eq('user_id', primeAuth.user.id).eq('review_status', 'approved').limit(1).single();
    if (primeListingError) throw primeListingError;
    const selfHire = await prime.rpc('create_creator_collaboration', { p_collaborator_listing_id: primeListing.id, p_project_id: null, p_scope: 'A complete professional self hire rejection test.', p_amount_cents: 25000, p_deadline: '2030-01-01', p_service_category: 'Post Production', p_workspace_provider: 'frame_io' });
    if (!selfHire.error) throw new Error('Self-hire was not rejected.');

    const password = `QA-${crypto.randomUUID()}-aA1!`;
    const { data: tempAuth, error: tempAuthError } = await service.auth.admin.createUser({ email: `qa-collaborator-${crypto.randomUUID()}@example.invalid`, password, email_confirm: true, user_metadata: { role: 'creator', full_name: 'QA Collaborator' } });
    if (tempAuthError) throw tempAuthError;
    targetUserId = tempAuth.user.id;
    const copy = { ...primeListing };
    for (const key of ['id','created_at','updated_at','search_vector']) delete copy[key];
    Object.assign(copy, { user_id: targetUserId, name: 'QA Collaborator', business_name: 'QA Collaborator Studio', email: `qa-${targetUserId}@example.invalid`, stripe_account_id: null, review_status: 'approved', open_to_creator_collaborations: true });
    const { data: targetListing, error: targetListingError } = await service.from('creator_listings').insert(copy).select('id').single();
    if (targetListingError) throw targetListingError;
    targetListingId = targetListing.id;

    const belowFloor = await prime.rpc('create_creator_collaboration', { p_collaborator_listing_id: targetListingId, p_project_id: null, p_scope: 'A complete professional below-floor rejection test.', p_amount_cents: 24999, p_deadline: '2030-01-01', p_service_category: 'Post Production', p_workspace_provider: 'frame_io' });
    if (!belowFloor.error) throw new Error('Below-floor collaboration was not rejected.');

    const created = await prime.rpc('create_creator_collaboration', { p_collaborator_listing_id: targetListingId, p_project_id: null, p_scope: 'Edit and color a complete campaign deliverable with two review rounds.', p_amount_cents: 50000, p_deadline: '2030-01-01', p_service_category: 'Post Production', p_workspace_provider: 'frame_io' });
    if (created.error) throw created.error;
    collaborationId = created.data;
    const { data: row, error: rowError } = await service.from('creator_collaborations').select('project_id,status').eq('id', collaborationId).single();
    if (rowError) throw rowError;
    projectId = row.project_id;

    const { data: clientRows, error: clientRowsError } = await client.from('creator_collaborations').select('id').eq('id', collaborationId);
    if (clientRowsError) throw clientRowsError;
    if (clientRows.length) throw new Error('Outside client could read a private collaboration.');

    const { error: targetAuthError } = await target.auth.signInWithPassword({ email: tempAuth.user.email, password });
    if (targetAuthError) throw targetAuthError;
    const accepted = await target.rpc('respond_creator_collaboration', { p_collaboration_id: collaborationId, p_accept: true });
    if (accepted.error) throw accepted.error;
    const { data: acceptedRow } = await service.from('creator_collaborations').select('status').eq('id', collaborationId).single();
    if (acceptedRow.status !== 'accepted') throw new Error('Collaborator acceptance did not persist.');
    live = { selfHireBlocked: true, floorEnforced: true, standaloneCreated: true, outsideClientIsolated: true, collaboratorAccepted: true };
  } finally {
    if (collaborationId) await service.from('creator_collaborations').delete().eq('id', collaborationId);
    if (projectId) await service.from('projects').delete().eq('id', projectId);
    if (targetListingId) await service.from('creator_listings').delete().eq('id', targetListingId);
    if (targetUserId) await service.auth.admin.deleteUser(targetUserId);
    await Promise.all([prime.auth.signOut(), client.auth.signOut(), target.auth.signOut()]);
  }
}
console.log(JSON.stringify({ ok: true, checks: checks.length, live }, null, 2));
