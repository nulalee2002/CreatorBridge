-- 1. context + screenshot columns on support_tickets
alter table public.support_tickets
  add column if not exists page_path text,
  add column if not exists user_agent text,
  add column if not exists viewport text,
  add column if not exists screenshot_path text;

-- 2. private screenshot bucket (2.5MB cap, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-screenshots','support-screenshots', false, 2621440,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 3. storage RLS: user uploads/reads own folder; admins read all
drop policy if exists "support_shots_user_upload" on storage.objects;
create policy "support_shots_user_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-screenshots'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "support_shots_owner_read" on storage.objects;
create policy "support_shots_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-screenshots'
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "support_shots_admin_read" on storage.objects;
create policy "support_shots_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-screenshots'
         and exists (select 1 from public.platform_admins where user_id = auth.uid()));

-- 4. single-row config for retention + admin email + cleanup token
create table if not exists public.support_report_config (
  id boolean primary key default true check (id),
  retention_days int not null default 30,
  admin_email text not null default 'drl33@creatorbridge.studio',
  delete_row_after_resolve boolean not null default false,
  cleanup_token text not null default (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  updated_at timestamptz not null default now()
);
insert into public.support_report_config (id) values (true) on conflict (id) do nothing;

alter table public.support_report_config enable row level security;
drop policy if exists "support_cfg_admin_all" on public.support_report_config;
create policy "support_cfg_admin_all" on public.support_report_config
  for all to authenticated
  using (exists (select 1 from public.platform_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.platform_admins where user_id = auth.uid()));;
