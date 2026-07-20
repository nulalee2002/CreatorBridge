import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const callRoom = read('src/components/calls/CallRoom.jsx');
const callsPanel = read('src/components/calls/ProjectCallsPanel.jsx');
const tokenFunction = read('supabase/functions/create-call-token/index.ts');
const webhook = read('supabase/functions/zoom-webhook/index.ts');
const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .filter(file => file.endsWith('.sql'))
  .sort()
  .map(file => read(`supabase/migrations/${file}`))
  .join('\n');

assert.match(callRoom, /getRecordingClient\(\)/, 'The call room must obtain Zoom recording control');
assert.match(callRoom, /startCloudRecording\(\)/, 'The creator host must start required cloud recording');
assert.match(callRoom, /state === 'Paused'/, 'The call must fail closed if required recording pauses');
assert.match(callRoom, /clientRef\.current === client/, 'Intentional cleanup must not masquerade as a remote disconnect');
assert.match(callRoom, /session\.startedAt/, 'Every participant must use the shared server start time');
assert.match(callRoom, /leave\([^)]*true/, 'The creator host must end the Zoom session at the hard cap');
assert.match(callsPanel, /setNow\(Date\.now\(\)\)/, 'Join and no-show windows must update while the page stays open');

assert.match(tokenFunction, /startedAt:/, 'The token response must include the shared call start time');

const validationBranch = webhook.indexOf("event?.event === 'endpoint.url_validation'");
const signatureCheck = webhook.indexOf('signature mismatch');
assert.ok(signatureCheck >= 0 && signatureCheck < validationBranch, 'Webhook signatures must be verified before URL validation');
assert.match(webhook, /session\.recording_transcript_completed/, 'The transcript completion event must be processed');
assert.doesNotMatch(webhook, /event\.event === 'recording\.completed'/, 'Meeting webhooks must not enter the Video SDK pipeline');
assert.doesNotMatch(webhook, /recordings\?action=delete/, 'Video SDK recording deletion must use the documented endpoint');
assert.match(webhook, /recordingRef\s*&&\s*transcriptRef/, 'Zoom copies must remain until both private files exist');

assert.match(migrations, /p_availability_date date/, 'Scheduling must bind the selected availability date');
assert.match(migrations, /pg_advisory_xact_lock/, 'The three-call cap must be concurrency safe');
assert.match(migrations, /for update/, 'Additional-call requests must be claimed atomically');

console.log('Video call safety verification passed.');
