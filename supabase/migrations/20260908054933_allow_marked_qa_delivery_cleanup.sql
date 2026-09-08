create or replace function private.prevent_submitted_delivery_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  -- Only trusted server cleanup of unmistakable automated fixtures may delete
  -- submitted items. Customer records and all content updates stay immutable.
  if tg_op = 'DELETE' and current_user = 'service_role' and exists (
    select 1 from public.project_deliveries d
    join public.projects p on p.id = d.project_id
    join public.creator_listings c on c.id = p.accepted_creator_id
    where d.id = old.delivery_id
      and p.title like 'CB-E2E-%'
      and p.description like 'Dedicated CreatorBridge project completion browser test %'
      and c.name = 'CreatorBridge QA Creator'
      and c.business_name = 'CreatorBridge Automated QA'
  ) then
    return old;
  end if;
  select status into v_status from public.project_deliveries where id = old.delivery_id;
  if v_status <> 'draft' then
    if tg_op = 'DELETE' then
      raise exception 'Submitted delivery items cannot be deleted' using errcode = '42501';
    end if;
    if new.delivery_id is distinct from old.delivery_id
      or new.item_type is distinct from old.item_type
      or new.label is distinct from old.label
      or new.original_file_name is distinct from old.original_file_name
      or new.content_type is distinct from old.content_type
      or new.size_bytes is distinct from old.size_bytes
      or new.bucket is distinct from old.bucket
      or new.object_path is distinct from old.object_path
      or new.external_url is distinct from old.external_url then
      raise exception 'Submitted delivery items are immutable' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
