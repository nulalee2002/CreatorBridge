import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = path => readFileSync(join(root, path), 'utf8');

const migrationName = readdirSync(join(root, 'supabase/migrations'))
  .find(name => name.endsWith('_harden_creator_onboarding.sql'));
expect(Boolean(migrationName), 'Missing harden_creator_onboarding migration');

if (migrationName) {
  const sql = source(`supabase/migrations/${migrationName}`);
  for (const expected of [
    'revoke execute on function public.get_project_client_id(uuid) from public, anon',
    'revoke execute on function public.user_has_project_application(uuid, uuid) from public, anon',
    'and p.client_id = auth.uid()',
    'p_user_id is distinct from auth.uid()',
    'alter policy "Project participants can view projects"',
    'alter policy "Applications viewable by project owner and applicant"',
    'create or replace function public.creator_listing_meets_approval_requirements',
    'create or replace function public.creator_listing_is_public_ready',
    'create or replace function public.submit_creator_application',
    'Creator profile is not ready for approval',
    'Choose a valid primary pillar and 1 to 3 matching specialties',
    'Portfolio specialties must match the selected creator specialties',
    'Re-review required after readiness hardening',
    'creator_listing_is_public_ready(cl.id)',
  ]) {
    expect(sql.includes(expected), `Creator onboarding migration missing: ${expected}`);
  }
}

const directory = source('src/components/CreatorDirectory.jsx');
expect(
  directory.includes("rpc('submit_creator_application'"),
  'Creator application must save through the atomic submit_creator_application RPC',
);
expect(
  !directory.includes("savedListing = enriched;\n      }"),
  'Creator application must not fall back to a local-only success after a database failure',
);
expect(
  directory.includes("navigate('/dashboard?onboarding=application-submitted')"),
  'Successful creator application must continue to the dashboard onboarding checklist',
);
expect(
  directory.includes('setFormError(error?.message'),
  'Creator application failures must remain visible to the creator',
);
expect(
  !directory.includes('Optional reputation signals'),
  'Creator applications must not accept self-reported ratings or review counts',
);

const admin = source('src/pages/AdminDashboard.jsx');
expect(
  admin.includes('disabled={submittingAction || !item.approval_ready}'),
  'Admin dashboard approval must be disabled when server readiness is false',
);

const adminOperations = source('src/pages/AdminOperations.jsx');
expect(
  adminOperations.includes('disabled={working === c.listing_id || !c.approval_ready}'),
  'Admin operations approval must be disabled when server readiness is false',
);

const search = source('src/pages/Search.jsx');
expect(
  search.includes('creator_listing_is_public_ready'),
  'Global creator search must use the server-side public readiness rule',
);

const pkg = JSON.parse(source('package.json'));
expect(
  pkg.dependencies?.['react-router-dom'] === '7.18.1',
  'react-router-dom must be pinned to 7.18.1, which fixes the applicable client-side advisories',
);
expect(
  pkg.overrides?.dompurify === '3.4.12',
  'DOMPurify must be pinned through overrides to the audited safe version 3.4.12',
);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  atomicApplication: true,
  approvalGuard: true,
  publicSearchGuard: true,
  rpcPrivilegesHardened: true,
  dependencyPins: true,
}, null, 2));
