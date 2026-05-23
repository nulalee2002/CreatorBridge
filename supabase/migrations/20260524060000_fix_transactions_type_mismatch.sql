-- Fix transactions type mismatch: alter project_id and creator_id to uuid.
-- Add foreign key constraints, recreate indexes, and update RLS policies and database functions.

-- 1. Drop dependent indexes
drop index if exists public.idx_transactions_project;
drop index if exists public.idx_transactions_unique_booking;

-- 2. Drop RLS policies that reference old text columns
drop policy if exists "Users can view own transactions" on public.transactions;
drop policy if exists "Participants can view payment events" on public.payment_events;
drop policy if exists "Users can view own disputes" on public.disputes;
drop policy if exists "Users can open disputes" on public.disputes;

-- 3. Drop send_creatorbridge_message function to remove cl.id::text join dependence
drop function if exists public.send_creatorbridge_message(uuid, text, uuid, uuid);

-- 4. Alter columns to uuid type
alter table public.transactions
  alter column project_id type uuid using project_id::uuid,
  alter column creator_id type uuid using creator_id::uuid;

-- 5. Add foreign key constraints
alter table public.transactions
  add constraint fk_transactions_project foreign key (project_id) references public.projects(id) on delete cascade,
  add constraint fk_transactions_creator foreign key (creator_id) references public.creator_listings(id) on delete cascade;

-- 6. Recreate indexes
create index if not exists idx_transactions_project on public.transactions(project_id);
create unique index if not exists idx_transactions_unique_booking on public.transactions(project_id, creator_id, client_id);

-- 7. Recreate RLS policies without ::text casts
create policy "Users can view own transactions"
  on public.transactions
  for select
  to authenticated
  using (
    client_id = auth.uid()
    or creator_id in (
      select id from public.creator_listings where user_id = auth.uid()
    )
  );

create policy "Participants can view payment events"
  on public.payment_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and (
          t.client_id = auth.uid()
          or t.creator_id in (
            select id from public.creator_listings where user_id = auth.uid()
          )
        )
    )
  );

create policy "Users can view own disputes"
  on public.disputes
  for select
  to authenticated
  using (
    raised_by = auth.uid()
    or exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and (
          t.client_id = auth.uid()
          or t.creator_id in (
            select id from public.creator_listings where user_id = auth.uid()
          )
        )
    )
  );

create policy "Users can open disputes"
  on public.disputes
  for insert
  to authenticated
  with check (
    raised_by = auth.uid()
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and (
          t.client_id = auth.uid()
          or t.creator_id in (
            select id from public.creator_listings where user_id = auth.uid()
          )
        )
    )
  );

-- 8. Recreate send_creatorbridge_message function without ::text join
create or replace function public.send_creatorbridge_message(
  p_recipient_id uuid,
  p_body text,
  p_conversation_id uuid default null,
  p_listing_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_message public.messages%rowtype;
  v_conversation_id uuid := coalesce(p_conversation_id, gen_random_uuid());
  v_body text := left(trim(coalesce(p_body, '')), 1500);
  v_contact_pattern boolean := false;
  v_active_booking boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception 'Valid recipient is required';
  end if;

  if length(v_body) = 0 then
    raise exception 'Message body is required';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'Recipient not found';
  end if;

  if p_listing_id is not null
    and not exists (select 1 from public.creator_listings where id = p_listing_id)
  then
    raise exception 'Creator listing not found';
  end if;

  if exists (select 1 from public.messages where conversation_id = v_conversation_id)
    and not exists (
      select 1
      from public.messages
      where conversation_id = v_conversation_id
        and (
          (sender_id = v_user_id and recipient_id = p_recipient_id)
          or (sender_id = p_recipient_id and recipient_id = v_user_id)
        )
    )
  then
    raise exception 'Conversation access denied';
  end if;

  v_contact_pattern :=
    v_body ~* '[A-Za-z0-9._%+\-]+[[:space:]]*@[[:space:]]*[A-Za-z0-9.\-]+[[:space:]]*\.[[:space:]]*[A-Za-z]{2,}'
    or v_body ~* '\bat[[:space:]]+[A-Za-z0-9_\-]+[[:space:]]+dot[[:space:]]+(com|net|org|io|co|me|us|uk)\b'
    or v_body ~* '(\+?[0-9][[:space:]\-.\(\)]{0,2}){7,}[0-9]'
    or v_body ~* '\m(zero|one|two|three|four|five|six|seven|eight|nine)\M[[:space:]\-]+(zero|one|two|three|four|five|six|seven|eight|nine)'
    or v_body ~* '(https?://|www\.)[^[:space:]]+'
    or v_body ~* '\m[A-Za-z0-9_\-]+\.(com|net|org|io|co|me|us|uk|studio|app|dev|tv|media|photography|film|video)\M'
    or v_body ~* '@[A-Za-z0-9_.]{2,}';

  if v_contact_pattern then
    select exists (
      select 1
      from public.transactions t
      join public.creator_listings cl on cl.id = t.creator_id
      where (
          (t.client_id = v_user_id and cl.user_id = p_recipient_id)
          or (t.client_id = p_recipient_id and cl.user_id = v_user_id)
        )
        and (
          t.retainer_status in ('paid', 'released')
          or t.final_status in ('paid', 'released')
        )
      limit 1
    )
    into v_active_booking;

    if not v_active_booking then
      raise exception 'Contact details must stay inside CreatorBridge until a booking is active';
    end if;
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    recipient_id,
    listing_id,
    body,
    read
  )
  values (
    v_conversation_id,
    v_user_id,
    p_recipient_id,
    p_listing_id,
    v_body,
    false
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function public.send_creatorbridge_message(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.send_creatorbridge_message(uuid, text, uuid, uuid) to authenticated;
