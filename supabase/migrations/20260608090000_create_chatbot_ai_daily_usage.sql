create table if not exists public.chatbot_ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.chatbot_ai_usage_daily enable row level security;

grant select on public.chatbot_ai_usage_daily to authenticated;
grant select, insert, update, delete on public.chatbot_ai_usage_daily to service_role;

drop policy if exists "Users can read own chatbot ai usage" on public.chatbot_ai_usage_daily;
create policy "Users can read own chatbot ai usage"
  on public.chatbot_ai_usage_daily
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.consume_chatbot_ai_quota(
  p_user_id uuid,
  p_limit integer default 3
)
returns table (
  allowed boolean,
  request_count integer,
  daily_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_limit integer := greatest(coalesce(p_limit, 3), 0);
  v_count integer;
begin
  if p_user_id is null then
    return query select false, 0, v_limit;
    return;
  end if;

  if v_limit = 0 then
    select coalesce(c.request_count, 0)
      into v_count
      from public.chatbot_ai_usage_daily c
      where c.user_id = p_user_id
        and c.usage_date = v_today;

    return query select false, coalesce(v_count, 0), v_limit;
    return;
  end if;

  insert into public.chatbot_ai_usage_daily (user_id, usage_date, request_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date)
  do update
    set request_count = public.chatbot_ai_usage_daily.request_count + 1,
        updated_at = now()
    where public.chatbot_ai_usage_daily.request_count < v_limit
  returning public.chatbot_ai_usage_daily.request_count into v_count;

  if v_count is null then
    select c.request_count
      into v_count
      from public.chatbot_ai_usage_daily c
      where c.user_id = p_user_id
        and c.usage_date = v_today;

    return query select false, coalesce(v_count, 0), v_limit;
    return;
  end if;

  return query select true, v_count, v_limit;
end;
$$;

revoke all on function public.consume_chatbot_ai_quota(uuid, integer) from public;
grant execute on function public.consume_chatbot_ai_quota(uuid, integer) to service_role;
