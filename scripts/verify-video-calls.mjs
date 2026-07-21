import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const callRoom = read('src/components/calls/CallRoom.jsx');
const callsPanel = read('src/components/calls/ProjectCallsPanel.jsx');
const tokenFunction = read('supabase/functions/create-call-token/index.ts');
const webhook = read('supabase/functions/zoom-webhook/index.ts');
const recordingSync = read('supabase/functions/sync-call-recordings/index.ts');
const summarizer = read('supabase/functions/summarize-call/index.ts');
const supabaseConfig = read('supabase/config.toml');
const hardeningMigration = read('supabase/migrations/20260720234626_harden_video_call_pipeline.sql');
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
assert.match(webhook, /persistedCall\.recording_ref\s*&&\s*persistedCall\.transcript_ref/, 'Zoom copies must remain until both private files exist');
assert.match(webhook, /persistedCall/, 'Webhook processing must refresh artifact references after concurrent callbacks');
assert.doesNotMatch(
  webhook,
  /\.update\(\{[\s\S]{0,300}recording_ref:\s*recordingRef,[\s\S]{0,100}transcript_ref:\s*transcriptRef/,
  'Concurrent audio and transcript callbacks must not overwrite each other with stale null references',
);
assert.match(webhook, /ZOOM_VIDEO_API_KEY/, 'Zoom REST calls must use the API key, not the SDK key');
assert.match(webhook, /ZOOM_VIDEO_API_SECRET/, 'Zoom REST calls must use the API secret, not the SDK secret');
assert.doesNotMatch(
  webhook,
  /videoSdkApiJwt\(sdkKey, sdkSecret\)/,
  'Zoom REST calls must never be signed with the SDK credential pair',
);
assert.match(recordingSync, /type=past/, 'Recovery must resolve completed Video SDK sessions');
assert.match(recordingSync, /file_type[^\n]*M4A|file_extension[^\n]*M4A/, 'Recovery must store M4A audio only');
assert.match(recordingSync, /file_type[^\n]*TRANSCRIPT|file_extension[^\n]*VTT/, 'Recovery must store the VTT transcript');
assert.match(recordingSync, /recordingRef\s*&&\s*transcriptRef/, 'Recovery must retain Zoom files until both private artifacts exist');
assert.match(recordingSync, /ZOOM_VIDEO_API_KEY/, 'Recovery must use the distinct Zoom API credentials');
assert.match(recordingSync, /summarize-call/, 'Recovery must retry summary generation');
assert.match(summarizer, /extractiveFallbackSummary/, 'Summary generation must remain available during AI provider outages');
assert.match(summarizer, /Nothing discussed\./, 'The extractive fallback must not invent missing facts');
assert.match(supabaseConfig, /\[functions\.sync-call-recordings\][\s\S]*?verify_jwt = false/, 'The cron recovery endpoint must use its cleanup token instead of JWT auth');
assert.match(migrations, /sync-call-recordings[^\n]*[\s\S]*?\*\/5 \* \* \* \*/, 'Missing Zoom artifacts must be retried every five minutes');

assert.match(migrations, /p_availability_date date/, 'Scheduling must bind the selected availability date');
assert.match(migrations, /pg_advisory_xact_lock/, 'The three-call cap must be concurrency safe');
assert.match(migrations, /for update/, 'Additional-call requests must be claimed atomically');
assert.match(
  hardeningMigration,
  /create or replace function public\.schedule_project_call\(\s*p_project_id uuid,\s*p_scheduled_at timestamptz\s*\)[\s\S]*return public\.schedule_project_call\(p_project_id, p_scheduled_at, v_availability_date\)/,
  'The current frontend must retain a safe two-argument scheduling transition path',
);
assert.match(
  hardeningMigration,
  /create or replace function public\.reschedule_project_call\(\s*p_call_id uuid,\s*p_scheduled_at timestamptz\s*\)[\s\S]*return public\.reschedule_project_call\(p_call_id, p_scheduled_at, v_availability_date\)/,
  'The current frontend must retain a safe two-argument rescheduling transition path',
);

console.log('Video call safety verification passed.');
