import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
}

const bunnyHelper = exists('src/utils/bunnyStream.js') ? read('src/utils/bunnyStream.js') : '';
const directory = read('src/components/CreatorDirectory.jsx');
const dashboard = read('src/pages/CreatorDashboard.jsx');
const profile = read('src/pages/CreatorProfilePage.jsx');
const verification = read('src/components/VerificationFlow.jsx');
const filter = read('src/utils/messageFilter.js');
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter(name => name.endsWith('.sql'))
  .map(name => read(`supabase/migrations/${name}`))
  .join('\n');

check('Bunny Stream helper exists', exists('src/utils/bunnyStream.js'));
check('Bunny helper stores bunny: refs', /BUNNY_REF_PREFIX\s*=\s*['"]bunny:/.test(bunnyHelper));
check('Bunny helper uploads through Supabase function', /bunny-create-video/.test(bunnyHelper) && /tusupload/.test(bunnyHelper));
check('Bunny helper can delete replaced videos', /bunny-delete-video/.test(bunnyHelper));
check('Bunny create edge function exists', exists('supabase/functions/bunny-create-video/index.ts'));
check('Bunny create function uses server-side secrets', exists('supabase/functions/bunny-create-video/index.ts') && /BUNNY_STREAM_LIBRARY_ID/.test(read('supabase/functions/bunny-create-video/index.ts')) && /BUNNY_STREAM_API_KEY/.test(read('supabase/functions/bunny-create-video/index.ts')));
check('Bunny delete edge function exists', exists('supabase/functions/bunny-delete-video/index.ts'));
check('Migration adds Bunny video id', /add column if not exists bunny_video_id/i.test(migrations));
check('Migration enforces required Bunny intro', /video_intro_url/i.test(migrations) && /bunny:%/i.test(migrations));
check('Migration enforces media caps', /portfolio_video_cap|count\(\*\).*3/is.test(migrations) && /portfolio_photo_cap|count\(\*\).*6/is.test(migrations));
check('Registration removed external intro links', !/Paste your intro video link from YouTube, Vimeo, or Loom/i.test(directory));
check('Registration uploads Bunny intro', /uploadVideoToBunny/.test(directory) && /videoIntroUrl/.test(directory));
check('Registration removed public website/Instagram contact fields', !/key:\s*['"]website['"][\s\S]{0,120}label:\s*['"]Website/i.test(directory) && !/key:\s*['"]instagram['"][\s\S]{0,120}label:\s*['"]Instagram/i.test(directory));
check('Registration portfolio uses CreatorBridge media instead of external links', !/Portfolio link, e\.g\. YouTube, Vimeo, website, Drive/i.test(directory) && /bunny_video_id/.test(directory));
check('Dashboard intro no longer accepts YouTube/Vimeo/Loom links', !/Please enter a valid YouTube, Vimeo, or Loom URL/i.test(dashboard) && /uploadVideoToBunny/.test(dashboard));
check('Verification no longer requires social links', !/socialLinks|Social Media Verification|instagram\.com\/yourhandle|youtube\.com\/yourchannel/.test(verification));
check('Profile exposes Watch intro Bunny modal', /Watch intro/.test(profile) && /getBunnyEmbedUrl/.test(profile));
check('Text filter blocks payment apps', /venmo|cash\s*app|zelle|paypal/i.test(filter));
check('Text filter exposes creator profile check', /checkCreatorText/.test(filter));

const failed = checks.filter(item => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? '✓' : '✗'} ${item.name}${item.detail ? ` - ${item.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\n${failed.length} walled-garden portfolio check(s) failed.`);
  process.exit(1);
}

console.log('\nWalled-garden portfolio verification passed.');
