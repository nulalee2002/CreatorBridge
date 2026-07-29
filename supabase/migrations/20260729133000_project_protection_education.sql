-- Deterministic project-lifecycle education. This acknowledgment is not legal,
-- recording, or biometric consent.
create table if not exists public.project_guide_acknowledgments (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null check (participant_role in ('client','creator')),
  guide_version text not null,
  acknowledged_at timestamptz not null default now(),
  primary key (project_id, user_id, guide_version)
);
alter table public.project_guide_acknowledgments enable row level security;
revoke all on public.project_guide_acknowledgments from public,anon,authenticated;
grant select on public.project_guide_acknowledgments to authenticated;
create policy project_guide_party_read on public.project_guide_acknowledgments for select to authenticated
using (user_id=(select auth.uid()) or public.is_platform_admin((select auth.uid())));

create or replace function public.acknowledge_project_protection_guide(p_project_id uuid,p_guide_version text)
returns public.project_guide_acknowledgments language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_contract public.contracts%rowtype; v_role text; v_row public.project_guide_acknowledgments%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_contract from public.contracts where project_id=p_project_id;
  if not found then raise exception 'Project agreement not found' using errcode='P0002'; end if;
  v_role:=case when v_user_id=v_contract.client_id then 'client' when v_user_id=v_contract.creator_user_id then 'creator' else null end;
  if v_role is null then raise exception 'Project party access required' using errcode='42501'; end if;
  insert into public.project_guide_acknowledgments(project_id,user_id,participant_role,guide_version)
  values(p_project_id,v_user_id,v_role,left(trim(p_guide_version),40))
  on conflict(project_id,user_id,guide_version) do update set acknowledged_at=excluded.acknowledged_at
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.acknowledge_project_protection_guide(uuid,text) from public,anon;
grant execute on function public.acknowledge_project_protection_guide(uuid,text) to authenticated,service_role;
