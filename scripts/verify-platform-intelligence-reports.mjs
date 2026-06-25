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
const reportFn = read('supabase/functions/generate-platform-report/index.ts');
const analytics = read('src/pages/AdminAnalytics.jsx');
const survey = read('src/components/analytics/CollaborationSurvey.jsx');
const packageJson = read('package.json');

const checks = [];
const ok = (name, pass) => checks.push([name, Boolean(pass)]);

ok('report archive table exists', sql.includes('create table if not exists public.platform_intelligence_reports'));
ok('weekly monthly quarterly report types', sql.includes("report_type in ('weekly', 'monthly', 'quarterly', 'training')"));
ok('period uniqueness/idempotency', sql.includes('unique (report_type, period_key)') && reportFn.includes("onConflict: 'report_type,period_key'"));
ok('America Phoenix timezone', sql.includes("default 'america/phoenix'") && reportFn.includes("timezone: 'America/Phoenix'"));
ok('Monday 9 AM schedule scaffold', sql.includes('generate every monday at 9:00 am america/phoenix.'));
ok('monthly schedule scaffold', sql.includes('first day of each month'));
ok('quarterly schedule scaffold', sql.includes('first day of each quarter'));
ok('empty training reports supported', sql.includes("'training'") && reportFn.includes('emptyTrainingReport'));
ok('stale-source warnings', sql.includes('stale_source_warning') && reportFn.includes('No fresh platform intelligence events in the last 48 hours'));
ok('small cohort suppression included', sql.includes('suppression_count') && reportFn.includes('suppressedRows'));
ok('admin-only report access', sql.includes('admins can read intelligence reports'));
ok('admin rollup RPC exists', sql.includes('get_admin_platform_intelligence_rollups') && sql.includes('admin access required'));
ok('admin analytics displays reports', analytics.includes('Platform Intelligence Reports') && analytics.includes('get_admin_platform_intelligence_rollups'));
ok('external/internal demand separated in summary', reportFn.includes('externalDemand') && reportFn.includes('internalCollaboration'));
ok('authoritative vs directional separated', reportFn.includes('serverAuthoritativeEvents') && reportFn.includes('directionalEvents'));
ok('gross and contribution wording present', reportFn.includes('Contribution should be analyzed net of processing costs'));
ok('three-question survey storage exists', sql.includes('create table if not exists public.collaboration_surveys'));
ok('survey question one', sql.includes('easier_than_doing_it_yourself') && survey.includes('Was this easier than doing it yourself'));
ok('survey question two', sql.includes('floor_changed_scope') && survey.includes('Did the $250 floor change scope'));
ok('survey question three', sql.includes('file_access_worked') && survey.includes('Did file access work'));
ok('survey excludes private content', survey.includes('do not include DM contents or creative files'));
ok('AI handoff privacy boundary', reportFn.includes('privateMessageContentIncluded: false') && reportFn.includes('creativeFileContentIncluded: false'));
ok('package script registered', packageJson.includes('verify:platform-intelligence-reports'));

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error('Platform intelligence reports incomplete:');
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.length }, null, 2));
