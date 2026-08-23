import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const name = readdirSync(dir).find((file) => file.endsWith('_project_revision_ledgers.sql'));
if (!name) throw new Error('project revision ledger migration is missing');
const sql = readFileSync(join(dir, name), 'utf8').toLowerCase();

const required = [
  'create table public.project_revision_purchases',
  'create table public.project_revision_requests',
  'gross_amount_cents integer not null default 5000',
  'check (gross_amount_cents = 5000)',
  'client_fee_cents integer not null default 0',
  'stripe_payment_intent_id text unique',
  'stripe_event_id text unique',
  "source_type text not null check (source_type in ('included', 'paid'))",
  'included_ordinal integer check (included_ordinal between 1 and 2)',
  'purchase_id uuid unique',
  'enable row level security',
  'get_project_revision_state',
  'request_project_revision',
  'for update',
  'auth.uid()',
  "status = 'under_review'",
  'revoke all on function public.request_project_revision',
  'grant execute on function public.request_project_revision',
];

const missing = required.filter((pattern) => !sql.includes(pattern));
if (missing.length) throw new Error(`revision ledger migration is missing: ${missing.join(', ')}`);
if (/grant\s+(insert|update|delete)[^;]*project_revision_(purchases|requests)[^;]*authenticated/i.test(sql)) {
  throw new Error('revision ledgers grant direct mutation to authenticated users');
}

console.log(`CreatorBridge revision-ledger verification passed: ${required.length + 1} checks.`);
