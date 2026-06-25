create table if not exists public.platform_intelligence_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('weekly', 'monthly', 'quarterly', 'training')),
  period_key text not null,
  period_start date not null,
  period_end date not null,
  timezone text not null default 'America/Phoenix',
  status text not null default 'generated' check (status in ('generated', 'stale_source', 'empty', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  source_export_id uuid references public.platform_intelligence_exports(id) on delete set null,
  row_count integer not null default 0,
  suppression_count integer not null default 0,
  stale_source_warning text,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (report_type, period_key),
  check (period_end >= period_start)
);

create table if not exists public.platform_intelligence_report_schedules (
  report_type text primary key check (report_type in ('weekly', 'monthly', 'quarterly')),
  timezone text not null default 'America/Phoenix',
  cadence_description text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.collaboration_surveys (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.creator_collaborations(id) on delete cascade,
  respondent_id uuid not null references auth.users(id) on delete restrict,
  easier_than_doing_it_yourself text not null check (easier_than_doing_it_yourself in ('yes', 'somewhat', 'no')),
  floor_changed_scope text not null check (floor_changed_scope in ('yes', 'no', 'not_sure')),
  file_access_worked text not null check (file_access_worked in ('yes', 'minor_issue', 'no')),
  note text,
  created_at timestamptz not null default now(),
  unique (collaboration_id, respondent_id)
);

alter table public.platform_intelligence_reports enable row level security;
alter table public.platform_intelligence_report_schedules enable row level security;
alter table public.collaboration_surveys enable row level security;

revoke all on public.platform_intelligence_reports, public.platform_intelligence_report_schedules, public.collaboration_surveys from public, anon, authenticated;
grant all on public.platform_intelligence_reports, public.platform_intelligence_report_schedules, public.collaboration_surveys to service_role;
grant select on public.platform_intelligence_reports to authenticated;
grant select, insert on public.collaboration_surveys to authenticated;

create policy "Admins can read intelligence reports"
  on public.platform_intelligence_reports
  for select
  to authenticated
  using (public.is_platform_admin((select auth.uid())));

create policy "Admins can read report schedules"
  on public.platform_intelligence_report_schedules
  for select
  to authenticated
  using (public.is_platform_admin((select auth.uid())));

insert into public.platform_intelligence_report_schedules(report_type, timezone, cadence_description, enabled)
values
  ('weekly', 'America/Phoenix', 'Generate every Monday at 9:00 AM America/Phoenix.', true),
  ('monthly', 'America/Phoenix', 'Generate on the first day of each month at 9:00 AM America/Phoenix.', true),
  ('quarterly', 'America/Phoenix', 'Generate on the first day of each quarter at 9:00 AM America/Phoenix.', true)
on conflict (report_type) do update
set timezone = excluded.timezone,
    cadence_description = excluded.cadence_description,
    enabled = excluded.enabled;

create policy "Collaboration members can read surveys"
  on public.collaboration_surveys
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.creator_collaborations c
      where c.id = collaboration_id
        and ((select auth.uid()) in (c.prime_user_id, c.collaborator_user_id) or public.is_platform_admin((select auth.uid())))
    )
  );

create policy "Collaboration members can submit their own survey"
  on public.collaboration_surveys
  for insert
  to authenticated
  with check (
    respondent_id = (select auth.uid())
    and exists (
      select 1
      from public.creator_collaborations c
      where c.id = collaboration_id
        and c.status in ('approved', 'completed')
        and (select auth.uid()) in (c.prime_user_id, c.collaborator_user_id)
    )
  );

create or replace function public.get_admin_platform_intelligence_rollups(p_since date default current_date - 30)
returns table(
  authority text,
  event_count integer,
  suppressed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin((select auth.uid())) then
    raise exception 'Admin access required';
  end if;

  return query
  select r.authority, r.event_count, r.suppressed
  from public.platform_intelligence_daily_rollups r
  where r.period_date >= p_since;
end
$$;

revoke all on function public.get_admin_platform_intelligence_rollups(date) from public, anon;
grant execute on function public.get_admin_platform_intelligence_rollups(date) to authenticated;
