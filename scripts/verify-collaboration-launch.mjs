import { spawn } from 'node:child_process';

const checks = [
  ['trusted roles', ['npm', ['run', 'verify:creator-collaboration-foundation']]],
  ['platform intelligence ledger', ['npm', ['run', 'verify:platform-intelligence']]],
  ['collaboration lifecycle', ['npm', ['run', 'verify:creator-collaboration-lifecycle']]],
  ['collaboration payments', ['npm', ['run', 'verify:collaboration-payments']]],
  ['collaboration workspaces', ['npm', ['run', 'verify:collaboration-workspaces']]],
  ['collaboration reputation', ['npm', ['run', 'verify:collaboration-reputation']]],
  ['intelligence governance', ['npm', ['run', 'verify:platform-intelligence-governance']]],
  ['intelligence reports', ['npm', ['run', 'verify:platform-intelligence-reports']]],
];

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

const results = [];
for (const [label, [command, args]] of checks) {
  console.log(`\n=== ${label.toUpperCase()} ===`);
  const code = await run(command, args);
  results.push({ label, ok: code === 0 });
}

console.log('\n=== CREATOR COLLABORATION LAUNCH SUMMARY ===');
for (const result of results) console.log(`${result.ok ? '[PASS]' : '[FAIL]'} ${result.label}`);
if (results.some((result) => !result.ok)) process.exit(1);
console.log('\nCreator Collaboration and Platform Intelligence launch checks passed.');
