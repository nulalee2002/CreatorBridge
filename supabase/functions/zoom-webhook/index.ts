import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Zoom Video SDK webhook. Verified with the Zoom Secret Token (x-zm-signature),
// like stripe-webhook. On session.recording_completed it copies the recording
// and VTT transcript into the private CreatorBridge buckets, stamps the
// retention deadline, deletes the Zoom-cloud copy, and triggers the summary.

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
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

// JWT for the Video SDK REST API (delete cloud recordings).
async function videoSdkApiJwt(sdkKey: string, sdkSecret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(encoder.encode(JSON.stringify({ iss: sdkKey, iat: now - 30, exp: now + 600 })));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sdkSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`)));
  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

async function downloadRecordingFile(downloadUrl: string, downloadToken: string) {
  const response = await fetch(downloadUrl, {
    headers: downloadToken ? { Authorization: `Bearer ${downloadToken}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Recording download failed with status ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Fail closed: without the webhook secret nothing can be verified.
  const webhookSecret = Deno.env.get('ZOOM_WEBHOOK_SECRET') || '';
  if (!webhookSecret) {
    console.error('zoom-webhook: ZOOM_WEBHOOK_SECRET is not set');
    return json({ error: 'not configured' }, 500);
  }

  const rawBody = await req.text();

  // Zoom includes these headers on normal events and URL-validation requests.
  // Verify before returning a challenge response so this endpoint cannot be
  // used as a chosen-message HMAC oracle for forging later webhook events.
  const timestamp = req.headers.get('x-zm-request-timestamp') || '';
  const signatureHeader = req.headers.get('x-zm-signature') || '';
  if (!timestamp || !signatureHeader) return json({ error: 'missing signature' }, 401);
  const ageMs = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(ageMs) || ageMs > 5 * 60_000) {
    return json({ error: 'stale webhook' }, 401);
  }
  const expected = `v0=${await hmacHex(webhookSecret, `v0:${timestamp}:${rawBody}`)}`;
  if (!safeEqual(signatureHeader, expected)) {
    return json({ error: 'signature mismatch' }, 401);
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid payload' }, 400);
  }

  // Zoom endpoint URL validation handshake.
  if (event?.event === 'endpoint.url_validation') {
    const plainToken = String(event?.payload?.plainToken || '');
    if (!plainToken) return json({ error: 'missing plainToken' }, 400);
    return json({
      plainToken,
      encryptedToken: await hmacHex(webhookSecret, plainToken),
    });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const object = event?.payload?.object || {};
    const sessionName = String(object.session_name || '');

    if (event.event === 'session.ended') {
      if (sessionName) {
        await admin
          .from('project_calls')
          .update({ status: 'completed', ended_at: new Date().toISOString() })
          .eq('zoom_session_name', sessionName)
          .in('status', ['scheduled', 'in_progress']);
      }
      return json({ received: true });
    }

    const isRecordingEvent = event.event === 'session.recording_completed';
    const isTranscriptEvent = event.event === 'session.recording_transcript_completed';
    if (!isRecordingEvent && !isTranscriptEvent) {
      return json({ received: true, ignored: event.event });
    }

    if (!sessionName) return json({ error: 'missing session name' }, 400);
    const { data: call, error: callError } = await admin
      .from('project_calls')
      .select('*')
      .eq('zoom_session_name', sessionName)
      .maybeSingle();
    if (callError || !call) {
      console.error('zoom-webhook: no call for session', sessionName);
      return json({ received: true, unmatched: true });
    }

    const downloadToken = String(event.download_token || '');
    const files: Array<Record<string, any>> = Array.isArray(object.recording_files)
      ? object.recording_files
      : [];

    // Audio only, by policy: only the M4A audio track is ever stored. Any MP4
    // video Zoom produced is skipped here and destroyed with the Zoom-cloud
    // copy below, so no video track is saved anywhere.
    const audioFile = files.find((f) =>
      String(f.file_type).toUpperCase() === 'M4A'
      || String(f.file_extension || '').toUpperCase() === 'M4A'
      || String(f.recording_type || '').toLowerCase() === 'audio_only');
    const transcriptFile = files.find((f) =>
      String(f.file_type).toUpperCase() === 'TRANSCRIPT'
      || String(f.file_type).toUpperCase() === 'VTT'
      || String(f.file_extension || '').toUpperCase() === 'VTT'
      || String(f.recording_type || '').toLowerCase() === 'audio_transcript');

    let recordingRef = call.recording_ref;
    let transcriptRef = call.transcript_ref;

    if (isRecordingEvent && !audioFile) {
      console.error(
        'zoom-webhook: recording event had no M4A audio. Enable audio-only files in Zoom recording settings. The Zoom copy was preserved for recovery.',
        call.id,
      );
      return json({ error: 'audio recording file missing' }, 422);
    }
    if (isTranscriptEvent && !transcriptFile) {
      console.error('zoom-webhook: transcript event had no VTT file. The Zoom copy was preserved for recovery.', call.id);
      return json({ error: 'transcript file missing' }, 422);
    }

    if (audioFile?.download_url && !recordingRef) {
      const bytes = await downloadRecordingFile(String(audioFile.download_url), downloadToken);
      const path = `${call.id}/recording.m4a`;
      const { error: uploadError } = await admin.storage
        .from('call-recordings')
        .upload(path, bytes, { contentType: 'audio/mp4', upsert: true, cacheControl: '0' });
      if (uploadError) throw new Error(`Recording upload failed: ${uploadError.message}`);
      recordingRef = `storage://call-recordings/${path}`;
    }

    if (transcriptFile?.download_url && !transcriptRef) {
      const bytes = await downloadRecordingFile(String(transcriptFile.download_url), downloadToken);
      const path = `${call.id}/transcript.vtt`;
      const { error: uploadError } = await admin.storage
        .from('call-transcripts')
        .upload(path, bytes, { contentType: 'text/vtt', upsert: true, cacheControl: '0' });
      if (uploadError) throw new Error(`Transcript upload failed: ${uploadError.message}`);
      transcriptRef = `storage://call-transcripts/${path}`;
    }

    // Retention deadline: 120 days after the final payment released. If the
    // final has not released yet, cleanup-call-recordings backfills this
    // nightly once transactions.final_released_at lands.
    const { data: txn } = await admin
      .from('transactions')
      .select('final_released_at')
      .eq('project_id', call.project_id)
      .not('final_released_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const recordingExpiresAt = txn?.final_released_at
      ? new Date(new Date(txn.final_released_at).getTime() + 120 * 86400000).toISOString()
      : null;

    const { error: updateError } = await admin
      .from('project_calls')
      .update({
        recording_ref: recordingRef,
        transcript_ref: transcriptRef,
        recording_expires_at: recordingExpiresAt,
        status: ['cancelled', 'no_show'].includes(call.status) ? call.status : 'completed',
        ended_at: call.ended_at || new Date().toISOString(),
      })
      .eq('id', call.id);
    if (updateError) throw new Error(`Call update failed: ${updateError.message}`);

    // Delete the Zoom-cloud copy only after BOTH promised private artifacts
    // are stored. Recording and transcript complete in separate webhook events.
    const sdkKey = Deno.env.get('ZOOM_VIDEO_SDK_KEY') || '';
    const sdkSecret = Deno.env.get('ZOOM_VIDEO_SDK_SECRET') || '';
    const sessionId = String(object.session_id || '');
    if (recordingRef && transcriptRef) {
      if (!sdkKey || !sdkSecret || !sessionId) {
        throw new Error('Zoom cloud deletion is not configured for this completed recording');
      }
      const apiJwt = await videoSdkApiJwt(sdkKey, sdkSecret);
      const deleteResponse = await fetch(
        `https://api.zoom.us/v2/videosdk/sessions/${encodeURIComponent(sessionId)}/recordings`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${apiJwt}` } },
      );
      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        const deleteBody = await deleteResponse.text();
        console.error('zoom-webhook: Zoom cloud delete failed', deleteResponse.status, deleteBody);
        throw new Error(`Zoom cloud deletion failed with status ${deleteResponse.status}`);
      }
    }

    // Trigger the AI draft summary. Failure here must not fail the webhook;
    // the transcript is stored and the summary can be retried.
    if (transcriptRef) {
      try {
        const summaryResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/summarize-call`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ callId: call.id }),
          },
        );
        if (!summaryResponse.ok) {
          const summaryBody = await summaryResponse.text();
          console.error('zoom-webhook: summarize-call failed', summaryResponse.status, summaryBody);
          throw new Error(`Summary generation failed with status ${summaryResponse.status}`);
        }
      } catch (summaryError) {
        console.error('zoom-webhook: summarize-call errored', summaryError);
        throw summaryError;
      }
    }

    return json({ received: true, recording: !!recordingRef, transcript: !!transcriptRef });
  } catch (error) {
    console.error('zoom-webhook error:', error);
    return json({ error: error instanceof Error ? error.message : 'webhook processing failed' }, 500);
  }
});
