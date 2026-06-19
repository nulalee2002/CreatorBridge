import { readFileSync, readdirSync } from 'node:fs';

const network = readFileSync('src/pages/NetworkingPage.jsx', 'utf8');
const profile = readFileSync('src/pages/CreatorProfilePage.jsx', 'utf8');
const migrationName = readdirSync('supabase/migrations').find(name => name.endsWith('_network_portfolio_project_sharing.sql'));
const migrations = migrationName ? readFileSync(`supabase/migrations/${migrationName}`, 'utf8') : '';

const checks = [
  ['portfolio feedback lane exists', network.includes('Portfolio Work & Feedback')],
  ['gear swap lane removed', !/Gear swap|gear-swap|selectedChannel[^\n]*gear/.test(network)],
  ['no direct network file upload', !/<input[^>]+type=["']file["']/i.test(network)],
  ['external network links are not rendered', !/target=["']_blank["']|function linkifyText/.test(network)],
  ['portfolio posts carry listing reference', network.includes('creator_listing_id')],
  ['portfolio posts carry item reference', network.includes('portfolio_item_id')],
  ['portfolio chooser loads approved profile work', network.includes("from('portfolio_items')") && network.includes("review_status', 'approved")],
  ['profile supports exact portfolio deep links', profile.includes('useSearchParams') && profile.includes('portfolio-section') && profile.includes('portfolio-${p.id}')],
  ['database validates portfolio ownership', migrations.includes('validate_network_portfolio_share') && migrations.includes('new.user_id')],
  ['database requires approved listing', migrations.includes("review_status = 'approved'")],
  ['database supports referral lane', migrations.includes("'referral'")],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}`);
  failed ||= !ok;
}

if (failed) process.exit(1);
console.log('\nClosed-loop network portfolio sharing checks passed.');
