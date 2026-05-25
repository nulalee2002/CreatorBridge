-- CreatorBridge notification center.
-- Adds private in-app notifications and records 24-hour response due dates for
-- contact and booking events. Rows are readable only by the recipient.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (
    type in (
      'quote_request_received',
      'direct_message_received',
      'proposal_received',
      'proposal_accepted',
      'retainer_paid',
      'delivery_submitted',
      'payment_released',
      'support_ticket_update',
      'system'
    )
  ),
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 500),
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  response_due_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_id, created_at desc);

create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "Users can mark own notifications read" on public.notifications;
create policy "Users can mark own notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

grant select on table public.notifications to authenticated;
grant update (read) on table public.notifications to authenticated;
revoke insert, delete on table public.notifications from anon, authenticated;

create or replace function public.create_platform_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default auth.uid(),
  p_response_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  if p_recipient_id is null then
    return null;
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    return null;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title,
    body,
    action_url,
    metadata,
    response_due_at
  )
  values (
    p_recipient_id,
    p_actor_id,
    p_type,
    left(trim(p_title), 140),
    left(trim(p_body), 500),
    nullif(left(trim(coalesce(p_action_url, '')), 240), ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_response_due_at
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_platform_notification(uuid, text, text, text, text, jsonb, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.accept_project_application(
  p_project_id uuid,
  p_application_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_application public.project_applications%rowtype;
  v_creator_stripe_account_id text;
  v_creator_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if v_project.client_id <> v_user_id then
    raise exception 'Only the project owner can accept an application';
  end if;

  if coalesce(v_project.status, 'open') <> 'open' then
    raise exception 'This project is not open for acceptance';
  end if;

  select *
  into v_application
  from public.project_applications
  where id = p_application_id
    and project_id = p_project_id
  for update;

  if not found then
    raise exception 'Application not found for this project';
  end if;

  select stripe_account_id, user_id
  into v_creator_stripe_account_id, v_creator_user_id
  from public.creator_listings
  where id = v_application.listing_id;

  if v_creator_stripe_account_id is null or length(trim(v_creator_stripe_account_id)) = 0 then
    raise exception 'This creator must connect a Stripe payout account before their proposal can be accepted';
  end if;

  update public.project_applications
  set status = case
    when id = p_application_id then 'accepted'
    when status = 'pending' then 'declined'
    else status
  end
  where project_id = p_project_id;

  update public.projects
  set status = 'accepted',
      accepted_creator_id = v_application.listing_id::text,
      accepted_application_id = v_application.id::text,
      applications = (
        select count(*)
        from public.project_applications
        where project_id = p_project_id
      )
  where id = p_project_id
  returning * into v_project;

  perform public.create_platform_notification(
    v_creator_user_id,
    'proposal_accepted',
    'Your proposal was accepted',
    'A client accepted your proposal. Respond in CreatorBridge within 24 hours and wait for the retainer before starting work.',
    '/dashboard',
    jsonb_build_object('project_id', p_project_id, 'application_id', p_application_id),
    v_user_id,
    now() + interval '24 hours'
  );

  select *
  into v_application
  from public.project_applications
  where id = p_application_id;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'application', to_jsonb(v_application)
  );
end;
$$;

revoke all on function public.accept_project_application(uuid, uuid) from public;
grant execute on function public.accept_project_application(uuid, uuid) to authenticated;

create or replace function public.submit_quote_request(
  p_listing_id uuid default null,
  p_project_title text default null,
  p_service_id text default null,
  p_description text default null,
  p_timeline text default null,
  p_budget numeric default null,
  p_project_type text default null,
  p_project_time text default null,
  p_venue_address text default null,
  p_venue_city text default null,
  p_venue_state text default null,
  p_venue_type text default null,
  p_hours_needed text default null,
  p_deliverables text default null,
  p_budget_range text default null,
  p_location_preference text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_client_name text;
  v_project public.projects%rowtype;
  v_quote public.quote_requests%rowtype;
  v_budget numeric := greatest(coalesce(p_budget, p_budget_max, p_budget_min, 0), 0);
  v_budget_min numeric := greatest(coalesce(p_budget_min, 0), 0);
  v_budget_max numeric := greatest(coalesce(p_budget_max, p_budget, 0), 0);
  v_creator_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_project_title, ''))) = 0 then
    raise exception 'Project title is required';
  end if;

  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Project description is required';
  end if;

  if p_listing_id is not null then
    select user_id
    into v_creator_user_id
    from public.creator_listings
    where id = p_listing_id;

    if v_creator_user_id is null then
      raise exception 'Creator listing not found';
    end if;
  end if;

  if v_budget_max > 0 and v_budget_min > v_budget_max then
    raise exception 'Minimum budget cannot exceed maximum budget';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');

  select coalesce(full_name, split_part(v_email, '@', 1), 'Client')
  into v_client_name
  from public.profiles
  where id = v_user_id;

  v_client_name := coalesce(v_client_name, 'Client');

  insert into public.projects (
    client_id,
    title,
    service_id,
    description,
    budget_min,
    budget_max,
    project_duration,
    location,
    timeline,
    status,
    applications
  )
  values (
    v_user_id,
    left(trim(p_project_title), 120),
    left(trim(coalesce(p_service_id, '')), 80),
    left(trim(p_description), 4000),
    nullif(v_budget_min, 0),
    nullif(v_budget_max, 0),
    nullif(left(trim(coalesce(p_hours_needed, '')), 80), ''),
    nullif(left(trim(coalesce(p_location, p_venue_city, '')), 160), ''),
    nullif(left(trim(coalesce(p_timeline, '')), 80), ''),
    'open',
    0
  )
  returning * into v_project;

  insert into public.quote_requests (
    listing_id,
    client_id,
    client_name,
    client_email,
    service_id,
    description,
    timeline,
    budget,
    project_title,
    project_type,
    project_time,
    venue_address,
    venue_city,
    venue_state,
    venue_type,
    hours_needed,
    deliverables,
    budget_range,
    location_preference,
    status,
    read
  )
  values (
    p_listing_id,
    v_user_id,
    left(trim(v_client_name), 120),
    left(trim(v_email), 254),
    left(trim(coalesce(p_service_id, '')), 80),
    left(trim(p_description), 4000),
    nullif(left(trim(coalesce(p_timeline, '')), 80), ''),
    nullif(v_budget, 0),
    left(trim(p_project_title), 120),
    nullif(left(trim(coalesce(p_project_type, '')), 120), ''),
    nullif(left(trim(coalesce(p_project_time, '')), 80), ''),
    nullif(left(trim(coalesce(p_venue_address, '')), 180), ''),
    nullif(left(trim(coalesce(p_venue_city, '')), 100), ''),
    nullif(left(trim(coalesce(p_venue_state, '')), 80), ''),
    nullif(left(trim(coalesce(p_venue_type, '')), 80), ''),
    nullif(left(trim(coalesce(p_hours_needed, '')), 80), ''),
    nullif(left(trim(coalesce(p_deliverables, '')), 80), ''),
    nullif(left(trim(coalesce(p_budget_range, '')), 80), ''),
    nullif(left(trim(coalesce(p_location_preference, '')), 80), ''),
    'pending',
    false
  )
  returning * into v_quote;

  if v_creator_user_id is not null then
    perform public.create_platform_notification(
      v_creator_user_id,
      'quote_request_received',
      'New quote request',
      'A client sent you a quote request. Respond inside CreatorBridge within 24 hours.',
      '/dashboard',
      jsonb_build_object('project_id', v_project.id, 'quote_id', v_quote.id, 'listing_id', p_listing_id),
      v_user_id,
      now() + interval '24 hours'
    );
  end if;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'quote', to_jsonb(v_quote)
  );
end;
$$;

revoke all on function public.submit_quote_request(uuid, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text) from public;
grant execute on function public.submit_quote_request(uuid, text, text, text, text, numeric, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text) to authenticated;

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
    or v_body ~* '\mat[[:space:]]+[A-Za-z0-9_\-]+[[:space:]]+dot[[:space:]]+(com|net|org|io|co|me|us|uk)\M'
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

  perform public.create_platform_notification(
    p_recipient_id,
    'direct_message_received',
    'New message',
    'You received a CreatorBridge message. Respond inside the platform within 24 hours.',
    '/messages',
    jsonb_build_object('conversation_id', v_conversation_id, 'message_id', v_message.id, 'listing_id', p_listing_id),
    v_user_id,
    now() + interval '24 hours'
  );

  return v_message;
end;
$$;

revoke all on function public.send_creatorbridge_message(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.send_creatorbridge_message(uuid, text, uuid, uuid) to authenticated;
