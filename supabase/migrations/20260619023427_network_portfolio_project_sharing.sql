alter table public.network_posts
  add column if not exists creator_listing_id uuid,
  add column if not exists portfolio_item_id uuid;

alter table public.network_posts
  drop constraint if exists network_posts_creator_listing_id_fkey,
  add constraint network_posts_creator_listing_id_fkey
    foreign key (creator_listing_id) references public.creator_listings(id) on delete set null,
  drop constraint if exists network_posts_portfolio_item_id_fkey,
  add constraint network_posts_portfolio_item_id_fkey
    foreign key (portfolio_item_id) references public.portfolio_items(id) on delete set null,
  drop constraint if exists network_posts_post_type_allowed,
  add constraint network_posts_post_type_allowed check (
    post_type in ('general', 'collab', 'looking_for_creator', 'industry_news', 'portfolio', 'referral')
  );

create index if not exists idx_network_posts_portfolio_item
  on public.network_posts(portfolio_item_id)
  where portfolio_item_id is not null;

create schema if not exists creatorbridge_private;
revoke all on schema creatorbridge_private from public;

create or replace function creatorbridge_private.validate_network_portfolio_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.post_type = 'portfolio' then
    if new.creator_listing_id is null or new.portfolio_item_id is null then
      raise exception 'Portfolio posts require an approved CreatorBridge portfolio project';
    end if;

    if not exists (
      select 1
      from public.creator_listings listing
      join public.portfolio_items item on item.listing_id = listing.id
      where listing.id = new.creator_listing_id
        and item.id = new.portfolio_item_id
        and listing.user_id = new.user_id
        and listing.review_status = 'approved'
    ) then
      raise exception 'Portfolio project must belong to the posting creator and an approved listing';
    end if;
  elsif new.creator_listing_id is not null or new.portfolio_item_id is not null then
    raise exception 'Portfolio references are only allowed on portfolio posts';
  end if;

  return new;
end;
$$;

revoke execute on function creatorbridge_private.validate_network_portfolio_share() from public, anon, authenticated;

drop trigger if exists validate_network_portfolio_share_trigger on public.network_posts;
create trigger validate_network_portfolio_share_trigger
  before insert or update of post_type, creator_listing_id, portfolio_item_id, user_id
  on public.network_posts
  for each row execute function creatorbridge_private.validate_network_portfolio_share();
