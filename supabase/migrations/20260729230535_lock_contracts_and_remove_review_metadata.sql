-- Preserve every signed agreement as immutable evidence while removing obsolete
-- Production migration history aligned with the managed Supabase rollout.
-- metadata from future and still-unsigned agreements.

create or replace function creatorbridge_private.protect_signed_contract_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_signature boolean;
begin
  select exists (
    select 1 from public.contract_signatures signature
    where signature.contract_id = old.id
  ) into v_has_signature;

  if not v_has_signature then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'A signed agreement cannot be deleted' using errcode = '55000';
  end if;
  if new.project_id is distinct from old.project_id
    or new.client_id is distinct from old.client_id
    or new.creator_id is distinct from old.creator_id
    or new.creator_user_id is distinct from old.creator_user_id
    or new.template_version is distinct from old.template_version
    or new.terms is distinct from old.terms
    or new.content_hash is distinct from old.content_hash then
    raise exception 'Signed agreement evidence is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_signed_contract_evidence on public.contracts;
create trigger protect_signed_contract_evidence
before update or delete on public.contracts
for each row execute function creatorbridge_private.protect_signed_contract_evidence();

create or replace function creatorbridge_private.protect_contract_signature_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Agreement signatures are append-only evidence' using errcode = '55000';
end;
$$;

drop trigger if exists protect_contract_signature_evidence on public.contract_signatures;
create trigger protect_contract_signature_evidence
before update or delete on public.contract_signatures
for each row execute function creatorbridge_private.protect_contract_signature_evidence();

revoke all on function creatorbridge_private.protect_signed_contract_evidence()
  from public, anon, authenticated;
revoke all on function creatorbridge_private.protect_contract_signature_evidence()
  from public, anon, authenticated;
