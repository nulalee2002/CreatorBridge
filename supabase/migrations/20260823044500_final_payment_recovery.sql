-- Durable, recoverable final-payment processing. Approval queues an attempt;
-- only the signed Stripe webhook may mark funds paid or release a creator payout.

alter table public.transactions
  add column if not exists stripe_customer_id text,
  add column if not exists payment_method_consent_at timestamptz,
  add column if not exists payment_method_consent_version text,
  add column if not exists final_payment_queued_at timestamptz,
  add column if not exists final_payment_attempted_at timestamptz,
  add column if not exists final_payment_attempt_count integer not null default 0,
  add column if not exists final_payment_error_code text,
  add column if not exists final_payment_error_message text,
  add column if not exists final_payment_requires_action boolean not null default false,
  add column if not exists final_payment_attention_at timestamptz;

create table if not exists public.project_final_payment_jobs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'claimed', 'attention', 'processing', 'complete')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_final_payment_jobs enable row level security;
revoke all on public.project_final_payment_jobs from public, anon, authenticated;

create index if not exists project_final_payment_jobs_claim_idx
  on public.project_final_payment_jobs (status, available_at, created_at);

create or replace function public.queue_project_final_payment(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_job_id uuid;
begin
  select * into v_transaction
  from public.transactions
  where project_id::text = p_project_id::text
  for update;

  if not found then
    raise exception 'Project transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.retainer_status not in ('paid', 'released') then
    raise exception 'Retainer must be paid before final payment' using errcode = '55000';
  end if;
  if v_transaction.final_status in ('paid', 'released') then
    return null;
  end if;

  update public.transactions
  set final_status = 'queued',
      final_payment_queued_at = coalesce(final_payment_queued_at, now()),
      final_payment_error_code = null,
      final_payment_error_message = null,
      final_payment_requires_action = false,
      updated_at = now()
  where id = v_transaction.id;

  insert into public.project_final_payment_jobs (transaction_id, status, available_at)
  values (v_transaction.id, 'queued', now())
  on conflict (transaction_id) do update
    set status = case when project_final_payment_jobs.status = 'complete' then 'complete' else 'queued' end,
        available_at = now(), claimed_at = null, last_error = null, updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function private.queue_final_payment_after_delivery_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    perform public.queue_project_final_payment(new.project_id);
  end if;
  return new;
exception
  when sqlstate 'P0002' then
    -- A legacy delivery without a transaction should remain approved; the
    -- client will see payment attention after staff reconciliation.
    return new;
end;
$$;

drop trigger if exists queue_final_payment_after_delivery_approval on public.project_deliveries;
create trigger queue_final_payment_after_delivery_approval
after update of status on public.project_deliveries
for each row execute function private.queue_final_payment_after_delivery_approval();

create or replace function public.claim_project_final_payment_jobs(p_limit integer default 25)
returns table (job_id uuid, transaction_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select job.id
    from public.project_final_payment_jobs job
    join public.transactions txn on txn.id = job.transaction_id
    where job.status in ('queued', 'claimed')
      and job.available_at <= now()
      and (job.status = 'queued' or job.claimed_at < now() - interval '15 minutes')
      and txn.final_status not in ('paid', 'released')
    order by job.available_at, job.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.project_final_payment_jobs job
  set status = 'claimed', claimed_at = now(), attempts = job.attempts + 1, updated_at = now()
  from due
  where job.id = due.id
  returning job.id, job.transaction_id;
end;
$$;

create or replace function public.complete_project_final_payment_job(
  p_job_id uuid,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('attention', 'processing', 'complete') then
    raise exception 'Invalid final payment job status' using errcode = '22023';
  end if;
  update public.project_final_payment_jobs
  set status = p_status,
      last_error = case when p_error is null then null else left(p_error, 2000) end,
      claimed_at = null,
      updated_at = now()
  where id = p_job_id;
end;
$$;

revoke all on function public.queue_project_final_payment(uuid) from public, anon, authenticated;
revoke all on function public.claim_project_final_payment_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_project_final_payment_job(uuid, text, text) from public, anon, authenticated;
grant execute on function public.queue_project_final_payment(uuid) to service_role;
grant execute on function public.claim_project_final_payment_jobs(integer) to service_role;
grant execute on function public.complete_project_final_payment_job(uuid, text, text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'creatorbridge-process-final-payments';
select cron.schedule(
  'creatorbridge-process-final-payments',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'creatorbridge_final_payment_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-platform-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'creatorbridge_job_secret')
      ),
      body := '{"source":"supabase-cron"}'::jsonb
    );
  $cron$
);
