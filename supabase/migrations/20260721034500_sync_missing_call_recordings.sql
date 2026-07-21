-- Recover completed Video SDK recordings when Zoom webhook delivery is delayed
-- or missed. The endpoint is protected by the existing maintenance token.
select cron.unschedule(jobid)
from cron.job
where jobname = 'sync-call-recordings-every-five-minutes';

select cron.schedule(
  'sync-call-recordings-every-five-minutes',
  '*/5 * * * *',
  $job$ select net.http_post(
      url := 'https://mxizhszqhbhxzkkhgnmg.supabase.co/functions/v1/sync-call-recordings',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cleanup-token', (select cleanup_token from public.support_report_config limit 1)
      )
    ); $job$
);
