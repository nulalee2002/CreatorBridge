import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const migrationName = readdirSync(migrationsDir)
  .find((name) => name.endsWith('_launch_trust_field_guards.sql'));

if (!migrationName) {
  throw new Error('launch trust-field guard migration is missing');
}

const sql = readFileSync(join(migrationsDir, migrationName), 'utf8').toLowerCase();
const requiredPatterns = [
  'create schema if not exists private',
  'guard_profile_trust_columns',
  'first_booking_fee_waived',
  'next_booking_fee_waived',
  'guard_client_profile_trust_columns',
  'total_projects_completed',
  'payment_method_on_file',
  'guard_creator_listing_trust_columns',
  'completed_projects',
  'next_project_fee_pct',
  'review_status',
  'verification_status',
  'verified',
  'stripe_account_id',
  'stripe_onboarded',
  'payouts_enabled',
  'is_suspended',
  'strike_count',
  'before update on public.profiles',
  'before update on public.client_profiles',
  'before update on public.creator_listings',
  "current_user = 'authenticated'",
  'security invoker',
  'revoke all on function private.guard_profile_trust_columns()',
  'revoke all on function private.guard_client_profile_trust_columns()',
  'revoke all on function private.guard_creator_listing_trust_columns()',
];

const missing = requiredPatterns.filter((pattern) => !sql.includes(pattern));
if (missing.length) {
  throw new Error(`launch trust-field migration is missing: ${missing.join(', ')}`);
}

if (sql.includes('auth.role()')) {
  throw new Error('launch trust-field migration uses deprecated auth.role()');
}

console.log(`CreatorBridge launch trust-field guard verification passed: ${requiredPatterns.length + 1} checks.`);
