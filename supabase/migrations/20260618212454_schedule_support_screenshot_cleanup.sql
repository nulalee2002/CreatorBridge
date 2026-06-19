create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-support-screenshots-daily',
  '0 4 * * *',
  $job$ select net.http_post(
      url := 'https://mxizhszqhbhxzkkhgnmg.supabase.co/functions/v1/cleanup-support-screenshots',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cleanup-token', (select cleanup_token from public.support_report_config limit 1)
      )
    ); $job$
);;
