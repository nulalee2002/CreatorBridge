-- ── Platform search infrastructure ──────────────────────────────
-- Uses actual creator_listings column names: name, business_name, bio, city, state, tier, avatar.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Full-text search column on creator_listings
ALTER TABLE public.creator_listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name,          '') || ' ' ||
        coalesce(business_name, '') || ' ' ||
        coalesce(bio,           '') || ' ' ||
        coalesce(city,          '') || ' ' ||
        coalesce(state,         '') || ' ' ||
        coalesce(tier,          '')
      )
    ) STORED;

-- 3. GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS creator_listings_search_idx
  ON public.creator_listings USING gin(search_vector);

-- 4. Trigram index for partial / fuzzy matching on name
CREATE INDEX IF NOT EXISTS creator_listings_trgm_idx
  ON public.creator_listings
  USING gin(name gin_trgm_ops);

-- 5. search_creators RPC
--    Returns approved, verified, non-suspended creators matching the query,
--    ordered by ts_rank so the best match comes first.
CREATE OR REPLACE FUNCTION public.search_creators(query text)
RETURNS TABLE (
  id            uuid,
  name          text,
  bio           text,
  city          text,
  state         text,
  tier          text,
  avatar        text,
  verified      boolean,
  review_status text,
  rank          real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    cl.id,
    cl.name,
    cl.bio,
    cl.city,
    cl.state,
    cl.tier,
    cl.avatar,
    cl.verified,
    cl.review_status,
    ts_rank(cl.search_vector, websearch_to_tsquery('english', query)) AS rank
  FROM public.creator_listings cl
  WHERE
    cl.review_status = 'approved'
    AND cl.verified   = true
    AND (cl.is_suspended IS NULL OR cl.is_suspended = false)
    AND cl.search_vector @@ websearch_to_tsquery('english', query)
  ORDER BY rank DESC;
$$;

REVOKE ALL ON FUNCTION public.search_creators(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.search_creators(text) TO anon, authenticated;
