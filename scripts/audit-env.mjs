import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();

const REQUIRED_VERCEL = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
];

const OPTIONAL_VERCEL = [
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_GOOGLE_CLIENT_ID',
];

const REQUIRED_SUPABASE_SECRETS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_IDENTITY_WEBHOOK_SECRET',
  'SITE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PLATFORM_JOB_SECRET',
  'RATE_LIMIT_HASH_SECRET',
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
];

const OPTIONAL_SUPABASE_SECRETS = [
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_MAX_TOKENS',
  'CHATBOT_AI_DAILY_QUOTA',
  'CHATBOT_AI_ENABLED',
];

const PUBLIC_SECRET_RISKS = [
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_STRIPE_SECRET_KEY',
  'VITE_STRIPE_WEBHOOK_SECRET',
  'VITE_OPENAI_API_KEY',
  'VITE_ANTHROPIC_API_KEY',
];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function filesBelow(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) return [];
  const output = [];
  for (const entry of readdirSync(full)) {
    const relative = `${path}/${entry}`;
    const info = statSync(resolve(root, relative));
    if (info.isDirectory()) output.push(...filesBelow(relative));
    else if (info.size <= 5_000_000) output.push(relative);
  }
  return output;
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readableText(path) {
  try {
    const buffer = readFileSync(resolve(root, path));
    if (buffer.length > 5_000_000 || buffer.includes(0)) return '';
    return buffer.toString('utf8');
  } catch {
    return '';
  }
}

function parseEnvKeys(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) return new Set();
  return new Set(
    readFileSync(full, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=')[0].trim())
  );
}

function findUsedEnvNames() {
  const files = [...filesBelow('src'), ...filesBelow('supabase/functions')];
  const names = new Set();
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/import\.meta\.env(?:\?\.)?\.?(?:\[['"])?([A-Z][A-Z0-9_]+)/g)) names.add(match[1]);
    for (const match of source.matchAll(/Deno\.env\.get\(['"]([A-Z0-9_]+)['"]\)/g)) names.add(match[1]);
  }
  return names;
}

const SECRET_SIGNATURES = [
  { label: 'Stripe secret key', pattern: /\bsk_(?:test|live)_[A-Za-z0-9]{16,}\b/g },
  { label: 'Stripe webhook signing secret', pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/g },
  { label: 'OpenAI secret key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { label: 'Anthropic secret key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { label: 'private key material', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: 'assigned Supabase service-role key', pattern: /^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]?[A-Za-z0-9_.-]{20,}/gm },
  { label: 'assigned Stripe secret', pattern: /^\s*STRIPE_SECRET_KEY\s*=\s*['"]?[^\s'";]{12,}/gm },
];

function scanSecretSignatures(paths, scope, failures) {
  for (const path of paths) {
    const source = readableText(path);
    if (!source) continue;
    for (const signature of SECRET_SIGNATURES) {
      signature.pattern.lastIndex = 0;
      if (signature.pattern.test(source)) failures.push(`${scope} contains ${signature.label}: ${path}`);
    }
  }
}

const localKeys = parseEnvKeys('.env');
const usedNames = findUsedEnvNames();
const failures = [];
const warnings = [];

const tracked = trackedFiles();
for (const path of tracked) {
  if (/^(?:.*\/)?\.env(?:\..+)?$/i.test(path) && !path.endsWith('.env.example')) {
    failures.push(`Tracked environment file is not allowed: ${path}`);
  }
  if (/(?:^|\/)\.env\.txt$/i.test(path)) failures.push(`Legacy secret file is tracked: ${path}`);
}
scanSecretSignatures(tracked, 'Tracked source', failures);
scanSecretSignatures(filesBelow('dist'), 'Build output', failures);

for (const path of filesBelow('dist')) {
  const source = readableText(path);
  if (/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RATE_LIMIT_HASH_SECRET/.test(source)) {
    failures.push(`Build output references a backend-only secret name: ${path}`);
  }
}

for (const name of REQUIRED_VERCEL) {
  if (!usedNames.has(name)) failures.push(`Required Vercel env is not referenced by code: ${name}`);
}

for (const name of REQUIRED_SUPABASE_SECRETS) {
  if (!usedNames.has(name)) failures.push(`Required Supabase secret is not referenced by edge functions: ${name}`);
}

for (const name of PUBLIC_SECRET_RISKS) {
  if (usedNames.has(name)) {
    failures.push(`Public browser env risk is referenced by code: ${name}`);
  }
  if (localKeys.has(name)) {
    failures.push(`Public browser env risk appears in local .env: ${name}`);
  }
}

for (const name of [...REQUIRED_VERCEL, ...OPTIONAL_VERCEL]) {
  if (!localKeys.has(name)) {
    warnings.push(`Local .env does not include ${name}. This may be fine if you only use Vercel env pull.`);
  }
}

for (const name of REQUIRED_SUPABASE_SECRETS) {
  if (localKeys.has(name)) {
    warnings.push(`${name} appears in root .env. Supabase Edge Function secrets should be set in Supabase secrets, not exposed to frontend builds.`);
  }
}

for (const name of OPTIONAL_SUPABASE_SECRETS) {
  if (localKeys.has(name)) {
    warnings.push(`${name} appears in root .env. Keep chatbot AI controls in Supabase secrets when possible.`);
  }
}

if (failures.length > 0) {
  console.error('\nCreatorBridge environment audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length > 0) {
    console.error('\nWarnings:\n');
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('\nCreatorBridge environment audit warnings:\n');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log(`CreatorBridge environment audit passed. Checked ${usedNames.size} referenced environment names, ${tracked.length} tracked files, and ${filesBelow('dist').length} build files without printing secret values.`);
