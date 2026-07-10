import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const board = readFileSync(join(root, 'src/pages/ProjectBoard.jsx'), 'utf8');
const storage = readFileSync(join(root, 'src/utils/projectStorage.js'), 'utf8');

assert(storage.includes('export const SHOW_DEMO_PROJECTS = false;'), 'Launch mode must disable demo project briefs');
assert(storage.includes('filter(project => !isDemoProject(project))'), 'Local project reads must quarantine old demo rows');
assert(board.includes('SHOW_DEMO_PROJECTS'), 'Project Board must use the shared demo-project flag');
assert(board.includes('if (!SHOW_DEMO_PROJECTS) return;'), 'Project Board must not seed demos in launch mode');
assert(board.includes('const raw = supabaseConfigured && !user ? [] : loadProjects();'), 'Configured guest browsing must not render stale local briefs');

const remoteLoader = board.slice(
  board.indexOf('async function loadRemoteProjects()'),
  board.indexOf('async function loadRemoteApplications()')
);
assert(!remoteLoader.includes('if (!supabaseConfigured || !user) return;'), 'Guests must be allowed to load public open Supabase briefs');
assert(remoteLoader.includes("query = query.eq('status', 'open')"), 'Guest project queries must be limited to open briefs');

console.log('OK: Project Board uses live public briefs and quarantines demo rows.');
