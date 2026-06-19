import { spawn } from 'node:child_process';

const checks = [
  ['build', ['npm', ['run', 'build']]],
  ['notifications', ['npm', ['run', 'verify:notifications']]],
  ['email provider', ['npm', ['run', 'verify:email-provider']]],
  ['chatbot guide', ['npm', ['run', 'verify:chatbot-guide']]],
  ['profile media', ['npm', ['run', 'verify:profile-media']]],
  ['network portfolio sharing', ['npm', ['run', 'verify:network-portfolio-sharing']]],
  ['platform language', ['npm', ['run', 'verify:platform-language']]],
  ['support reporting', ['npm', ['run', 'verify:support-reporting']]],
  ['client phone gate', ['npm', ['run', 'verify:client-phone-gate']]],
  ['release-payment security', ['npm', ['run', 'verify:release-payment-security']]],
  ['admin/support/search', ['npm', ['run', 'verify:admin-support-search']]],
];

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

const results = [];

for (const [label, [command, args]] of checks) {
  console.log(`\n=== ${label.toUpperCase()} ===`);
  const code = await run(command, args);
  results.push({ label, ok: code === 0 });
  if (code !== 0) {
    console.log(`\n[FAIL] ${label} exited with code ${code}`);
  }
}

console.log('\n=== LAUNCH SWEEP SUMMARY ===');
for (const result of results) {
  console.log(`${result.ok ? '[PASS]' : '[FAIL]'} ${result.label}`);
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}

console.log('\nAll automated launch sweep checks passed.');
