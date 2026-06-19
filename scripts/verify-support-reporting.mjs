import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const form = readFileSync(join(root, 'src/components/SupportTicketForm.jsx'), 'utf8');
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
const migrationName = readdirSync(join(root, 'supabase/migrations'))
  .find(name => name.endsWith('_support_report_screenshots_and_config.sql'));
const scheduleName = readdirSync(join(root, 'supabase/migrations'))
  .find(name => name.endsWith('_schedule_support_screenshot_cleanup.sql'));

assert(migrationName, 'Support reporting schema must be captured in a committed migration');
assert(scheduleName, 'Support screenshot cleanup schedule must be captured in a committed migration');

const migration = readFileSync(join(root, 'supabase/migrations', migrationName), 'utf8');
const schedule = readFileSync(join(root, 'supabase/migrations', scheduleName), 'utf8');
const cleanupPath = join(root, 'supabase/functions/cleanup-support-screenshots/index.ts');
assert(existsSync(cleanupPath), 'Screenshot retention cleanup Edge Function must be committed');
const cleanup = readFileSync(cleanupPath, 'utf8');

for (const column of ['page_path', 'user_agent', 'viewport', 'screenshot_path']) {
  assert(migration.includes(`add column if not exists ${column}`), `Migration must add ${column}`);
}

assert(migration.includes("'support-screenshots'"), 'Migration must create the support screenshot bucket');
assert(/'support-screenshots'[\s\S]*?false/.test(migration), 'Support screenshot bucket must remain private');
assert(migration.includes('support_report_config'), 'Migration must capture retention configuration');
assert(migration.includes('retention_days') && migration.includes('default 30'), 'Retention must default to 30 days');
assert(migration.includes('delete_row_after_resolve') && migration.includes('default false'), 'Full ticket deletion must default off');
assert(schedule.includes('cron.schedule') && schedule.includes('cleanup-support-screenshots-daily'), 'Migration must schedule unattended cleanup');
assert(migration.includes('support-screenshots') && migration.includes('storage.foldername(name)'), 'Migration must scope uploads to the signed-in user folder');

assert(
  cleanup.includes(".from('support-screenshots')") || (cleanup.includes("const BUCKET = 'support-screenshots'") && cleanup.includes('.from(BUCKET)')),
  'Cleanup must target only the support screenshot bucket'
);
assert(cleanup.includes('.remove('), 'Cleanup must delete files through the Storage API');
assert(cleanup.includes(".update({ screenshot_path: null })"), 'Cleanup must preserve rows while clearing deleted screenshot paths');
assert(cleanup.includes('delete_row_after_resolve'), 'Cleanup must honor the optional full-row-delete switch');
assert(cleanup.includes('x-cleanup-token'), 'Cleanup endpoint must authenticate scheduled calls');
assert(cleanup.includes('const { error: removeError }') && cleanup.includes('if (removeError)'), 'Cleanup must not clear a path when Storage deletion fails');
assert(cleanup.includes('.limit(500)'), 'Cleanup must bound each daily batch to the Edge Function runtime');
assert(config.includes('[functions.cleanup-support-screenshots]') && config.includes('verify_jwt = false'), 'Cleanup function must use its scheduled-call token instead of JWT verification');

assert(form.includes('page_path:      pagePath'), 'Issue reports must capture their page path');
assert(form.includes('user_agent:     userAgent'), 'Issue reports must capture their browser context');
assert(form.includes('viewport:       viewport'), 'Issue reports must capture their viewport');
assert(form.includes('screenshot_path: screenshotPath'), 'Issue reports must retain the private screenshot path');
assert(form.includes('sendNotificationEmail(ADMIN_SUPPORT_EMAIL'), 'Working admin email behavior must remain untouched');

console.log(JSON.stringify({
  ok: true,
  migration: migrationName,
  privateScreenshots: true,
  retentionDays: 30,
  deleteRowsByDefault: false,
}, null, 2));
