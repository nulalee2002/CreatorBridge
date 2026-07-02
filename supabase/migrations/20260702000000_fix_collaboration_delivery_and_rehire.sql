-- ============================================================================
-- FIX: two launch-blocking crashes in the Creator Collaboration feature
--
-- 1. submit_collaboration_delivery (20260622232730) sets delivered_at on
--    creator_collaborations, but that column was never added to the table, so
--    every delivery submission raised 'column "delivered_at" does not exist'.
--    Add the missing lifecycle timestamp column (matches invited_at/accepted_at/
--    funded_at/completed_at already on the table).
--
-- 2. rehire_creator_collaborator (20260625005812) inserted p_project_id straight
--    into creator_collaborations.project_id, which is NOT NULL. The Rehire UI
--    (CollaborationReviewActions.jsx) always passes p_project_id = null, so every
--    rehire raised a not-null / FK violation. Mirror create_creator_collaboration:
--    when no project is supplied, create a standalone project row first.
-- ============================================================================

alter table public.creator_collaborations
  add column if not exists delivered_at timestamptz;

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
  v_project_id uuid := p_project_id;
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

  -- Standalone rehire (no existing project): create the backing project row so
  -- the NOT NULL creator_collaborations.project_id constraint is satisfied,
  -- exactly as create_creator_collaboration does.
  if v_project_id is null then
    insert into public.projects (client_id, title, description, budget_min, budget_max, status)
    values (null, 'Creator collaboration', trim(p_scope), p_amount_cents / 100.0, p_amount_cents / 100.0, 'collaboration_draft')
    returning id into v_project_id;
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
    v_project_id,
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
