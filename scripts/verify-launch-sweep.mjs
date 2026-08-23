import { spawn } from 'node:child_process';

const checks = [
  ['unit tests', ['npm', ['test']]],
  ['build', ['npm', ['run', 'build']]],
  ['platform audit', ['npm', ['run', 'audit:platform']]],
  ['dependency audit', ['npm', ['audit', '--audit-level=high']]],
  ['launch trust guards', ['npm', ['run', 'verify:launch-trust-guards']]],
  ['two included revisions', ['npm', ['run', 'verify:two-revisions']]],
  ['revision ledgers', ['npm', ['run', 'verify:revision-ledgers']]],
  ['paid revision policy', ['npm', ['run', 'verify:paid-revisions']]],
  ['project deliveries', ['npm', ['run', 'verify:project-deliveries']]],
  ['project review jobs', ['npm', ['run', 'verify:project-review-jobs']]],
  ['final payment policy', ['npm', ['run', 'verify:final-payment-policy']]],
  ['public launch cleanup', ['npm', ['run', 'verify:public-launch-cleanup']]],
  ['distributed rate limits', ['npm', ['run', 'verify:distributed-rate-limits']]],
  ['notifications', ['npm', ['run', 'verify:notifications']]],
  ['email provider', ['npm', ['run', 'verify:email-provider']]],
  ['chatbot guide', ['npm', ['run', 'verify:chatbot-guide']]],
  ['profile media', ['npm', ['run', 'verify:profile-media']]],
  ['public readiness', ['npm', ['run', 'verify:public-readiness']]],
  ['network portfolio sharing', ['npm', ['run', 'verify:network-portfolio-sharing']]],
  ['platform language', ['npm', ['run', 'verify:platform-language']]],
  ['message filter', ['npm', ['run', 'verify:message-filter']]],
  ['project board public data', ['npm', ['run', 'verify:project-board-public-data']]],
  ['creator collaboration launch', ['npm', ['run', 'verify:collaboration-launch']]],
  ['support reporting', ['npm', ['run', 'verify:support-reporting']]],
  ['client phone gate', ['npm', ['run', 'verify:client-phone-gate']]],
  ['release-payment security', ['npm', ['run', 'verify:release-payment-security']]],
  ['admin/support/search', ['npm', ['run', 'verify:admin-support-search']]],
  ['human identity', ['npm', ['run', 'verify:human-identity']]],
  ['contracts', ['npm', ['run', 'verify:contracts']]],
  ['change orders', ['npm', ['run', 'verify:change-orders']]],
  ['video calls', ['npm', ['run', 'verify:video-calls']]],
  ['browser end to end', ['npm', ['run', 'test:e2e']]],
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
