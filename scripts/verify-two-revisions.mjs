import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scanRoots = ['src', 'supabase/functions'];
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

function filesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const files = scanRoots.flatMap((dir) => filesUnder(join(root, dir)))
  .filter((file) => extensions.has(extname(file)));
const violations = [];
const forbidden = [
  [/72[- ]hour/gi, '72-hour review language'],
  [/\b2 free revisions\b/gi, 'free-revision language'],
  [/\bunlimited revisions\b/gi, 'unlimited-revision offer'],
  [/['"`]3 revisions['"`]/gi, 'three-revision offer'],
  [/options:\s*\[[^\]]*(?:1 revision|3 revisions|unlimited revisions|no revisions included)/gis, 'editable revision quote options'],
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const [pattern, label] of forbidden) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) violations.push(`${relative(root, file)}: ${label}`);
  }
}

const packageBuilder = readFileSync(join(root, 'src/components/PackageBuilder.jsx'), 'utf8');
if (/Revision Rounds|onUpdate\(['"]revisions['"]/.test(packageBuilder)) {
  violations.push('src/components/PackageBuilder.jsx: revision count remains editable');
}
if (!packageBuilder.includes('INCLUDED_REVISIONS')) {
  violations.push('src/components/PackageBuilder.jsx: missing canonical revision constant');
}

const seeds = readFileSync(join(root, 'src/data/seedCreators.js'), 'utf8');
for (const match of seeds.matchAll(/revisions:\s*(\d+)/g)) {
  if (Number(match[1]) !== 2) violations.push(`src/data/seedCreators.js: revisions ${match[1]}`);
}

const fees = readFileSync(join(root, 'src/config/fees.js'), 'utf8');
if (!/autoApproveDays:\s*5\b/.test(fees)) violations.push('src/config/fees.js: review window is not five days');

const contractTerms = readFileSync(join(root, 'src/utils/contractTerms.js'), 'utf8');
if (!contractTerms.includes('revisions: INCLUDED_REVISIONS')) {
  violations.push('src/utils/contractTerms.js: contracts do not use canonical revisions');
}

if (violations.length) {
  throw new Error(`two-revision verification failed:\n- ${violations.join('\n- ')}`);
}

console.log(`CreatorBridge two-included-revision verification passed across ${files.length} active files.`);
