import { existsSync, readFileSync } from 'node:fs';
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
  'SITE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PLATFORM_JOB_SECRET',
  'TURNSTILE_SECRET_KEY',
  'RESEND_API_KEY',
];

const OPTIONAL_SUPABASE_SECRETS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_MAX_TOKENS',
  'CHATBOT_AI_ENABLED',
];

const PUBLIC_SECRET_RISKS = [
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_STRIPE_SECRET_KEY',
  'VITE_STRIPE_WEBHOOK_SECRET',
  'VITE_ANTHROPIC_API_KEY',
];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
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
  const files = [
    'src/lib/supabase.js',
    'src/lib/stripe.js',
    'src/components/SupportChatbot.jsx',
    'src/components/TurnstileWidget.jsx',
    'src/components/GoogleCalendarConnect.jsx',
    'supabase/functions/create-connect-account/index.ts',
    'supabase/functions/create-payment-intent/index.ts',
    'supabase/functions/stripe-webhook/index.ts',
    'supabase/functions/release-payment/index.ts',
    'supabase/functions/check-connect-status/index.ts',
    'supabase/functions/chatbot/index.ts',
    'supabase/functions/submit-quote-request/index.ts',
    'supabase/functions/send-notification-email/index.ts',
  ];
  const names = new Set();
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) names.add(match[1]);
    for (const match of source.matchAll(/Deno\.env\.get\(['"]([A-Z0-9_]+)['"]\)/g)) names.add(match[1]);
  }
  return names;
}

const localKeys = parseEnvKeys('.env');
const usedNames = findUsedEnvNames();
const failures = [];
const warnings = [];

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

console.log(`CreatorBridge environment audit passed. Checked ${usedNames.size} referenced environment names.`);
