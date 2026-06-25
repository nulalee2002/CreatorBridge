import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-secret',
  'Content-Type': 'application/json',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeekMonday(date: Date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = next.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

function periodFor(reportType: string, now = new Date()) {
  if (reportType === 'monthly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = addDays(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)), -1);
    return { start, end, key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}` };
  }
  if (reportType === 'quarterly') {
    const quarter = Math.floor(now.getUTCMonth() / 3);
    const start = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
    const end = addDays(new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 1)), -1);
    return { start, end, key: `${start.getUTCFullYear()}-Q${quarter + 1}` };
  }
  const start = startOfWeekMonday(now);
  const end = addDays(start, 6);
  return { start, end, key: `week-${isoDate(start)}` };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const limited = checkRateLimit(req, { maxRequests: 8, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const expected = Deno.env.get('PLATFORM_INTELLIGENCE_JOB_SECRET');
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    let userId: string | null = null;
    let authorized = Boolean(expected && req.headers.get('x-job-secret') === expected);
    if (!authorized && token) {
      const { data: auth } = await admin.auth.getUser(token);
      userId = auth.user?.id ?? null;
      if (userId) {
        const { data: isAdmin } = await admin.rpc('is_platform_admin', { p_user_id: userId });
        authorized = Boolean(isAdmin);
      }
    }
    if (!authorized) return json({ error: 'Admin or job-secret access required' }, 403);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const reportType = ['weekly', 'monthly', 'quarterly', 'training'].includes(body.reportType) ? body.reportType : 'weekly';
    const period = body.periodStart && body.periodEnd
      ? { start: new Date(`${body.periodStart}T00:00:00Z`), end: new Date(`${body.periodEnd}T00:00:00Z`), key: body.periodKey || `${reportType}-${body.periodStart}` }
      : periodFor(reportType);

    const { data: rows, error } = await admin
      .from('platform_intelligence_daily_rollups')
      .select('period_date,event_name,authority,entity_type,surface,event_count,actor_count_public,suppressed,freshness_at')
      .gte('period_date', isoDate(period.start))
      .lte('period_date', isoDate(period.end));
    if (error) throw error;

    const totalEvents = (rows || []).reduce((sum, row) => sum + Number(row.event_count || 0), 0);
    const suppressed = (rows || []).filter((row) => row.suppressed).length;
    const serverEvents = (rows || []).filter((row) => row.authority === 'server_authoritative').reduce((sum, row) => sum + Number(row.event_count || 0), 0);
    const directionalEvents = (rows || []).filter((row) => row.authority === 'browser_directional').reduce((sum, row) => sum + Number(row.event_count || 0), 0);
    const latestFreshness = (rows || []).map((row) => row.freshness_at).filter(Boolean).sort().at(-1) ?? null;
    const stale = latestFreshness ? Date.now() - new Date(latestFreshness).getTime() > 48 * 3600000 : true;

    const summary = {
      reportType,
      periodStart: isoDate(period.start),
      periodEnd: isoDate(period.end),
      timezone: 'America/Phoenix',
      totalEvents,
      serverAuthoritativeEvents: serverEvents,
      directionalEvents,
      suppressedRows: suppressed,
      emptyTrainingReport: totalEvents === 0,
      sections: {
        externalDemand: 'Separated from internal collaboration in governed metric definitions.',
        internalCollaboration: 'Creator-to-creator activity tracked separately from external client demand.',
        margin: 'Contribution should be analyzed net of processing costs where payment events are available.',
      },
      aiHandoff: {
        source: 'platform_intelligence_daily_rollups',
        privateMessageContentIncluded: false,
        creativeFileContentIncluded: false,
        directIdentifiersIncluded: false,
      },
    };

    const { data: report, error: reportError } = await admin
      .from('platform_intelligence_reports')
      .upsert({
        report_type: reportType,
        period_key: period.key,
        period_start: isoDate(period.start),
        period_end: isoDate(period.end),
        timezone: 'America/Phoenix',
        status: totalEvents === 0 ? 'empty' : stale ? 'stale_source' : 'generated',
        summary,
        row_count: rows?.length ?? 0,
        suppression_count: suppressed,
        stale_source_warning: stale ? 'No fresh platform intelligence events in the last 48 hours.' : null,
        generated_by: userId,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'report_type,period_key' })
      .select('id,report_type,period_key,status,row_count,suppression_count,generated_at')
      .single();
    if (reportError) throw reportError;

    return json({ ok: true, report, summary });
  } catch (error) {
    return json({ error: error?.message ?? 'Report generation failed' }, 400);
  }
});
