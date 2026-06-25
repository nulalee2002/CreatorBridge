import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sql = readdirSync(join(root, 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(root, 'supabase/migrations', file), 'utf8'))
  .join('\n')
  .toLowerCase();
const compactSql = sql.replace(/\s+/g, ' ');
const read = (file) => existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : '';
const projectBoard = read('src/pages/ProjectBoard.jsx');
const ui = [
  read('src/components/collaboration/ProjectWorkspaces.jsx'),
  read('src/components/collaboration/DeliveryAnchorForm.jsx'),
  projectBoard,
].join('\n');

const checks = [];
const ok = (name, pass) => checks.push([name, Boolean(pass)]);

ok('workspace table', sql.includes('create table if not exists public.collaboration_workspace_links'));
ok('two workspace types', sql.includes("'client_delivery', 'production_team'"));
for (const host of ['drive.google.com', 'dropbox.com', 'frame.io', 'blackmagiccloud.com', 'masv.io']) {
  ok(`${host} allowed`, sql.includes(host));
}
ok('shorteners rejected', sql.includes('shortened links are not allowed') && sql.includes('tinyurl.com'));
ok('payment first', compactSql.includes("status not in ('funded', 'in_progress', 'delivered', 'revision', 'approved', 'completed')"));
ok('immutable history', sql.includes('collaboration_workspace_link_history') && sql.includes("action in ('created', 'replaced', 'revoked')"));
ok('revoke operation', sql.includes('revoke_collaboration_workspace_link'));
ok('delivery manifests', sql.includes('collaboration_delivery_anchors'));
ok('sizes stored', sql.includes('sizes_bytes bigint[]'));
ok('checksums stored', sql.includes('checksums jsonb'));
ok('preview reference stored', sql.includes('preview_reference text'));
ok('client/team isolation', sql.includes('workspace members can read authorized links') && sql.includes("workspace_type = 'client_delivery'"));
ok('client delivery prime-only', sql.includes('only the prime manages client delivery'));
ok('creator responsibility', ui.includes('permissions, backups, copyright, and retention'));
ok('delivery UI', ui.includes('Submit delivery evidence'));
ok('project board integration', projectBoard.includes('CollaborationWorkspacePanel') && projectBoard.includes('Add to This Project'));

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error('Workspace contracts incomplete:');
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.length }, null, 2));
