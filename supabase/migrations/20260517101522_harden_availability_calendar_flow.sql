alter table public.availability
  add column if not exists source text not null default 'manual',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'availability_status_allowed'
      and conrelid = 'public.availability'::regclass
  ) then
    alter table public.availability
      add constraint availability_status_allowed
      check (status in ('available', 'booked', 'tentative'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'availability_source_allowed'
      and conrelid = 'public.availability'::regclass
  ) then
    alter table public.availability
      add constraint availability_source_allowed
      check (source in ('manual', 'google_busy', 'booking', 'system'));
  end if;
end $$;

create index if not exists idx_availability_listing_date
  on public.availability(listing_id, date);

create or replace function public.set_availability_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_availability_updated_at on public.availability;
create trigger set_availability_updated_at
  before update on public.availability
  for each row
  execute function public.set_availability_updated_at();
