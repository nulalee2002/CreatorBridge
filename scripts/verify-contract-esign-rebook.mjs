import fs from 'node:fs';
import path from 'node:path';
import { getPlatformGuideResponse } from '../src/data/supportKnowledge.js';

const root = process.cwd();
const requiredFiles = [
  'src/utils/contractTerms.js',
  'src/utils/contractPdf.js',
  'src/components/SignaturePad.jsx',
  'src/components/ContractSignModal.jsx',
  'src/components/ContractView.jsx',
  'src/components/ContractAction.jsx',
  'src/components/RebookButton.jsx',
  'supabase/functions/generate-contract/index.ts',
  'supabase/functions/sign-contract/index.ts',
  'supabase/migrations/20260711153000_contract_esign_rebook.sql',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
}

const migrationPath = path.join(root, 'supabase/migrations/20260711153000_contract_esign_rebook.sql');
if (fs.existsSync(migrationPath)) {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  for (const expected of [
    'alter table public.contracts enable row level security',
    'alter table public.contract_signatures enable row level security',
    'alter table public.saved_signatures enable row level security',
    "('contracts', 'contracts', false",
    "('signatures', 'signatures', false",
    'create or replace function public.rebook_project',
    'create or replace function public.generate_contract_for_project',
    'create or replace function public.refresh_contract_signature_status',
    'package_id uuid references public.packages',
    'projects_one_active_rebook_per_source',
  ]) {
    if (!sql.includes(expected)) failures.push(`Migration missing: ${expected}`);
  }
}
const allMigrations = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter(file => file.endsWith('.sql'))
  .sort()
  .map(file => fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'))
  .join('\n');
for (const expected of [
  'protect_signed_contract_evidence',
  'Signed agreement evidence is immutable',
  'Agreement signatures are append-only evidence',
]) {
  if (!allMigrations.includes(expected)) failures.push(`Contract evidence protection missing: ${expected}`);
}
if (fs.readFileSync(path.join(root, 'src/utils/contractTerms.js'), 'utf8').includes(['attorney', 'review', 'required'].join('_'))) {
  failures.push('New agreement terms still include obsolete review metadata');
}

const signFunctionPath = path.join(root, 'supabase/functions/sign-contract/index.ts');
if (fs.existsSync(signFunctionPath)) {
  const signing = fs.readFileSync(signFunctionPath, 'utf8');
  for (const expected of [
    'signedContentHash !== contract.content_hash',
    "checkRateLimit(req, { maxRequests: 8",
    "`${contract.id}/${signerRole}.png`",
    "rpc('refresh_contract_signature_status'",
    "rpc('require_verified_project_parties'",
    'IDENTITY_VERIFICATION_REQUIRED',
  ]) {
    if (!signing.includes(expected)) failures.push(`Signing function missing: ${expected}`);
  }
}

const scanFiles = requiredFiles.filter(file => fs.existsSync(path.join(root, file)));
for (const file of scanFiles) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  if (/[\u2013\u2014]/u.test(contents)) failures.push(`${file} contains a Unicode dash`);
  if (/\bmarketplace\b/i.test(contents)) failures.push(`${file} contains marketplace`);
  if (/\bescrow\b/i.test(contents)) failures.push(`${file} contains escrow`);
  if (/notari[sz]/i.test(contents)) failures.push(`${file} contains a notarization claim`);
}

const paymentPath = path.join(root, 'supabase/functions/create-payment-intent/index.ts');
const payment = fs.readFileSync(paymentPath, 'utf8');
if (!payment.includes("contracts.status = 'countersigned'")) {
  failures.push('Payment function does not document the countersigned contract gate');
}
if (!payment.includes('Both parties need to sign the agreement before the retainer can be paid.')) {
  failures.push('Payment function is missing the approved contract gate error');
}

const contractHelp = getPlatformGuideResponse('How do I sign the contract?') || '';
if (!contractHelp.includes('before the retainer can be paid') || !contractHelp.includes('never signs automatically')) {
  failures.push('Free support guide does not explain contract signing accurately');
}
const rebookHelp = getPlatformGuideResponse('How do I rebook a saved creator?') || '';
if (!rebookHelp.includes('fresh agreement') || !rebookHelp.includes('old contract is never reused')) {
  failures.push('Free support guide does not explain rebooking accurately');
}

for (const file of [
  'src/config/fees.js',
  'src/components/TermsModal.jsx',
  'supabase/functions/chatbot/index.ts',
  'supabase/functions/send-notification-email/index.ts',
]) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  if (/5-day review|within 5 days/i.test(contents)) failures.push(`${file} still contains the old review window`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Contract, e-signature, and rebooking verification passed.');
