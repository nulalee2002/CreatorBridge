-- Quote request read receipts should be narrow and server-controlled.
-- Creators can mark received quote requests as read without gaining broad row update access.

alter table public.quote_requests
  add column if not exists read boolean not null default false;

create index if not exists idx_quote_requests_listing_read
  on public.quote_requests(listing_id, read, created_at desc);

drop policy if exists "Creators can update quote status" on public.quote_requests;

create or replace function public.mark_quote_request_read(p_quote_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.quote_requests qr
  set read = true
  where qr.id = p_quote_id
    and qr.read = false
    and exists (
      select 1
      from public.creator_listings cl
      where cl.id = qr.listing_id
        and cl.user_id = auth.uid()
    );

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.mark_quote_request_read(uuid) from public, anon;
grant execute on function public.mark_quote_request_read(uuid) to authenticated;
