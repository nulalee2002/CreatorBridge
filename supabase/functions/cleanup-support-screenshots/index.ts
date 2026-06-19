import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_BATCH = 500;

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

// Token-gated maintenance function. Called daily by pg_cron with the x-cleanup-token
// header. Deletes screenshot files for tickets that were resolved more than
// retention_days ago, keeping the lightweight text row (unless the admin opts in to
// full-row deletion). verify_jwt is intentionally false; auth is the shared token.
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return response({ error: 'method not allowed' }, 405);

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      return response({ error: 'not configured' }, 500);
    }
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: cfg, error: cfgErr } = await supabase
      .from('support_report_config')
      .select('cleanup_token, retention_days, delete_row_after_resolve')
      .limit(1)
      .single();
    if (cfgErr || !cfg) {
      return response({ error: 'no config' }, 500);
    }

    const token = req.headers.get('x-cleanup-token') || '';
    if (!safeEqual(token, cfg.cleanup_token || '')) {
      return response({ error: 'unauthorized' }, 401);
    }

    const retentionDays = Number(cfg.retention_days) > 0 ? Number(cfg.retention_days) : 30;
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

    const { data: tickets, error: selErr } = await supabase
      .from('support_tickets')
      .select('id, screenshot_path')
      .eq('status', 'resolved')
      .not('screenshot_path', 'is', null)
      .lt('updated_at', cutoff)
      .limit(500);
    if (selErr) {
      return response({ error: selErr.message }, 500);
    }

    const batch = (tickets || []).slice(0, MAX_BATCH);
    if (batch.length === 0) return response({ success: true, processed: 0, retentionDays });

    const paths = batch.map(ticket => ticket.screenshot_path).filter(Boolean);
    const { error: removeError } = await supabase.storage.from('support-screenshots').remove(paths);
    if (removeError) {
      return response({ error: removeError.message }, 500);
    }

    const ids = batch.map(ticket => ticket.id);
    if (cfg.delete_row_after_resolve) {
      const { error: deleteError } = await supabase.from('support_tickets').delete().in('id', ids);
      if (deleteError) return response({ error: deleteError.message }, 500);
    } else {
      const { error: clearError } = await supabase
        .from('support_tickets')
        .update({ screenshot_path: null })
        .in('id', ids);
      if (clearError) return response({ error: clearError.message }, 500);
    }

    return response({ success: true, processed: batch.length, retentionDays });
  } catch (err) {
    return response({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});
