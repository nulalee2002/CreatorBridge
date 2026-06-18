import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const profile = readFileSync(join(root, 'src/pages/CreatorProfilePage.jsx'), 'utf8');
const directory = readFileSync(join(root, 'src/components/CreatorDirectory.jsx'), 'utf8');
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');
const handoffCss = readFileSync(join(root, 'src/styles/creatorbridge-handoff.css'), 'utf8');
const avatarComponent = readFileSync(join(root, 'src/components/CreatorAvatar.jsx'), 'utf8');

assert(profile.includes('aria-label="Watch intro"'), 'Intro control must remain accessible');
assert(profile.includes('<Play size={10}'), 'Intro control must use a compact play icon');
assert(
  !profile.includes('text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--bg)]">Watch intro</span>'),
  'Large text pill must not cover the creator portrait'
);

assert(directory.includes('CREATOR_AVATAR_FALLBACK'), 'Directory cards need a stable avatar fallback');
assert(directory.includes('fallbackApplied'), 'Directory avatar fallback must avoid retry loops');
assert(directory.includes('event.currentTarget.src = CREATOR_AVATAR_FALLBACK'), 'Broken avatar URLs must be replaced');
assert(indexCss.includes('bottom: 1rem; left: 1rem; z-index: 2'), 'Desktop avatar must stay fully visible inside the clipped cover');
assert(handoffCss.includes('bottom:0.72rem !important'), 'Mobile avatar must stay fully visible inside the clipped cover');
assert(avatarComponent.includes('onError={() => setFailed(true)}'), 'Shared creator avatars must recover from failed image loads');

for (const file of [
  'src/App.jsx',
  'src/pages/Search.jsx',
  'src/pages/NetworkingPage.jsx',
  'src/pages/CreatorDashboard.jsx',
  'src/pages/CheckoutPage.jsx',
  'src/pages/MessagesPage.jsx',
  'src/components/SimilarCreators.jsx',
  'src/components/FastMatch.jsx',
]) {
  const source = readFileSync(join(root, file), 'utf8');
  assert(source.includes('<CreatorAvatar'), `${file} must render avatar URLs as images with fallbacks`);
}

console.log(JSON.stringify({
  ok: true,
  compactIntroControl: true,
  directoryAvatarFallback: true,
}, null, 2));
