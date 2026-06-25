import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sql = readdirSync(join(root, 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(root, 'supabase/migrations', file), 'utf8'))
  .join('\n')
  .toLowerCase();
const compactSql = sql.replace(/\s+/g, ' ');
const read = (file) => existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '';
const terms = read('src/pages/TermsPage.jsx');
const agreement = read('src/pages/CreatorAgreement.jsx');
const projectBoard = read('src/pages/ProjectBoard.jsx');
const reviewActions = read('src/components/collaboration/CollaborationReviewActions.jsx');
const allSource = [
  terms,
  agreement,
  projectBoard,
  reviewActions,
  read('scripts/verify-margin-protection.mjs'),
].join('\n');

const checks = [];
const ok = (name, pass) => checks.push([name, Boolean(pass)]);

ok('separate collaboration review table', sql.includes('create table if not exists public.collaboration_reviews'));
ok('verified creator collaboration label', sql.includes("verified creator collaboration") && reviewActions.includes('Verified Creator Collaboration'));
ok('public rating excluded', compactSql.includes('excluded_from_public_rating boolean not null default true') && compactSql.includes('check (excluded_from_public_rating)'));
ok('loyalty excluded', compactSql.includes('excluded_from_loyalty boolean not null default true') && compactSql.includes('check (excluded_from_loyalty)'));
ok('self-review blocked', sql.includes('check (reviewer_id <> reviewee_id)') && sql.includes('self-review is not allowed'));
ok('review RPC status gated', sql.includes('submit_collaboration_review') && sql.includes("c.status not in ('approved', 'completed')"));
ok('missing repeat bookings are analytics only', !sql.includes('missing repeat') && !sql.includes('punish repeat'));
ok('rehire RPC exists', sql.includes('rehire_creator_collaborator'));
ok('rehire requires fresh scope', sql.includes('rehire requires a fresh scope'));
ok('rehire requires fresh deadline', sql.includes('rehire requires a fresh deadline'));
ok('rehire requires fresh price floor', sql.includes('p_amount_cents is null or p_amount_cents < 25000'));
ok('rehire UI explains no silent copy', reviewActions.includes('copies the relationship only') && reviewActions.includes('fresh scope, price, and deadline'));
ok('terms include creator collaboration non-circumvention', terms.includes('creator-to-creator collaborations introduced or arranged through CreatorBridge off-platform'));
ok('agreement includes collaboration non-circumvention', agreement.includes('Moving creator-to-creator collaborations'));
ok('project board shows review actions', projectBoard.includes('CollaborationReviewActions'));

const escrowMentions = [...allSource.matchAll(/\bescrow\b/gi)].length;
ok('escrow terminology inventoried for counsel', escrowMentions >= 1);
ok('escrow terminology not mass-replaced by this task', allSource.includes('escrow-like') || allSource.includes('secure escrow'));

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error('Collaboration reputation contracts incomplete:');
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.length, escrowMentions }, null, 2));
