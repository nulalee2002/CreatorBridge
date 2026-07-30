import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = path => readFileSync(join(root, path), 'utf8');
const collectSourceFiles = directory => readdirSync(join(root, directory), { withFileTypes: true })
  .flatMap(entry => {
    const relative = join(directory, entry.name);
    return entry.isDirectory() ? collectSourceFiles(relative) : [relative];
  })
  .filter(path => /\.(?:js|jsx|mjs)$/.test(path));

const migrationName = readdirSync(join(root, 'supabase/migrations'))
  .find(name => name.endsWith('_harden_creator_onboarding.sql'));
const allSql = readdirSync(join(root, 'supabase/migrations'))
  .filter(name => name.endsWith('.sql'))
  .sort()
  .map(name => source(`supabase/migrations/${name}`))
  .join('\n');
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
for (const expected of [
  'Phone verification is required before submitting a creator application',
  'Identity verification is required before submitting a creator application',
  'creatorbridge_private.user_phone_verified(cl.user_id)',
  'creatorbridge_private.user_identity_verified(cl.user_id)',
]) {
  expect(allSql.includes(expected), `Creator trust enforcement missing: ${expected}`);
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
  pkg.dependencies?.['react-router'] === '8.3.0',
  'react-router must be pinned to advisory-clean 8.3.0',
);
expect(
  !pkg.dependencies?.['react-router-dom'],
  'React Router 8 must not retain the removed react-router-dom compatibility package',
);
expect(
  pkg.dependencies?.react === '19.2.7' && pkg.dependencies?.['react-dom'] === '19.2.7',
  'React and React DOM must meet the React Router 8 security baseline',
);
expect(
  pkg.dependencies?.['lucide-react'] === '1.27.0',
  'Lucide React must use a release with declared React 19 compatibility',
);
const legacyRouterImports = collectSourceFiles('src')
  .filter(path => source(path).includes("from 'react-router-dom'"));
expect(
  legacyRouterImports.length === 0,
  `React Router 8 source imports must use react-router: ${legacyRouterImports.join(', ')}`,
);
const authModal = source('src/components/auth/AuthModal.jsx');
expect(
  authModal.includes('function GoogleGIcon') && authModal.includes('<GoogleGIcon />') && !authModal.includes('Chrome,'),
  'Google sign-in must use its own accessible mark instead of Lucide Chrome branding',
);
const joinAsCreator = source('src/pages/JoinAsCreator.jsx');
expect(
  joinAsCreator.includes('<Smartphone size={20} />') && !joinAsCreator.includes('Instagram,'),
  'Social media services must use a neutral content icon instead of removed platform branding',
);
const liveOnboarding = source('scripts/verify-creator-onboarding-live.mjs');
expect(
  liveOnboarding.includes("status: 'verified'") &&
    liveOnboarding.includes("provider: 'twilio'") &&
    liveOnboarding.includes('unverifiedPhoneSubmission') &&
    liveOnboarding.includes("provider: 'stripe_identity'") &&
    liveOnboarding.includes('unverifiedIdentitySubmission'),
  'Live creator onboarding QA must exercise the required phone and human-identity gates before atomic submission',
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
