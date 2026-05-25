-- Updates global creator search to return and search the 3-pillar taxonomy fields.
-- This is intentionally a new migration because 20260524130000 has already run in production.

DROP FUNCTION IF EXISTS public.search_creators(text);

CREATE OR REPLACE FUNCTION public.search_creators(query text)
RETURNS TABLE (
  id             uuid,
  name           text,
  bio            text,
  city           text,
  state          text,
  tier           text,
  avatar         text,
  verified       boolean,
  review_status  text,
  primary_pillar text,
  sub_niches     text[],
  rank           real
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
    cl.primary_pillar,
    cl.sub_niches,
    GREATEST(
      ts_rank(cl.search_vector, websearch_to_tsquery('english', query)),
      similarity(coalesce(cl.name, ''), query),
      similarity(coalesce(cl.business_name, ''), query),
      similarity(coalesce(cl.primary_pillar, ''), query)
    ) AS rank
  FROM public.creator_listings cl
  WHERE
    cl.review_status = 'approved'
    AND cl.verified = true
    AND (cl.is_suspended IS NULL OR cl.is_suspended = false)
    AND (
      cl.search_vector @@ websearch_to_tsquery('english', query)
      OR coalesce(cl.name, '') % query
      OR coalesce(cl.business_name, '') % query
      OR coalesce(cl.primary_pillar, '') % query
      OR exists (
        SELECT 1
        FROM unnest(coalesce(cl.sub_niches, '{}'::text[])) AS sub_niche
        WHERE sub_niche ILIKE '%' || query || '%'
      )
    )
  ORDER BY rank DESC;
$$;

REVOKE ALL ON FUNCTION public.search_creators(text) FROM public;
GRANT EXECUTE ON FUNCTION public.search_creators(text) TO anon, authenticated;
