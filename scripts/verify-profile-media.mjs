import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const profile = readFileSync(join(root, 'src/pages/CreatorProfilePage.jsx'), 'utf8');
const directory = readFileSync(join(root, 'src/components/CreatorDirectory.jsx'), 'utf8');
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8');
const handoffCss = readFileSync(join(root, 'src/styles/creatorbridge-handoff.css'), 'utf8');
const avatarComponent = readFileSync(join(root, 'src/components/CreatorAvatar.jsx'), 'utf8');

const storage = new Map([
  ['creator-seed-version', '12'],
  ['creator-directory', JSON.stringify([
    {
      id: 'seed-5',
      name: 'Mateo Reyes',
      avatar: '/images/creatorbridge/handoff/photo-1500648767791-00dcc994a43e.png',
      cover: '/images/creatorbridge/backgrounds/03-featured-work/featured-warehouse-film-set.jpg',
    },
    {
      id: 'seed-7',
      name: 'Aaron Wei',
      avatar: '/images/creatorbridge/handoff/photo-1463453091185-61582044d556.png',
      cover: '/images/creatorbridge/backgrounds/03-featured-work/featured-warehouse-film-set.jpg',
    },
  ])],
  ['creator-reviews', '[]'],
]);
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};

const seedModuleUrl = pathToFileURL(join(root, 'src/data/seedCreators.js')).href;
const { SEED_CREATORS, initSeedData } = await import(`${seedModuleUrl}?profile-media-verification=1`);
initSeedData();
const refreshedSeeds = JSON.parse(storage.get('creator-directory'));
const expectedSeedMedia = new Map(SEED_CREATORS.map(item => [
  item.id,
  { avatar: item.avatar, cover: item.cover },
]));
const avatarOwnersByHash = new Map();
const coverOwnersByHash = new Map();

for (const [id, expected] of expectedSeedMedia) {
  const actual = refreshedSeeds.find(item => item.id === id);
  assert(actual, `Seed refresh must restore ${id}`);
  assert(actual.avatar === expected.avatar, `Seed refresh must update ${id} avatar`);
  assert(actual.cover === expected.cover, `Seed refresh must update ${id} cover`);

  for (const [kind, ownersByHash] of [['avatar', avatarOwnersByHash], ['cover', coverOwnersByHash]]) {
    const assetPath = join(root, 'public', expected[kind].replace(/^\//, ''));
    assert(existsSync(assetPath), `${id} ${kind} asset must exist`);
    const hash = createHash('sha256').update(readFileSync(assetPath)).digest('hex');
    const priorOwner = ownersByHash.get(hash);
    assert(!priorOwner, `${id} ${kind} must not duplicate ${priorOwner}`);
    ownersByHash.set(hash, id);
  }
}

assert(profile.includes('aria-label="Watch intro"'), 'Intro control must remain accessible');
assert(profile.includes('<Play size={10}'), 'Intro control must use a compact play icon');
assert(
  !profile.includes('text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--bg)]">Watch intro</span>'),
  'Large text pill must not cover the creator portrait'
);

assert(directory.includes("import { CreatorAvatar } from './CreatorAvatar.jsx';"), 'Directory cards must use the shared avatar renderer');
assert(directory.includes('<CreatorAvatar'), 'Directory cards must render creator avatars through the shared component');
assert(!directory.includes('CREATOR_AVATAR_FALLBACK'), 'Directory cards must not impersonate creators with a shared portrait fallback');
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
