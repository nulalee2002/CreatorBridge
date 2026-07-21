import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Webhooks are the primary ingestion path. This token-gated job recovers from
// delayed or missed Zoom delivery by polling recently completed sessions.
const encoder = new TextEncoder();
const MAX_BATCH = 25;
const LOOKBACK_DAYS = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function safeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function videoSdkApiJwt(apiKey: string, apiSecret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({ iss: apiKey, iat: now - 30, exp: now + 600 })));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64UrlEncode(signature)}`;
}

async function downloadFile(downloadUrl: string, token: string) {
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`recording download failed (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const apiKey = Deno.env.get('ZOOM_VIDEO_API_KEY') || Deno.env.get('ZOOM_API_KEY') || '';
  const apiSecret = Deno.env.get('ZOOM_VIDEO_API_SECRET') || Deno.env.get('ZOOM_API_SECRET') || '';
  if (!url || !serviceRoleKey || !apiKey || !apiSecret) {
    return json({ error: 'not configured' }, 500);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: config, error: configError } = await admin
    .from('support_report_config')
    .select('cleanup_token')
    .limit(1)
    .single();
  if (configError || !config) return json({ error: 'no config' }, 500);
  if (!safeEqual(req.headers.get('x-cleanup-token') || '', config.cleanup_token || '')) {
    return json({ error: 'unauthorized' }, 401);
  }

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const { data: calls, error: callsError } = await admin
    .from('project_calls')
    .select('id, project_id, zoom_session_name, recording_ref, transcript_ref, ended_at')
    .eq('status', 'completed')
    .not('zoom_session_name', 'is', null)
    .gte('ended_at', cutoff.toISOString())
    .order('ended_at', { ascending: false })
    .limit(MAX_BATCH);
  if (callsError) return json({ error: callsError.message }, 500);

  const apiJwt = await videoSdkApiJwt(apiKey, apiSecret);
  const from = cutoff.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const sessionsResponse = await fetch(
    `https://api.zoom.us/v2/videosdk/sessions?type=past&from=${from}&to=${to}&page_size=100`,
    { headers: { Authorization: `Bearer ${apiJwt}` } },
  );
  if (!sessionsResponse.ok) {
    return json({ error: `Zoom session list failed (${sessionsResponse.status})` }, 502);
  }
  const sessionsBody = await sessionsResponse.json();
  const sessions = Array.isArray(sessionsBody?.sessions) ? sessionsBody.sessions : [];
  const sessionsByName = new Map(sessions.map((session: Record<string, string>) => [session.session_name, session]));

  let recovered = 0;
  let summarized = 0;
  const pending: string[] = [];
  const errors: Array<{ callId: string; error: string }> = [];

  for (const call of calls || []) {
    try {
      const { data: existingSummary } = await admin
        .from('call_summaries')
        .select('id')
        .eq('call_id', call.id)
        .maybeSingle();

      let recordingRef = call.recording_ref;
      let transcriptRef = call.transcript_ref;
      if (!recordingRef || !transcriptRef) {
        const session = sessionsByName.get(call.zoom_session_name) as Record<string, string> | undefined;
        const sessionId = session?.session_id || session?.id;
        if (!sessionId) {
          pending.push(call.id);
          continue;
        }

        const recordingsResponse = await fetch(
          `https://api.zoom.us/v2/videosdk/sessions/${encodeURIComponent(sessionId)}/recordings`,
          { headers: { Authorization: `Bearer ${apiJwt}` } },
        );
        if (recordingsResponse.status === 404) {
          pending.push(call.id);
          continue;
        }
        if (!recordingsResponse.ok) {
          throw new Error(`Zoom recordings lookup failed (${recordingsResponse.status})`);
        }

        const recordings = await recordingsResponse.json();
        const files: Array<Record<string, string>> = Array.isArray(recordings?.recording_files)
          ? recordings.recording_files
          : [];
        const audioFile = files.find((file) =>
          file.status === 'completed' && (
            String(file.file_type).toUpperCase() === 'M4A'
            || String(file.file_extension).toUpperCase() === 'M4A'
            || String(file.recording_type).toLowerCase() === 'audio_only'
          ));
        const transcriptFile = files.find((file) =>
          file.status === 'completed' && (
            String(file.file_type).toUpperCase() === 'TRANSCRIPT'
            || String(file.file_extension).toUpperCase() === 'VTT'
            || String(file.recording_type).toLowerCase() === 'audio_transcript'
          ));
        const downloadToken = String(recordings.download_access_token || apiJwt);

        if (!recordingRef && audioFile?.download_url) {
          const bytes = await downloadFile(audioFile.download_url, downloadToken);
          const path = `${call.id}/recording.m4a`;
          const { error } = await admin.storage
            .from('call-recordings')
            .upload(path, bytes, { contentType: 'audio/mp4', upsert: true, cacheControl: '0' });
          if (error) throw new Error(`recording upload failed: ${error.message}`);
          recordingRef = `storage://call-recordings/${path}`;
        }

        if (!transcriptRef && transcriptFile?.download_url) {
          const bytes = await downloadFile(transcriptFile.download_url, downloadToken);
          const path = `${call.id}/transcript.vtt`;
          const { error } = await admin.storage
            .from('call-transcripts')
            .upload(path, bytes, { contentType: 'text/vtt', upsert: true, cacheControl: '0' });
          if (error) throw new Error(`transcript upload failed: ${error.message}`);
          transcriptRef = `storage://call-transcripts/${path}`;
        }

        if (recordingRef !== call.recording_ref || transcriptRef !== call.transcript_ref) {
          const { data: transaction } = await admin
            .from('transactions')
            .select('final_released_at')
            .eq('project_id', call.project_id)
            .not('final_released_at', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const expiresAt = transaction?.final_released_at
            ? new Date(new Date(transaction.final_released_at).getTime() + 120 * 86400000).toISOString()
            : null;
          const { error } = await admin
            .from('project_calls')
            .update({ recording_ref: recordingRef, transcript_ref: transcriptRef, recording_expires_at: expiresAt })
            .eq('id', call.id);
          if (error) throw new Error(`call update failed: ${error.message}`);
          recovered += 1;
        }

        if (recordingRef && transcriptRef) {
          const deleteResponse = await fetch(
            `https://api.zoom.us/v2/videosdk/sessions/${encodeURIComponent(sessionId)}/recordings`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${apiJwt}` } },
          );
          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            throw new Error(`Zoom cloud deletion failed (${deleteResponse.status})`);
          }
        } else {
          pending.push(call.id);
        }
      }

      if (transcriptRef && !existingSummary) {
        const summaryResponse = await fetch(`${url}/functions/v1/summarize-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ callId: call.id }),
        });
        if (!summaryResponse.ok) {
          throw new Error(`summary generation failed (${summaryResponse.status})`);
        }
        summarized += 1;
      }
    } catch (error) {
      errors.push({ callId: call.id, error: error instanceof Error ? error.message : 'unknown error' });
    }
  }

  return json({ success: errors.length === 0, inspected: calls?.length || 0, recovered, summarized, pending, errors });
});
