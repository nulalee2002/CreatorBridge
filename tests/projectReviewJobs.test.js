import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const migrationUrl = new URL('../supabase/migrations/20260823042137_schedule_project_completion_jobs.sql', import.meta.url);
const reviewUrl = new URL('../supabase/functions/process-project-reviews/index.ts', import.meta.url);
const cleanupUrl = new URL('../supabase/functions/cleanup-project-deliveries/index.ts', import.meta.url);

test('review jobs are server-only, atomic, and idempotent', () => {
  assert.equal(existsSync(migrationUrl), true);
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /project_delivery_events/i);
  assert.match(sql, /unique \(delivery_id, event_type\)/i);
  assert.match(sql, /for update(?: of delivery)? skip locked/i);
  assert.match(sql, /reminder_48h/i);
  assert.match(sql, /reminder_24h/i);
  assert.match(sql, /auto_approve/i);
  assert.match(sql, /status = 'under_review'/i);
  assert.match(sql, /not exists[\s\S]*project_delivery_holds/i);
});

test('approval creates seven-day retention and revisions/disputes pause review', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /retention_expires_at = v_now \+ interval '7 days'/i);
  assert.match(sql, /hold_type[\s\S]{0,180}'revision'/i);
  assert.match(sql, /hold_type[\s\S]{0,180}'dispute'/i);
  assert.match(sql, /review_paused_at/i);
  assert.match(sql, /release_revision_hold_on_resubmission/i);
});

test('review processor and cleanup require a trusted job secret', () => {
  for (const url of [reviewUrl, cleanupUrl]) {
    assert.equal(existsSync(url), true);
    const source = readFileSync(url, 'utf8');
    assert.match(source, /PLATFORM_JOB_SECRET/);
    assert.match(source, /x-platform-job-secret/);
  }
  const review = readFileSync(reviewUrl, 'utf8');
  assert.match(review, /claim_project_review_events/);
  const cleanup = readFileSync(cleanupUrl, 'utf8');
  assert.match(cleanup, /claim_project_delivery_cleanup/);
  assert.match(cleanup, /storage\.from\('project-deliveries'\)\.remove/);
});

test('cron schedules use Vault-backed values without literal secrets', () => {
  const sql = readFileSync(migrationUrl, 'utf8');
  assert.match(sql, /cron\.schedule/i);
  assert.match(sql, /vault\.decrypted_secrets/i);
  assert.doesNotMatch(sql, /Bearer\s+[A-Za-z0-9_-]{20,}/);
});
