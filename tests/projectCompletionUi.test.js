import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const files = [
  'src/components/project/DeliveryComposer.jsx',
  'src/components/project/DeliveryHistory.jsx',
  'src/components/project/DeliveryReviewPanel.jsx',
  'src/components/project/RevisionPurchasePanel.jsx',
  'src/components/ProjectProtectionGuide.jsx',
  'src/hooks/useProjectCompletion.js',
];

test('unified completion components and hook exist', () => {
  for (const path of files) assert.equal(existsSync(new URL(path, root)), true, `${path} must exist`);
});

test('composer communicates final-only delivery, mixed links, 5 GB, and resumable progress', () => {
  const source = readFileSync(new URL(files[0], root), 'utf8');
  assert.match(source, /finished deliverables/i);
  assert.match(source, /5 GB/);
  assert.match(source, /Google Drive|Dropbox/);
  assert.match(source, /external/i);
  assert.match(source, /tus\.Upload/);
  assert.match(source, /pause/i);
  assert.match(source, /resume/i);
  assert.doesNotMatch(source, /200\s*MB/i);
});

test('review UI uses two included revisions, exact $50, server deadline, and history', () => {
  const review = readFileSync(new URL(files[2], root), 'utf8');
  const purchase = readFileSync(new URL(files[3], root), 'utf8');
  const history = readFileSync(new URL(files[1], root), 'utf8');
  assert.match(review, /2 included revisions/i);
  assert.match(review, /reviewDeadlineAt|review_deadline_at/);
  assert.match(review, /requestRevision/);
  assert.match(purchase, /\$50\.00/);
  assert.match(purchase, /PaymentElement/);
  assert.match(history, /version/i);
  assert.match(history, /downloadItem/);
});

test('completion state reconciles provider changes without browser-controlled approval', () => {
  const hook = readFileSync(new URL(files[5], root), 'utf8');
  assert.match(hook, /postgres_changes/);
  assert.match(hook, /project_deliveries/);
  assert.match(hook, /project_revision_requests/);
  assert.match(hook, /transactions/);
  assert.match(hook, /refresh\(\{ silent: true \}\)/);
  assert.doesNotMatch(hook, /auto.?approve|approveProjectDelivery/i);
});

test('Project Board delegates delivery and revision actions to server completion state', () => {
  const board = readFileSync(new URL('src/pages/ProjectBoard.jsx', root), 'utf8');
  const motion = readFileSync(new URL('src/lib/motion.js', root), 'utf8');
  assert.match(board, /ProjectCompletionPanel/);
  assert.match(board, /data-no-reveal className="grid grid-cols-1 lg:grid-cols-\[1fr_420px\]/);
  assert.doesNotMatch(motion, /MOTION_ROUTES[\s\S]{0,250}'\/projects'/);
  assert.doesNotMatch(board, /Max 200MB/i);
  assert.doesNotMatch(board, /72 \* 3600000/);
  assert.doesNotMatch(board, /setInterval\([\s\S]{0,200}autoApproved/);
});

test('project guide ignores stale lookups when the selected project changes', () => {
  const guide = readFileSync(new URL('src/components/ProjectProtectionGuide.jsx', root), 'utf8');
  assert.match(guide, /let active = true/);
  assert.match(guide, /if \(!active\) return/);
  assert.match(guide, /if \(lookupError\) \{\s*setOpen\(true\)/);
  assert.match(guide, /setOpen\(!data\)/);
  assert.match(guide, /active = false/);
});
