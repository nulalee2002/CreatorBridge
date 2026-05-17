create table if not exists public.network_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_code text not null,
  content text not null,
  post_type text not null default 'general',
  user_display_name text,
  user_verification_status text,
  user_primary_service text,
  likes_count integer not null default 0,
  reply_count integer not null default 0,
  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

alter table public.network_posts
  add column if not exists user_display_name text,
  add column if not exists user_verification_status text,
  add column if not exists user_primary_service text,
  add column if not exists likes_count integer not null default 0,
  add column if not exists reply_count integer not null default 0,
  add column if not exists is_flagged boolean not null default false,
  add column if not exists expires_at timestamptz not null default now() + interval '30 days';

alter table public.network_posts
  drop constraint if exists network_posts_content_length,
  add constraint network_posts_content_length check (char_length(content) between 1 and 500),
  drop constraint if exists network_posts_state_code_format,
  add constraint network_posts_state_code_format check (state_code ~ '^[A-Z]{2}$'),
  drop constraint if exists network_posts_post_type_allowed,
  add constraint network_posts_post_type_allowed check (
    post_type in ('general', 'collab', 'looking_for_creator', 'industry_news', 'portfolio')
  );

create table if not exists public.network_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.network_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  user_display_name text,
  user_verification_status text,
  user_primary_service text,
  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

alter table public.network_replies
  add column if not exists user_display_name text,
  add column if not exists user_verification_status text,
  add column if not exists user_primary_service text,
  add column if not exists is_flagged boolean not null default false,
  add column if not exists expires_at timestamptz not null default now() + interval '30 days';

alter table public.network_replies
  drop constraint if exists network_replies_content_length,
  add constraint network_replies_content_length check (char_length(content) between 1 and 280);

create table if not exists public.network_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.network_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(post_id, user_id)
);

create table if not exists public.state_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_code text not null,
  message text not null,
  user_display_name text,
  user_verification_status text,
  user_primary_service text,
  is_flagged boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

alter table public.state_chat_messages
  add column if not exists is_flagged boolean not null default false,
  add column if not exists expires_at timestamptz not null default now() + interval '30 days';

alter table public.state_chat_messages
  drop constraint if exists state_chat_messages_message_length,
  add constraint state_chat_messages_message_length check (char_length(message) between 1 and 300),
  drop constraint if exists state_chat_messages_state_code_format,
  add constraint state_chat_messages_state_code_format check (state_code ~ '^[A-Z]{2}$');

create index if not exists idx_network_posts_state_created
  on public.network_posts(state_code, created_at desc)
  where is_flagged = false;

create index if not exists idx_network_posts_expires
  on public.network_posts(expires_at);

create index if not exists idx_network_replies_post_created
  on public.network_replies(post_id, created_at)
  where is_flagged = false;

create index if not exists idx_network_post_likes_post_user
  on public.network_post_likes(post_id, user_id);

create index if not exists idx_state_chat_state_created
  on public.state_chat_messages(state_code, created_at desc)
  where is_flagged = false;

alter table public.network_posts enable row level security;
alter table public.network_replies enable row level security;
alter table public.network_post_likes enable row level security;
alter table public.state_chat_messages enable row level security;

drop policy if exists "Anyone can view network posts" on public.network_posts;
create policy "Anyone can view network posts"
  on public.network_posts for select
  to anon, authenticated
  using (is_flagged = false and expires_at > now());

drop policy if exists "Verified members can post" on public.network_posts;
create policy "Verified members can post"
  on public.network_posts for insert
  to authenticated
  with check ((select auth.uid()) = user_id and is_flagged = false);

drop policy if exists "Users can hide own network posts" on public.network_posts;
create policy "Users can hide own network posts"
  on public.network_posts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Anyone can view replies" on public.network_replies;
create policy "Anyone can view replies"
  on public.network_replies for select
  to anon, authenticated
  using (
    is_flagged = false
    and expires_at > now()
    and exists (
      select 1
      from public.network_posts p
      where p.id = network_replies.post_id
        and p.is_flagged = false
        and p.expires_at > now()
    )
  );

drop policy if exists "Verified members can reply" on public.network_replies;
create policy "Verified members can reply"
  on public.network_replies for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and is_flagged = false
    and exists (
      select 1
      from public.network_posts p
      where p.id = network_replies.post_id
        and p.is_flagged = false
        and p.expires_at > now()
    )
  );

drop policy if exists "Anyone can view post likes" on public.network_post_likes;
create policy "Anyone can view post likes"
  on public.network_post_likes for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can like posts" on public.network_post_likes;
create policy "Anyone can like posts"
  on public.network_post_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.network_posts p
      where p.id = network_post_likes.post_id
        and p.is_flagged = false
        and p.expires_at > now()
    )
  );

drop policy if exists "Users can remove own post likes" on public.network_post_likes;
create policy "Users can remove own post likes"
  on public.network_post_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Anyone can view chat messages" on public.state_chat_messages;
create policy "Anyone can view chat messages"
  on public.state_chat_messages for select
  to anon, authenticated
  using (is_flagged = false and expires_at > now());

drop policy if exists "Verified members can send messages" on public.state_chat_messages;
create policy "Verified members can send messages"
  on public.state_chat_messages for insert
  to authenticated
  with check ((select auth.uid()) = user_id and is_flagged = false);

create or replace function public.refresh_network_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_posts
  set likes_count = (
    select count(*)::integer
    from public.network_post_likes
    where post_id = coalesce(new.post_id, old.post_id)
  )
  where id = coalesce(new.post_id, old.post_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_network_post_like_count_insert on public.network_post_likes;
create trigger refresh_network_post_like_count_insert
  after insert on public.network_post_likes
  for each row execute function public.refresh_network_post_like_count();

drop trigger if exists refresh_network_post_like_count_delete on public.network_post_likes;
create trigger refresh_network_post_like_count_delete
  after delete on public.network_post_likes
  for each row execute function public.refresh_network_post_like_count();

create or replace function public.refresh_network_post_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.network_posts
  set reply_count = (
    select count(*)::integer
    from public.network_replies
    where post_id = coalesce(new.post_id, old.post_id)
      and is_flagged = false
      and expires_at > now()
  )
  where id = coalesce(new.post_id, old.post_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_network_post_reply_count_insert on public.network_replies;
create trigger refresh_network_post_reply_count_insert
  after insert on public.network_replies
  for each row execute function public.refresh_network_post_reply_count();

drop trigger if exists refresh_network_post_reply_count_update on public.network_replies;
create trigger refresh_network_post_reply_count_update
  after update of is_flagged, expires_at on public.network_replies
  for each row execute function public.refresh_network_post_reply_count();

drop trigger if exists refresh_network_post_reply_count_delete on public.network_replies;
create trigger refresh_network_post_reply_count_delete
  after delete on public.network_replies
  for each row execute function public.refresh_network_post_reply_count();
