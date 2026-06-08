import { spawn } from 'node:child_process';

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'mxizhszqhbhxzkkhgnmg';

function run(command, args) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(command, args, { shell: false });
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('close', code => resolve({ code: code ?? 1, output }));
    child.on('error', error => resolve({ code: 1, output: error.message }));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const vercel = await run('vercel', ['env', 'ls', 'production']);
assert(vercel.code === 0, `Could not list Vercel production env vars. Output: ${vercel.output}`);
assert(
  vercel.output.includes('VITE_TURNSTILE_SITE_KEY'),
  'Vercel production is missing VITE_TURNSTILE_SITE_KEY'
);

const supabase = await run('supabase', ['secrets', 'list', '--project-ref', SUPABASE_PROJECT_REF]);
assert(supabase.code === 0, `Could not list Supabase secrets. Output: ${supabase.output}`);
assert(
  supabase.output.includes('TURNSTILE_SECRET_KEY'),
  'Supabase Edge Function secrets are missing TURNSTILE_SECRET_KEY'
);
assert(
  supabase.output.includes('RESEND_API_KEY'),
  'Supabase Edge Function secrets are missing RESEND_API_KEY'
);
const supabaseOpenAiApiKeyPresent = supabase.output.includes('OPENAI_API_KEY');
const supabaseChatbotAiEnabledFlagPresent = supabase.output.includes('CHATBOT_AI_ENABLED');

console.log(JSON.stringify({
  ok: true,
  vercelProductionTurnstileSiteKeyPresent: true,
  supabaseTurnstileSecretPresent: true,
  supabaseResendApiKeyPresent: true,
  supabaseOpenAiApiKeyPresent,
  supabaseChatbotAiEnabledFlagPresent,
  chatbotAiIsOptionalForLaunchSweep: true,
}, null, 2));
