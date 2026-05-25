-- CreatorBridge Data API grant and RLS audit.
-- Run with:
--   supabase db query --linked -f scripts/verify-data-api-grants.sql
--
-- Why this exists:
-- Supabase is changing defaults so new public tables are not automatically
-- exposed to the Data API. CreatorBridge should make grants intentional and
-- keep RLS enabled on application-owned public tables.

with app_tables as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname not like 'pg_%'
    and c.relname not like 'schema_%'
    and c.relname not in ('spatial_ref_sys')
),
role_grants as (
  select
    table_schema,
    table_name,
    grantee,
    bool_or(privilege_type = 'SELECT') as can_select,
    bool_or(privilege_type = 'INSERT') as can_insert,
    bool_or(privilege_type = 'UPDATE') as can_update,
    bool_or(privilege_type = 'DELETE') as can_delete
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
  group by table_schema, table_name, grantee
)
select
  t.table_name,
  t.rls_enabled,
  coalesce(anon.can_select, false) as anon_select,
  coalesce(auth.can_select, false) as authenticated_select,
  coalesce(auth.can_insert, false) as authenticated_insert,
  coalesce(auth.can_update, false) as authenticated_update,
  coalesce(auth.can_delete, false) as authenticated_delete,
  coalesce(sr.can_select, false) as service_role_select,
  case
    when not t.rls_enabled then 'CHECK_RLS_OFF'
    when not coalesce(auth.can_select, false)
      and not coalesce(auth.can_insert, false)
      and not coalesce(auth.can_update, false)
      and not coalesce(auth.can_delete, false)
      and not coalesce(sr.can_select, false)
      then 'CHECK_NO_DATA_API_GRANT'
    else 'OK'
  end as audit_status
from app_tables t
left join role_grants anon
  on anon.table_schema = t.schema_name
 and anon.table_name = t.table_name
 and anon.grantee = 'anon'
left join role_grants auth
  on auth.table_schema = t.schema_name
 and auth.table_name = t.table_name
 and auth.grantee = 'authenticated'
left join role_grants sr
  on sr.table_schema = t.schema_name
 and sr.table_name = t.table_name
 and sr.grantee = 'service_role'
order by
  case
    when not t.rls_enabled then 0
    when not coalesce(auth.can_select, false)
      and not coalesce(auth.can_insert, false)
      and not coalesce(auth.can_update, false)
      and not coalesce(auth.can_delete, false)
      and not coalesce(sr.can_select, false)
      then 1
    else 2
  end,
  t.table_name;

with app_tables as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname not like 'pg_%'
    and c.relname not like 'schema_%'
    and c.relname not in ('spatial_ref_sys')
),
role_grants as (
  select
    table_schema,
    table_name,
    grantee,
    bool_or(privilege_type = 'SELECT') as can_select,
    bool_or(privilege_type = 'INSERT') as can_insert,
    bool_or(privilege_type = 'UPDATE') as can_update,
    bool_or(privilege_type = 'DELETE') as can_delete
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('authenticated', 'service_role')
  group by table_schema, table_name, grantee
),
issues as (
  select
    t.table_name,
    case
      when not t.rls_enabled then 'RLS is off'
      when not coalesce(auth.can_select, false)
        and not coalesce(auth.can_insert, false)
        and not coalesce(auth.can_update, false)
        and not coalesce(auth.can_delete, false)
        and not coalesce(sr.can_select, false)
        then 'No explicit Data API grant to authenticated/service_role'
      else null
    end as issue
  from app_tables t
  left join role_grants auth
    on auth.table_schema = t.schema_name
   and auth.table_name = t.table_name
   and auth.grantee = 'authenticated'
  left join role_grants sr
    on sr.table_schema = t.schema_name
   and sr.table_name = t.table_name
   and sr.grantee = 'service_role'
)
select
  count(*) filter (where issue is not null) as issue_count,
  coalesce(jsonb_agg(jsonb_build_object('table', table_name, 'issue', issue) order by table_name) filter (where issue is not null), '[]'::jsonb) as issues
from issues;
