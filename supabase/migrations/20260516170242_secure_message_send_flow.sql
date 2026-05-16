-- Harden direct messaging so contact-protection rules are enforced in the database.
-- The browser can request a message send, but it can no longer insert message rows directly.

drop policy if exists "Authenticated users can send messages" on public.messages;

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

  if v_body ~* '[A-Za-z0-9._%+\-]+[[:space:]]*@[[:space:]]*[A-Za-z0-9.\-]+[[:space:]]*\.[[:space:]]*[A-Za-z]{2,}'
    or v_body ~* '\bat[[:space:]]+[A-Za-z0-9_\-]+[[:space:]]+dot[[:space:]]+(com|net|org|io|co|me|us|uk)\b'
    or v_body ~* '(\+?[0-9][[:space:]\-.\(\)]{0,2}){7,}[0-9]'
    or v_body ~* '\m(zero|one|two|three|four|five|six|seven|eight|nine)\M[[:space:]\-]+(zero|one|two|three|four|five|six|seven|eight|nine)'
    or v_body ~* '(https?://|www\.)[^[:space:]]+'
    or v_body ~* '\m[A-Za-z0-9_\-]+\.(com|net|org|io|co|me|us|uk|studio|app|dev|tv|media|photography|film|video)\M'
    or v_body ~* '@[A-Za-z0-9_.]{2,}'
  then
    raise exception 'Contact details must stay inside CreatorBridge until a booking is active';
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
