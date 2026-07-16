create extension if not exists pgcrypto;

alter table public.project_applications
  add column if not exists package_id uuid references public.packages(id) on delete restrict;

alter table public.projects
  add column if not exists rebooked_from_project_id uuid references public.projects(id) on delete set null,
  add column if not exists selected_package_id uuid references public.packages(id) on delete set null;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'quote_request_received', 'direct_message_received', 'proposal_received',
    'proposal_accepted', 'retainer_paid', 'delivery_submitted', 'payment_released',
    'support_ticket_update', 'contract_ready', 'contract_signed',
    'contract_countersigned', 'rebook_requested', 'system'
  )
);

grant execute on function public.create_platform_notification(uuid, text, text, text, text, jsonb, uuid, timestamptz) to service_role;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.creator_listings(id) on delete restrict,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  template_version text not null default 'v1',
  terms jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  pdf_ref text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'client_signed', 'creator_signed', 'countersigned', 'void')),
  client_signed_at timestamptz,
  creator_signed_at timestamptz,
  countersigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  signer_user_id uuid not null references public.profiles(id) on delete cascade,
  signer_role text not null check (signer_role in ('client', 'creator')),
  signer_name text not null check (length(trim(signer_name)) between 2 and 160),
  method text not null check (method in ('drawn', 'typed', 'saved')),
  signature_image_ref text,
  consent_text text not null,
  signed_content_hash text not null check (signed_content_hash ~ '^[0-9a-f]{64}$'),
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (contract_id, signer_role)
);

create table if not exists public.saved_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  method text not null check (method in ('drawn', 'typed')),
  signature_image_ref text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists saved_signatures_one_default_per_user
  on public.saved_signatures(user_id)
  where is_default;
create index if not exists contracts_client_idx on public.contracts(client_id, created_at desc);
create index if not exists contracts_creator_idx on public.contracts(creator_user_id, created_at desc);
create index if not exists contract_signatures_contract_idx on public.contract_signatures(contract_id);
create index if not exists projects_rebook_source_idx on public.projects(rebooked_from_project_id);
create unique index if not exists projects_one_active_rebook_per_source
  on public.projects(rebooked_from_project_id, client_id)
  where rebooked_from_project_id is not null
    and status in ('rebook_draft', 'rebook_pending', 'accepted', 'retainer_paid', 'in_progress', 'delivered', 'revision', 'approved');
create index if not exists project_applications_package_idx on public.project_applications(package_id);

create or replace function public.touch_contract_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contracts_touch_updated_at on public.contracts;
create trigger contracts_touch_updated_at
before update on public.contracts
for each row execute function public.touch_contract_updated_at();

alter table public.contracts enable row level security;
alter table public.contract_signatures enable row level security;
alter table public.saved_signatures enable row level security;

revoke all on table public.contracts from anon, authenticated;
revoke all on table public.contract_signatures from anon, authenticated;
revoke all on table public.saved_signatures from anon, authenticated;
grant select on table public.contracts to authenticated;
grant select on table public.contract_signatures to authenticated;
grant select on table public.saved_signatures to authenticated;

drop policy if exists contracts_parties_read on public.contracts;
create policy contracts_parties_read on public.contracts
for select to authenticated
using (
  (select auth.uid()) in (client_id, creator_user_id)
  or public.is_platform_admin((select auth.uid()))
);

drop policy if exists contract_signatures_parties_read on public.contract_signatures;
create policy contract_signatures_parties_read on public.contract_signatures
for select to authenticated
using (
  exists (
    select 1
    from public.contracts contract
    where contract.id = contract_signatures.contract_id
      and (
        (select auth.uid()) in (contract.client_id, contract.creator_user_id)
        or public.is_platform_admin((select auth.uid()))
      )
  )
);

drop policy if exists saved_signatures_owner_read on public.saved_signatures;
create policy saved_signatures_owner_read on public.saved_signatures
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_platform_admin((select auth.uid()))
);

create or replace function public.refresh_contract_signature_status(p_contract_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts%rowtype;
  v_client_signed_at timestamptz;
  v_creator_signed_at timestamptz;
begin
  select * into v_contract
  from public.contracts
  where id = p_contract_id
  for update;
  if not found then raise exception 'Contract not found'; end if;
  if v_contract.status = 'void' then return v_contract; end if;

  select
    max(signed_at) filter (where signer_role = 'client'),
    max(signed_at) filter (where signer_role = 'creator')
  into v_client_signed_at, v_creator_signed_at
  from public.contract_signatures
  where contract_id = p_contract_id;

  update public.contracts
  set client_signed_at = v_client_signed_at,
      creator_signed_at = v_creator_signed_at,
      status = case
        when v_client_signed_at is not null and v_creator_signed_at is not null then 'countersigned'
        when v_client_signed_at is not null then 'client_signed'
        when v_creator_signed_at is not null then 'creator_signed'
        when pdf_ref is not null then 'sent'
        else 'draft'
      end,
      countersigned_at = case
        when v_client_signed_at is not null and v_creator_signed_at is not null
          then coalesce(countersigned_at, greatest(v_client_signed_at, v_creator_signed_at))
        else null
      end
  where id = p_contract_id
  returning * into v_contract;
  return v_contract;
end;
$$;

revoke all on function public.refresh_contract_signature_status(uuid) from public, anon, authenticated;
grant execute on function public.refresh_contract_signature_status(uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('contracts', 'contracts', false, 10485760, array['application/pdf']),
  ('signatures', 'signatures', false, 2097152, array['image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.generate_contract_for_project(p_project_id uuid)
returns public.contracts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_application public.project_applications%rowtype;
  v_listing public.creator_listings%rowtype;
  v_package public.packages%rowtype;
  v_client public.profiles%rowtype;
  v_client_detail public.client_profiles%rowtype;
  v_contract public.contracts%rowtype;
  v_contract_id uuid := gen_random_uuid();
  v_amount numeric;
  v_creator_fee_pct numeric;
  v_client_fee_pct numeric;
  v_creator_fee numeric;
  v_terms jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_contract
  from public.contracts
  where project_id = p_project_id
    and status <> 'void';
  if found then
    if v_user_id not in (v_contract.client_id, v_contract.creator_user_id)
      and not public.is_platform_admin(v_user_id) then
      raise exception 'Contract access denied';
    end if;
    return v_contract;
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then
    raise exception 'Project not found';
  end if;
  if v_project.accepted_application_id is null or v_project.accepted_creator_id is null then
    raise exception 'An accepted proposal is required before a contract can be generated';
  end if;

  select * into v_application
  from public.project_applications
  where id::text = v_project.accepted_application_id
    and project_id = v_project.id
    and listing_id::text = v_project.accepted_creator_id
    and status = 'accepted';
  if not found then
    raise exception 'Accepted proposal could not be verified';
  end if;
  if v_application.package_id is null then
    raise exception 'The accepted proposal must identify a package before a contract can be generated';
  end if;

  select * into v_listing
  from public.creator_listings
  where id = v_application.listing_id;
  if not found or v_listing.user_id is null then
    raise exception 'Creator identity could not be verified';
  end if;
  if v_user_id not in (v_project.client_id, v_listing.user_id)
    and not public.is_platform_admin(v_user_id) then
    raise exception 'Contract generation is limited to the project parties';
  end if;

  select * into v_package
  from public.packages
  where id = v_application.package_id
    and listing_id = v_listing.id;
  if not found then
    raise exception 'The proposal package could not be verified';
  end if;

  select * into v_client from public.profiles where id = v_project.client_id;
  select * into v_client_detail from public.client_profiles where user_id = v_project.client_id;

  v_amount := coalesce(nullif(v_application.proposed_rate, 0), v_project.budget_max, v_project.budget_min, 0);
  if v_amount <= 0 then
    raise exception 'Contract amount must be greater than zero';
  end if;
  v_creator_fee_pct := case
    when coalesce(v_listing.completed_projects, 0) >= 25 then 6
    when coalesce(v_listing.completed_projects, 0) >= 10 then 8
    else 10
  end;
  if v_listing.next_project_fee_pct is not null then
    v_creator_fee_pct := least(v_creator_fee_pct, v_listing.next_project_fee_pct);
  end if;
  v_client_fee_pct := case
    when coalesce(v_client.first_booking_fee_waived, false)
      or coalesce(v_client.next_booking_fee_waived, false) then 0
    else 5
  end;
  v_creator_fee := round(v_amount * v_creator_fee_pct / 100.0, 2);

  v_terms := jsonb_build_object(
    'document', jsonb_build_object(
      'number', 'CB-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(v_contract_id::text, '-', ''), 1, 6)),
      'template_version', 'v1',
      'attorney_review_required', true
    ),
    'parties', jsonb_build_object(
      'client', jsonb_build_object(
        'user_id', v_project.client_id,
        'name', coalesce(nullif(trim(v_client_detail.display_name), ''), nullif(trim(v_client.full_name), ''), 'Client'),
        'company', nullif(trim(v_client_detail.company_name), '')
      ),
      'creator', jsonb_build_object(
        'user_id', v_listing.user_id,
        'listing_id', v_listing.id,
        'name', coalesce(nullif(trim(v_listing.name), ''), 'Creator'),
        'business_name', coalesce(nullif(trim(v_listing.business_name), ''), nullif(trim(v_listing.name), ''), 'Creator')
      )
    ),
    'project', jsonb_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'description', v_project.description,
      'service_id', v_project.service_id,
      'location', v_project.location,
      'timeline', v_project.timeline,
      'project_duration', v_project.project_duration,
      'package_id', v_package.id,
      'package_name', v_package.name
    ),
    'deliverables', to_jsonb(coalesce(v_package.deliverables, array[]::text[])),
    'timeline', jsonb_build_object(
      'turnaround_days', v_package.turnaround_days,
      'project_timeline', v_project.timeline,
      'project_duration', v_project.project_duration
    ),
    'shoot_dates', v_project.timeline,
    'location', v_project.location,
    'pricing', jsonb_build_object(
      'currency', 'USD',
      'total', round(v_amount, 2),
      'retainer', round(v_amount * 0.5, 2),
      'final', round(v_amount - round(v_amount * 0.5, 2), 2),
      'creator_fee_pct', v_creator_fee_pct,
      'client_fee_pct', v_client_fee_pct,
      'creator_fee', v_creator_fee,
      'client_fee', round(v_amount * v_client_fee_pct / 100.0, 2),
      'creator_net', round(v_amount - v_creator_fee, 2)
    ),
    'revisions', coalesce(v_package.revisions, 0),
    'usage', 'Creators retain ownership of their work unless the accepted brief or a signed agreement grants specific usage rights to the client. CreatorBridge does not claim ownership of work produced through the platform.',
    'cancellation', 'Before the retainer is paid, either party may cancel at no cost. After the retainer is paid and before delivery, the retainer is split evenly. The creator keeps 25 percent of the project total and the client receives 25 percent of the project total. No platform fees apply to a cancelled project. After delivery, cancellations and refunds are unavailable.',
    'disputes', 'A party may open a dispute through CreatorBridge for delivered work that does not match the agreed scope. The client review window is 72 hours after delivery. CreatorBridge reviews the agreement, project messages, and delivered work.',
    'communication', 'Project communication, files, approvals, and payment activity remain on CreatorBridge.',
    'generated_at', now()
  );

  insert into public.contracts (
    id, project_id, client_id, creator_id, creator_user_id,
    terms, content_hash, status
  ) values (
    v_contract_id, v_project.id, v_project.client_id, v_listing.id, v_listing.user_id,
    v_terms, encode(digest(convert_to(v_terms::text, 'UTF8'), 'sha256'), 'hex'), 'draft'
  )
  returning * into v_contract;

  return v_contract;
end;
$$;

revoke all on function public.generate_contract_for_project(uuid) from public, anon;
grant execute on function public.generate_contract_for_project(uuid) to authenticated;

drop function if exists public.apply_to_project(uuid, uuid, text, numeric);
create or replace function public.apply_to_project(
  p_project_id uuid,
  p_listing_id uuid,
  p_message text,
  p_proposed_rate numeric,
  p_package_id uuid
)
returns public.project_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_application public.project_applications%rowtype;
  v_proposed_rate numeric := greatest(coalesce(p_proposed_rate, 0), 0);
  v_floor numeric := public.margin_floor_dollars();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_message, ''))) = 0 then raise exception 'Proposal message is required'; end if;
  if v_proposed_rate < v_floor then
    raise exception 'Packages and proposals start at $250 on CreatorBridge. Please set this at $250 or more.';
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if coalesce(v_project.status, 'open') <> 'open' then raise exception 'This project is no longer accepting applications'; end if;
  if not exists (
    select 1 from public.creator_listings
    where id = p_listing_id and user_id = v_user_id
  ) then raise exception 'Creator listing not found for this user'; end if;
  if not exists (
    select 1 from public.packages
    where id = p_package_id
      and listing_id = p_listing_id
      and service_id = v_project.service_id
  ) then raise exception 'Select one of your packages that matches this project before submitting'; end if;

  select * into v_application
  from public.project_applications
  where project_id = p_project_id and listing_id = p_listing_id
  order by created_at desc nulls last, id desc
  limit 1 for update;

  if found then
    update public.project_applications
    set message = left(trim(p_message), 3000),
        proposed_rate = v_proposed_rate,
        package_id = p_package_id,
        status = case when status = 'accepted' then status else 'pending' end
    where id = v_application.id
    returning * into v_application;
  else
    insert into public.project_applications (
      project_id, listing_id, message, proposed_rate, package_id, status
    ) values (
      p_project_id, p_listing_id, left(trim(p_message), 3000), v_proposed_rate, p_package_id, 'pending'
    ) returning * into v_application;
  end if;

  update public.projects
  set applications = (select count(*) from public.project_applications where project_id = p_project_id)
  where id = p_project_id;
  return v_application;
end;
$$;

revoke all on function public.apply_to_project(uuid, uuid, text, numeric, uuid) from public, anon;
grant execute on function public.apply_to_project(uuid, uuid, text, numeric, uuid) to authenticated;

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
  v_contract public.contracts%rowtype;
  v_creator_stripe_account_id text;
  v_creator_user_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if v_project.client_id <> v_user_id then raise exception 'Only the project owner can accept an application'; end if;
  if coalesce(v_project.status, 'open') <> 'open' then raise exception 'This project is not open for acceptance'; end if;

  select * into v_application
  from public.project_applications
  where id = p_application_id and project_id = p_project_id
  for update;
  if not found then raise exception 'Application not found for this project'; end if;
  if v_application.package_id is null then raise exception 'This proposal must include a package before it can be accepted'; end if;

  select stripe_account_id, user_id into v_creator_stripe_account_id, v_creator_user_id
  from public.creator_listings where id = v_application.listing_id;
  if v_creator_stripe_account_id is null or length(trim(v_creator_stripe_account_id)) = 0 then
    raise exception 'This creator must connect a Stripe payout account before their proposal can be accepted';
  end if;

  update public.project_applications
  set status = case when id = p_application_id then 'accepted' when status = 'pending' then 'declined' else status end
  where project_id = p_project_id;

  update public.projects
  set status = 'accepted',
      accepted_creator_id = v_application.listing_id::text,
      accepted_application_id = v_application.id::text,
      selected_package_id = v_application.package_id,
      applications = (select count(*) from public.project_applications where project_id = p_project_id)
  where id = p_project_id
  returning * into v_project;

  select * into v_contract from public.generate_contract_for_project(p_project_id);

  perform public.create_platform_notification(
    v_creator_user_id,
    'proposal_accepted',
    'Your proposal was accepted',
    'Review and sign the production agreement. Wait for the retainer before starting work.',
    '/projects',
    jsonb_build_object('project_id', p_project_id, 'application_id', p_application_id, 'contract_id', v_contract.id),
    v_user_id,
    now() + interval '24 hours'
  );

  select * into v_application from public.project_applications where id = p_application_id;
  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'application', to_jsonb(v_application),
    'contract', to_jsonb(v_contract)
  );
end;
$$;

revoke all on function public.accept_project_application(uuid, uuid) from public, anon;
grant execute on function public.accept_project_application(uuid, uuid) to authenticated;

create or replace function public.rebook_project(p_prior_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_prior public.projects%rowtype;
  v_application public.project_applications%rowtype;
  v_creator_user_id uuid;
  v_new public.projects%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_prior from public.projects where id = p_prior_project_id;
  if not found then raise exception 'Prior project not found'; end if;
  if v_prior.client_id <> v_user_id then raise exception 'Only the original client can rebook this project'; end if;
  if coalesce(v_prior.status, '') not in ('approved', 'completed', 'final_paid') then
    raise exception 'Rebooking is available after a project is completed';
  end if;
  if v_prior.accepted_creator_id is null or v_prior.accepted_application_id is null then
    raise exception 'The prior creator could not be verified';
  end if;

  select * into v_new
  from public.projects
  where rebooked_from_project_id = v_prior.id
    and client_id = v_user_id
    and status in ('rebook_draft', 'rebook_pending', 'accepted', 'retainer_paid', 'in_progress', 'delivered', 'revision', 'approved')
  order by created_at desc
  limit 1;
  if found then return v_new; end if;

  select * into v_application
  from public.project_applications
  where id::text = v_prior.accepted_application_id and project_id = v_prior.id;
  if not found or v_application.package_id is null then
    raise exception 'The prior package could not be verified';
  end if;
  select user_id into v_creator_user_id
  from public.creator_listings where id::text = v_prior.accepted_creator_id;

  insert into public.projects (
    client_id, title, service_id, description, budget_min, budget_max,
    location, timeline, project_duration, status, accepted_creator_id,
    selected_package_id, rebooked_from_project_id, applications
  ) values (
    v_user_id, v_prior.title, v_prior.service_id, v_prior.description,
    v_application.proposed_rate, v_application.proposed_rate,
    v_prior.location, null, v_prior.project_duration, 'rebook_draft',
    v_prior.accepted_creator_id, v_application.package_id, v_prior.id, 0
  ) returning * into v_new;

  return v_new;
end;
$$;

revoke all on function public.rebook_project(uuid) from public, anon;
grant execute on function public.rebook_project(uuid) to authenticated;

create or replace function public.submit_rebook_project(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_creator_user_id uuid;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.client_id <> v_user_id then raise exception 'Rebooking draft not found'; end if;
  if v_project.status <> 'rebook_draft' then raise exception 'This rebooking is not editable'; end if;
  if v_project.timeline is null or length(trim(v_project.timeline)) = 0 then
    raise exception 'Add a new timeline before sending the rebooking';
  end if;
  update public.projects set status = 'rebook_pending' where id = p_project_id returning * into v_project;
  select user_id into v_creator_user_id from public.creator_listings where id::text = v_project.accepted_creator_id;
  perform public.create_platform_notification(
    v_creator_user_id,
    'rebook_requested',
    'A past client wants to rebook you',
    'Review the updated project details and confirm before a new agreement is prepared.',
    '/projects',
    jsonb_build_object('project_id', v_project.id, 'prior_project_id', v_project.rebooked_from_project_id),
    v_user_id,
    now() + interval '72 hours'
  );
  return v_project;
end;
$$;

revoke all on function public.submit_rebook_project(uuid) from public, anon;
grant execute on function public.submit_rebook_project(uuid) to authenticated;

create or replace function public.confirm_rebook_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_listing public.creator_listings%rowtype;
  v_application public.project_applications%rowtype;
  v_contract public.contracts%rowtype;
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.status <> 'rebook_pending' then raise exception 'Rebooking request not found'; end if;
  select * into v_listing from public.creator_listings where id::text = v_project.accepted_creator_id;
  if not found or v_listing.user_id <> v_user_id then raise exception 'Only the invited creator can confirm this rebooking'; end if;
  if v_project.selected_package_id is null then raise exception 'Rebooking package is missing'; end if;

  insert into public.project_applications (
    project_id, listing_id, package_id, message, proposed_rate, status
  ) values (
    v_project.id, v_listing.id, v_project.selected_package_id,
    'Confirmed repeat booking based on the prior project terms.',
    coalesce(v_project.budget_max, v_project.budget_min), 'accepted'
  ) returning * into v_application;

  update public.projects
  set status = 'accepted', accepted_application_id = v_application.id::text, applications = 1
  where id = v_project.id
  returning * into v_project;

  select * into v_contract from public.generate_contract_for_project(v_project.id);
  return jsonb_build_object('project', to_jsonb(v_project), 'application', to_jsonb(v_application), 'contract', to_jsonb(v_contract));
end;
$$;

revoke all on function public.confirm_rebook_project(uuid) from public, anon;
grant execute on function public.confirm_rebook_project(uuid) to authenticated;
