create table public.project_conversations (
  project_id uuid primary key references public.projects(id) on delete restrict,
  conversation_id uuid not null unique default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (client_id <> creator_user_id)
);

alter table public.messages
  add column project_id uuid references public.projects(id) on delete restrict;

create index messages_project_created_idx
  on public.messages(project_id, created_at)
  where project_id is not null;

alter table public.project_conversations enable row level security;
revoke all on table public.project_conversations from anon, authenticated;
grant select on table public.project_conversations to authenticated;

create policy project_conversations_party_select
on public.project_conversations for select to authenticated
using (
  auth.uid() in (client_id, creator_user_id)
  or public.is_platform_admin(auth.uid())
);

create or replace function public.get_or_create_project_conversation(p_project_id uuid)
returns public.project_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_creator_user_id uuid;
  v_conversation public.project_conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id;
  if not found then raise exception 'Project not found' using errcode = 'P0002'; end if;

  select user_id into v_creator_user_id
  from public.creator_listings
  where id::text = v_project.accepted_creator_id::text;
  if v_creator_user_id is null then
    raise exception 'Project creator is not assigned' using errcode = '55000';
  end if;

  if auth.uid() not in (v_project.client_id, v_creator_user_id)
    and not public.is_platform_admin(auth.uid()) then
    raise exception 'Project party access required' using errcode = '42501';
  end if;

  insert into public.project_conversations (project_id, client_id, creator_user_id)
  values (v_project.id, v_project.client_id, v_creator_user_id)
  on conflict (project_id) do update set project_id = excluded.project_id
  returning * into v_conversation;

  if v_conversation.client_id is distinct from v_project.client_id
    or v_conversation.creator_user_id is distinct from v_creator_user_id then
    raise exception 'Project conversation party mismatch' using errcode = '55000';
  end if;

  return v_conversation;
end;
$$;

drop function if exists public.send_creatorbridge_message(uuid, text, uuid, uuid);

create or replace function public.send_creatorbridge_message(
  p_recipient_id uuid,
  p_body text,
  p_conversation_id uuid default null,
  p_listing_id uuid default null,
  p_project_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_message public.messages%rowtype;
  v_project_conversation public.project_conversations%rowtype;
  v_conversation_id uuid := coalesce(p_conversation_id, gen_random_uuid());
  v_body text := left(trim(coalesce(p_body, '')), 1500);
  v_contact_pattern boolean := false;
  v_active_booking boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception 'Valid recipient is required' using errcode = '22023';
  end if;
  if length(v_body) = 0 then raise exception 'Message body is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'Recipient not found' using errcode = 'P0002';
  end if;
  if p_listing_id is not null
    and not exists (select 1 from public.creator_listings where id = p_listing_id) then
    raise exception 'Creator listing not found' using errcode = 'P0002';
  end if;

  if p_project_id is not null then
    select * into v_project_conversation
    from public.get_or_create_project_conversation(p_project_id);
    if p_recipient_id not in (v_project_conversation.client_id, v_project_conversation.creator_user_id)
      or v_user_id not in (v_project_conversation.client_id, v_project_conversation.creator_user_id) then
      raise exception 'Project conversation recipient mismatch' using errcode = '42501';
    end if;
    if p_conversation_id is not null
      and p_conversation_id is distinct from v_project_conversation.conversation_id then
      raise exception 'Project conversation mismatch' using errcode = '42501';
    end if;
    v_conversation_id := v_project_conversation.conversation_id;
  elsif exists (select 1 from public.messages where conversation_id = v_conversation_id)
    and not exists (
      select 1 from public.messages
      where conversation_id = v_conversation_id
        and (
          (sender_id = v_user_id and recipient_id = p_recipient_id)
          or (sender_id = p_recipient_id and recipient_id = v_user_id)
        )
    ) then
    raise exception 'Conversation access denied' using errcode = '42501';
  end if;

  v_contact_pattern :=
    v_body ~* '[A-Za-z0-9._%+\-]+[[:space:]]*@[[:space:]]*[A-Za-z0-9.\-]+[[:space:]]*\.[[:space:]]*[A-Za-z]{2,}'
    or v_body ~* '\mat[[:space:]]+[A-Za-z0-9_\-]+[[:space:]]+dot[[:space:]]+(com|net|org|io|co|me|us|uk)\M'
    or v_body ~* '(\+?[0-9][[:space:]\-.\(\)]{0,2}){7,}[0-9]'
    or v_body ~* '\m(zero|one|two|three|four|five|six|seven|eight|nine)\M[[:space:]\-]+(zero|one|two|three|four|five|six|seven|eight|nine)'
    or v_body ~* '(https?://|www\.)[^[:space:]]+'
    or v_body ~* '\m[A-Za-z0-9_\-]+\.(com|net|org|io|co|me|us|uk|studio|app|dev|tv|media|photography|film|video)\M'
    or v_body ~* '@[A-Za-z0-9_.]{2,}';

  if v_contact_pattern then
    select exists (
      select 1
      from public.transactions txn
      join public.creator_listings listing on listing.id = txn.creator_id
      where (
          (txn.client_id = v_user_id and listing.user_id = p_recipient_id)
          or (txn.client_id = p_recipient_id and listing.user_id = v_user_id)
        )
        and (p_project_id is null or txn.project_id = p_project_id)
        and (
          txn.retainer_status in ('paid', 'released')
          or txn.final_status in ('paid', 'released')
        )
    ) into v_active_booking;
    if not v_active_booking then
      raise exception 'Contact details must stay inside CreatorBridge until a booking is active';
    end if;
  end if;

  insert into public.messages (
    conversation_id, sender_id, recipient_id, listing_id, project_id, body, read
  ) values (
    v_conversation_id, v_user_id, p_recipient_id, p_listing_id, p_project_id, v_body, false
  ) returning * into v_message;

  perform public.create_platform_notification(
    p_recipient_id,
    'direct_message_received',
    case when p_project_id is null then 'New message' else 'New project message' end,
    'You received a CreatorBridge message. Respond inside the platform within 24 hours.',
    case when p_project_id is null then '/messages' else '/messages?project=' || p_project_id::text end,
    jsonb_build_object(
      'conversation_id', v_conversation_id,
      'message_id', v_message.id,
      'listing_id', p_listing_id,
      'project_id', p_project_id
    ),
    v_user_id,
    now() + interval '24 hours'
  );

  return v_message;
end;
$$;

revoke all on function public.get_or_create_project_conversation(uuid) from public, anon;
revoke all on function public.send_creatorbridge_message(uuid, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_or_create_project_conversation(uuid) to authenticated, service_role;
grant execute on function public.send_creatorbridge_message(uuid, text, uuid, uuid, uuid) to authenticated;
