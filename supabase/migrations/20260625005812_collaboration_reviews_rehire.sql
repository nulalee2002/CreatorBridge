create table if not exists public.collaboration_reviews (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references public.creator_collaborations(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  reviewee_id uuid not null references auth.users(id) on delete restrict,
  reviewee_listing_id uuid references public.creator_listings(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  label text not null default 'Verified Creator Collaboration',
  excluded_from_public_rating boolean not null default true,
  excluded_from_loyalty boolean not null default true,
  created_at timestamptz not null default now(),
  unique (collaboration_id, reviewer_id),
  check (reviewer_id <> reviewee_id),
  check (excluded_from_public_rating),
  check (excluded_from_loyalty)
);

insert into public.platform_event_definitions (
  event_name, version, authority, description, allowed_property_keys, privacy_class, retention_class
) values
  ('review.collaboration_submitted', 1, 'server_authoritative', 'A verified creator collaboration review was submitted.', array['rating_bucket', 'label'], 'pseudonymous_behavior', 'behavioral_13_months'),
  ('rehire.collaboration_invited', 1, 'server_authoritative', 'A prime invited a previous collaborator into a new collaboration.', array['previous_collaboration_id', 'service_category'], 'pseudonymous_behavior', 'behavioral_13_months')
on conflict (event_name, version) do nothing;

alter table public.collaboration_reviews enable row level security;
grant select on public.collaboration_reviews to authenticated;
grant all on public.collaboration_reviews to service_role;
revoke insert, update, delete on public.collaboration_reviews from anon, authenticated;

create policy "Collaboration members can read collaboration reviews"
  on public.collaboration_reviews
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

create or replace function public.submit_collaboration_review(
  p_collaboration_id uuid,
  p_rating integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.creator_collaborations%rowtype;
  uid uuid := (select auth.uid());
  reviewee uuid;
  reviewee_listing uuid;
  review_id uuid;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into c
  from public.creator_collaborations
  where id = p_collaboration_id;

  if c.id is null then
    raise exception 'Collaboration not found';
  end if;

  if c.status not in ('approved', 'completed') then
    raise exception 'Collaboration reviews open after approval or completion';
  end if;

  if uid = c.prime_user_id then
    reviewee := c.collaborator_user_id;
    reviewee_listing := c.collaborator_listing_id;
  elsif uid = c.collaborator_user_id then
    reviewee := c.prime_user_id;
    reviewee_listing := c.prime_listing_id;
  else
    raise exception 'Only collaboration members can review';
  end if;

  if uid = reviewee then
    raise exception 'Self-review is not allowed';
  end if;

  insert into public.collaboration_reviews (
    collaboration_id,
    reviewer_id,
    reviewee_id,
    reviewee_listing_id,
    rating,
    comment
  ) values (
    p_collaboration_id,
    uid,
    reviewee,
    reviewee_listing,
    p_rating,
    nullif(trim(coalesce(p_comment, '')), '')
  )
  returning id into review_id;

  insert into public.platform_event_outbox(idempotency_key, event_name, event_version, actor_id, entity_type, entity_id, surface, properties)
  values (
    'collaboration-review:' || review_id::text,
    'review.collaboration_submitted',
    1,
    uid,
    'creator_collaboration',
    p_collaboration_id,
    'collaboration_review',
    jsonb_build_object('rating_bucket', p_rating, 'label', 'Verified Creator Collaboration')
  )
  on conflict (idempotency_key) do nothing;

  return review_id;
end
$$;

revoke all on function public.submit_collaboration_review(uuid, integer, text) from public, anon;
grant execute on function public.submit_collaboration_review(uuid, integer, text) to authenticated;

create or replace function public.rehire_creator_collaborator(
  p_previous_collaboration_id uuid,
  p_project_id uuid default null,
  p_scope text default null,
  p_amount_cents integer default null,
  p_deadline date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.creator_collaborations%rowtype;
  new_id uuid;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into previous
  from public.creator_collaborations
  where id = p_previous_collaboration_id;

  if previous.id is null then
    raise exception 'Previous collaboration not found';
  end if;

  if uid <> previous.prime_user_id then
    raise exception 'Only the original prime can rehire this collaborator';
  end if;

  if previous.status not in ('approved', 'completed') then
    raise exception 'Only completed or approved collaborations can be rehired';
  end if;

  if p_amount_cents is null or p_amount_cents < 25000 then
    raise exception 'Creator collaborations have a $250 minimum';
  end if;

  if nullif(trim(coalesce(p_scope, '')), '') is null then
    raise exception 'Rehire requires a fresh scope';
  end if;

  if p_deadline is null then
    raise exception 'Rehire requires a fresh deadline';
  end if;

  insert into public.creator_collaborations (
    project_id,
    prime_user_id,
    prime_listing_id,
    collaborator_user_id,
    collaborator_listing_id,
    service_category,
    scope,
    amount_cents,
    deadline,
    project_context,
    workspace_provider,
    status
  ) values (
    p_project_id,
    previous.prime_user_id,
    previous.prime_listing_id,
    previous.collaborator_user_id,
    previous.collaborator_listing_id,
    previous.service_category,
    trim(p_scope),
    p_amount_cents,
    p_deadline,
    case when p_project_id is null then 'standalone' else 'existing_project' end,
    previous.workspace_provider,
    'invited'
  )
  returning id into new_id;

  insert into public.platform_event_outbox(idempotency_key, event_name, event_version, actor_id, entity_type, entity_id, surface, properties)
  values (
    'collaboration-rehire:' || new_id::text,
    'rehire.collaboration_invited',
    1,
    uid,
    'creator_collaboration',
    new_id,
    'collaboration_rehire',
    jsonb_build_object('previous_collaboration_id', previous.id, 'service_category', previous.service_category)
  )
  on conflict (idempotency_key) do nothing;

  return new_id;
end
$$;

revoke all on function public.rehire_creator_collaborator(uuid, uuid, text, integer, date) from public, anon;
grant execute on function public.rehire_creator_collaborator(uuid, uuid, text, integer, date) to authenticated;
