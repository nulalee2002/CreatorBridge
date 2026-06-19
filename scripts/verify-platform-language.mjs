import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const files = globSync('src/**/*.{js,jsx}', { exclude: ['src/data/rates.js'] });
const violations = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    if (/marketplace/i.test(line) && !/MARKETPLACE_CATEGORIES|getMarketplaceServiceIds|serviceMatchesMarketplaceCategory/.test(line)) {
      violations.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length) {
  console.error('[FAIL] Customer-facing marketplace language remains:');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('[PASS] Customer-facing CreatorBridge language consistently uses platform.');
