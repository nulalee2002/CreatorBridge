import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Token-gated retention job (cleanup-support-screenshots pattern), called
// daily by pg_cron with the x-cleanup-token header. Two passes:
//  1. Backfill recording_expires_at (final_released_at + 120 days) for calls
//     whose final payment released after the recording was stored.
//  2. Permanently delete recordings and transcripts past their deadline,
//     keeping the written call summary as the durable record.

const MAX_BATCH = 100;
const RETENTION_DAYS = 120;

function response(body: unknown, status = 200) {
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

function storagePath(ref: string, bucket: string) {
  const prefix = `storage://${bucket}/`;
  return ref?.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return response({ error: 'method not allowed' }, 405);

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return response({ error: 'not configured' }, 500);
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: cfg, error: cfgErr } = await supabase
      .from('support_report_config')
      .select('cleanup_token')
      .limit(1)
      .single();
    if (cfgErr || !cfg) return response({ error: 'no config' }, 500);

    const token = req.headers.get('x-cleanup-token') || '';
    if (!safeEqual(token, cfg.cleanup_token || '')) {
      return response({ error: 'unauthorized' }, 401);
    }

    // Pass 1: backfill expiry dates from released final payments.
    const { data: pendingExpiry, error: pendingErr } = await supabase
      .from('project_calls')
      .select('id, project_id')
      .is('recording_expires_at', null)
      .or('recording_ref.not.is.null,transcript_ref.not.is.null')
      .limit(MAX_BATCH);
    if (pendingErr) return response({ error: pendingErr.message }, 500);

    let backfilled = 0;
    for (const call of pendingExpiry || []) {
      const { data: txn } = await supabase
        .from('transactions')
        .select('final_released_at')
        .eq('project_id', call.project_id)
        .not('final_released_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (txn?.final_released_at) {
        const expiresAt = new Date(
          new Date(txn.final_released_at).getTime() + RETENTION_DAYS * 86400000,
        ).toISOString();
        const { error: setErr } = await supabase
          .from('project_calls')
          .update({ recording_expires_at: expiresAt })
          .eq('id', call.id);
        if (!setErr) backfilled += 1;
      }
    }

    // Pass 2: delete expired files, keep the summary text.
    const nowIso = new Date().toISOString();
    const { data: expired, error: expiredErr } = await supabase
      .from('project_calls')
      .select('id, recording_ref, transcript_ref, recording_expires_at')
      .lt('recording_expires_at', nowIso)
      .or('recording_ref.not.is.null,transcript_ref.not.is.null')
      .limit(MAX_BATCH);
    if (expiredErr) return response({ error: expiredErr.message }, 500);

    let deleted = 0;
    for (const call of expired || []) {
      const recordingPath = storagePath(call.recording_ref || '', 'call-recordings');
      const transcriptPath = storagePath(call.transcript_ref || '', 'call-transcripts');

      if (recordingPath) {
        const { error: removeErr } = await supabase.storage.from('call-recordings').remove([recordingPath]);
        if (removeErr) return response({ error: removeErr.message, callId: call.id }, 500);
      }
      if (transcriptPath) {
        const { error: removeErr } = await supabase.storage.from('call-transcripts').remove([transcriptPath]);
        if (removeErr) return response({ error: removeErr.message, callId: call.id }, 500);
      }

      const { error: clearErr } = await supabase
        .from('project_calls')
        .update({ recording_ref: null, transcript_ref: null })
        .eq('id', call.id);
      if (clearErr) return response({ error: clearErr.message, callId: call.id }, 500);
      deleted += 1;
    }

    return response({ success: true, backfilled, deleted, retentionDays: RETENTION_DAYS });
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});
