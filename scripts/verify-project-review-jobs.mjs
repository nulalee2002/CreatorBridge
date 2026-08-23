import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260823042137_schedule_project_completion_jobs.sql', import.meta.url), 'utf8');
const review = readFileSync(new URL('../supabase/functions/process-project-reviews/index.ts', import.meta.url), 'utf8');
const cleanup = readFileSync(new URL('../supabase/functions/cleanup-project-deliveries/index.ts', import.meta.url), 'utf8');
const email = readFileSync(new URL('../supabase/functions/send-notification-email/index.ts', import.meta.url), 'utf8');

const checks = [
  [/project_delivery_events/.test(migration), 'event ledger'],
  [/unique \(delivery_id, event_type\)/i.test(migration), 'event idempotency'],
  [/for update of delivery skip locked/i.test(migration), 'atomic claims'],
  [migration.includes("'reminder_48h'"), '48-hour marker'],
  [migration.includes("'reminder_24h'"), '24-hour marker'],
  [migration.includes("'auto_approve'"), 'auto-approval marker'],
  [/status = 'under_review'/i.test(migration), 'review-state gate'],
  [/project_delivery_holds[\s\S]*hold\.active/i.test(migration), 'hold gate'],
  [/dispute\.status = 'open'/i.test(migration), 'dispute gate'],
  [/retention_expires_at = v_now \+ interval '7 days'/i.test(migration), 'seven-day retention'],
  [/hold_delivery_for_revision/i.test(migration), 'revision pause trigger'],
  [/hold_delivery_for_dispute/i.test(migration), 'dispute pause trigger'],
  [/release_revision_hold_on_resubmission/i.test(migration), 'fresh resubmission release'],
  [/claim_project_delivery_cleanup/i.test(migration), 'cleanup claim'],
  [/vault\.decrypted_secrets/i.test(migration), 'Vault-backed Cron'],
  [/cron\.schedule/i.test(migration), 'scheduled jobs'],
  [review.includes("Deno.env.get('PLATFORM_JOB_SECRET')"), 'review job secret'],
  [review.includes("req.headers.get('x-platform-job-secret')"), 'review trusted header'],
  [review.includes("rpc('claim_project_review_events'"), 'review claim invocation'],
  [cleanup.includes("Deno.env.get('PLATFORM_JOB_SECRET')"), 'cleanup job secret'],
  [cleanup.includes("rpc('claim_project_delivery_cleanup'"), 'cleanup claim invocation'],
  [cleanup.includes("storage.from('project-deliveries').remove"), 'private object deletion'],
  [cleanup.includes("item_type', 'direct'"), 'external link preservation'],
  [email.includes("case 'delivery_review_48h'"), '48-hour email'],
  [email.includes("case 'delivery_review_24h'"), '24-hour email'],
  [email.includes("case 'delivery_auto_approved'"), 'auto-approval email'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
console.log(`CreatorBridge project-review job verification passed: ${checks.length} checks.`);
