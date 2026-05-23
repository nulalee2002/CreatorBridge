create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('terms_of_service', 'creator_agreement')),
  document_version text not null default '1.0',
  accepted_at timestamptz not null default now(),
  ip_address text,
  constraint unique_user_doc_version unique (user_id, document_type, document_version)
);

alter table public.legal_acceptances enable row level security;

create policy "Users can view own legal acceptances"
  on public.legal_acceptances
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own legal acceptances"
  on public.legal_acceptances
  for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on table public.legal_acceptances to authenticated;
