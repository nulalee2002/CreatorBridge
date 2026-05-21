-- Enforce the network membership gate in the database, not only in React.

create or replace function public.is_verified_network_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'client') = 'client'
  )
  or exists (
    select 1
    from public.creator_listings cl
    where cl.user_id = auth.uid()
      and (
        cl.review_status = 'approved'
        or cl.verified = true
        or cl.verification_status in ('verified', 'pro_verified')
      )
  );
$$;

revoke all on function public.is_verified_network_member() from public, anon;
grant execute on function public.is_verified_network_member() to authenticated;

drop policy if exists "Verified members can post" on public.network_posts;
create policy "Verified members can post"
  on public.network_posts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and is_flagged = false and public.is_verified_network_member());

drop policy if exists "Verified members can reply" on public.network_replies;
create policy "Verified members can reply"
  on public.network_replies
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and is_flagged = false
    and public.is_verified_network_member()
    and exists (
      select 1
      from public.network_posts p
      where p.id = network_replies.post_id
        and p.is_flagged = false
        and p.expires_at > now()
    )
  );

drop policy if exists "Anyone can like posts" on public.network_post_likes;
create policy "Verified members can like posts"
  on public.network_post_likes
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_verified_network_member()
    and exists (
      select 1
      from public.network_posts p
      where p.id = network_post_likes.post_id
        and p.is_flagged = false
        and p.expires_at > now()
    )
  );

drop policy if exists "Verified members can send messages" on public.state_chat_messages;
create policy "Verified members can send messages"
  on public.state_chat_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and is_flagged = false and public.is_verified_network_member());
