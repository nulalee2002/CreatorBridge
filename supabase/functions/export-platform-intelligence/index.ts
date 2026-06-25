import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [keys.join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return json({ error: 'Authentication required' }, 401);
    const { data: isAdmin } = await admin.rpc('is_platform_admin', { p_user_id: auth.user.id });
    if (!isAdmin) return json({ error: 'Admin access required' }, 403);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const exportKind = body.exportKind === 'csv' ? 'csv' : 'json';
    const periodStart = body.periodStart || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const periodEnd = body.periodEnd || new Date().toISOString().slice(0, 10);

    const { data: rows, error } = await admin
      .from('platform_intelligence_daily_rollups')
      .select('period_date,event_name,event_version,authority,entity_type,surface,event_count,actor_count_public,suppressed,freshness_at')
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('period_date', { ascending: true })
      .order('event_name', { ascending: true });
    if (error) throw error;

    const safeRows = (rows || []).map((row) => ({
      period_date: row.period_date,
      event_name: row.event_name,
      event_version: row.event_version,
      authority: row.authority,
      entity_type: row.entity_type,
      surface: row.surface,
      event_count: row.event_count,
      actor_count: row.suppressed ? null : row.actor_count_public,
      suppressed: row.suppressed,
      suppression_notice: row.suppressed ? 'Suppressed because fewer than 5 actors are represented.' : null,
      freshness_at: row.freshness_at,
    }));

    const { data: definitions } = await admin
      .from('platform_intelligence_metric_definitions')
      .select('metric_key,version')
      .eq('active', true);
    const definitionVersions = Object.fromEntries((definitions || []).map((definition) => [definition.metric_key, definition.version]));
    const suppressionCount = safeRows.filter((row) => row.suppressed).length;

    const { data: archive, error: archiveError } = await admin
      .from('platform_intelligence_exports')
      .insert({
        requested_by: auth.user.id,
        export_kind: exportKind,
        period_start: periodStart,
        period_end: periodEnd,
        row_count: safeRows.length,
        suppression_count: suppressionCount,
        definition_versions: definitionVersions,
      })
      .select('id,expires_at,created_at')
      .single();
    if (archiveError) throw archiveError;

    return json({
      export: {
        id: archive.id,
        format: exportKind,
        periodStart,
        periodEnd,
        expiresAt: archive.expires_at,
        generatedAt: archive.created_at,
        provenance: 'platform_intelligence_daily_rollups',
        privacy: {
          includesDirectIdentifiers: false,
          includesMessageContent: false,
          includesFileContent: false,
          smallCohortThreshold: 5,
        },
        definitionVersions,
        suppressionCount,
      },
      data: exportKind === 'csv' ? toCsv(safeRows) : safeRows,
    });
  } catch (error) {
    return json({ error: error?.message ?? 'Export failed' }, 400);
  }
});
