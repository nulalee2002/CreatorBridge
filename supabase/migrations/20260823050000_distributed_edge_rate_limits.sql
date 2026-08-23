create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.edge_rate_limit_buckets (
  action_key text not null check (char_length(action_key) between 1 and 120),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  request_count integer not null check (request_count > 0),
  bucket_started_at timestamptz not null,
  window_expires_at timestamptz not null,
  primary key (action_key, subject_hash)
);

create index if not exists edge_rate_limit_buckets_expiry_idx
  on private.edge_rate_limit_buckets (window_expires_at);

revoke all on table private.edge_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on table private.edge_rate_limit_buckets to service_role;

create or replace function private.consume_edge_rate_limit(
  p_action_key text,
  p_subject_hash text,
  p_limit_count integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row private.edge_rate_limit_buckets%rowtype;
begin
  if p_action_key is null or char_length(p_action_key) not between 1 and 120
    or p_subject_hash !~ '^[0-9a-f]{64}$'
    or p_limit_count not between 1 and 10000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action_key || ':' || p_subject_hash, 0));

  insert into private.edge_rate_limit_buckets as bucket (
    action_key, subject_hash, request_count, bucket_started_at, window_expires_at
  ) values (
    p_action_key, p_subject_hash, 1, v_now, v_now + make_interval(secs => p_window_seconds)
  )
  on conflict (action_key, subject_hash) do update
  set request_count = case
        when bucket.window_expires_at <= clock_timestamp() then 1
        else bucket.request_count + 1
      end,
      bucket_started_at = case
        when bucket.window_expires_at <= clock_timestamp() then v_now
        else bucket.bucket_started_at
      end,
      window_expires_at = case
        when bucket.window_expires_at <= clock_timestamp() then v_now + make_interval(secs => p_window_seconds)
        else bucket.window_expires_at
      end
  returning * into v_row;

  return query select
    v_row.request_count <= p_limit_count,
    greatest(0, p_limit_count - v_row.request_count),
    case
      when v_row.request_count <= p_limit_count then 0
      else greatest(1, ceil(extract(epoch from (v_row.window_expires_at - v_now)))::integer)
    end;
end;
$$;

revoke all on function private.consume_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function private.consume_edge_rate_limit(text, text, integer, integer) to service_role;

-- PostgREST exposes public, not private. This service-role-only gateway keeps
-- the ledger and atomic implementation outside every public Data API schema.
create or replace function public.consume_edge_rate_limit(
  p_action_key text,
  p_subject_hash text,
  p_limit_count integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language sql
security definer
set search_path = pg_catalog, private
as $$
  select * from private.consume_edge_rate_limit(
    p_action_key,
    p_subject_hash,
    p_limit_count,
    p_window_seconds
  );
$$;

revoke all on function public.consume_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'prune-edge-rate-limit-buckets';

    perform cron.schedule(
      'prune-edge-rate-limit-buckets',
      '17 * * * *',
      $job$delete from private.edge_rate_limit_buckets where window_expires_at < clock_timestamp() - interval '1 hour'$job$
    );
  end if;
end;
$$;
