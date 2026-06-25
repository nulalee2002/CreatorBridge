import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sql = readdirSync(join(root, 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(root, 'supabase/migrations', file), 'utf8'))
  .join('\n')
  .toLowerCase();
const read = (file) => existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '';
const exportFn = read('supabase/functions/export-platform-intelligence/index.ts');
const retainFn = read('supabase/functions/retain-platform-intelligence/index.ts');
const deleteFn = read('supabase/functions/delete-platform-intelligence-subject/index.ts');
const terms = read('src/pages/TermsPage.jsx');

const checks = [];
const ok = (name, pass) => checks.push([name, Boolean(pass)]);

ok('metric registry exists', sql.includes('platform_intelligence_metric_definitions'));
ok('metric version primary key', sql.includes('primary key (metric_key, version)'));
ok('small cohort suppression below five', sql.includes('suppression_threshold integer not null default 5') && sql.includes('< 5'));
ok('separate pseudonym mapping exists', sql.includes('platform_subject_pseudonyms'));
ok('actor pseudonym column exists', sql.includes('actor_pseudonym uuid'));
ok('export archive exists', sql.includes('platform_intelligence_exports'));
ok('exports exclude identifiers/content by constraint', sql.includes('includes_direct_identifiers boolean not null default false check') && sql.includes('includes_message_content boolean not null default false check') && sql.includes('includes_file_content boolean not null default false check'));
ok('export TTL and revocation', sql.includes("expires_at timestamptz not null default now() + interval '7 days'") && sql.includes("status in ('generated', 'revoked', 'expired')"));
ok('13 month pseudonymization', sql.includes("interval '13 months'") && sql.includes('pseudonymized_at'));
ok('24 month pseudonymized detail deletion', sql.includes("interval '24 months'"));
ok('legal record isolation', sql.includes("retention_class not in ('financial_legal', 'legal_hold')"));
ok('deletion propagation exists', sql.includes('delete_platform_intelligence_subject') && sql.includes('exports_revoked') && sql.includes('events_scrubbed'));
ok('deletion catches pseudonymized rows', sql.includes('pseudonym_value') && sql.includes('actor_pseudonym = pseudonym_value'));
ok('governed rollup view', sql.includes('platform_intelligence_daily_rollups') && sql.includes('security_invoker'));
ok('AI export uses rollup view', exportFn.includes("from('platform_intelligence_daily_rollups')"));
ok('AI export has provenance', exportFn.includes("provenance: 'platform_intelligence_daily_rollups'"));
ok('AI export suppresses actor count', exportFn.includes('Suppressed because fewer than 5 actors'));
ok('AI export declares no private content', exportFn.includes('includesMessageContent: false') && exportFn.includes('includesFileContent: false'));
ok('CSV and JSON export supported', exportFn.includes("exportKind === 'csv'") && exportFn.includes('toCsv'));
ok('retention function protected by job secret', retainFn.includes('PLATFORM_INTELLIGENCE_JOB_SECRET'));
ok('delete function auth boundary', deleteFn.includes('Admin access required for another subject'));
ok('privacy policy states retention', terms.includes('Identifiable behavioral analytics events are retained for up to 13 months'));
ok('privacy policy excludes messages/files/workspaces', terms.includes('does not collect, read, or analyze direct-message') && terms.includes('external project workspaces'));

const forbiddenExportTerms = ['message_body', 'private_message', 'workspace_contents', 'file_content', 'email', 'phone'];
ok('export function avoids obvious PII/private-content fields', forbiddenExportTerms.every((term) => !exportFn.toLowerCase().includes(term)));

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error('Platform intelligence governance incomplete:');
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.length }, null, 2));
