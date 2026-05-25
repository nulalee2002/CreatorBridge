-- 20260524140000_three_pillar_taxonomy.sql
-- Adds 3-pillar service taxonomy to creator_listings.
-- Keeps creator_services table intact for one release for backward compatibility.
-- CHECK constraints are applied AFTER backfill in a follow-up migration.

-- 1. Add new columns
ALTER TABLE public.creator_listings
  ADD COLUMN IF NOT EXISTS primary_pillar text,
  ADD COLUMN IF NOT EXISTS sub_niches text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS minimum_project_budget numeric DEFAULT 0;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_creator_listings_pillar
  ON public.creator_listings (primary_pillar);

CREATE INDEX IF NOT EXISTS idx_creator_listings_sub_niches
  ON public.creator_listings USING gin (sub_niches);

-- 3. Rebuild search_vector to include the new pillar fields.
--    search_vector is a STORED GENERATED column, so we drop and recreate.
ALTER TABLE public.creator_listings DROP COLUMN IF EXISTS search_vector;

-- Note: sub_niches is NOT included in the tsvector because array_to_string
-- is marked STABLE (not IMMUTABLE) and STORED generated columns require
-- IMMUTABLE expressions. Sub-niche filtering uses the GIN array index above
-- with `sub_niches @> ARRAY['vp_brand_films']` style queries instead.
ALTER TABLE public.creator_listings
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english',
        coalesce(name,           '') || ' ' ||
        coalesce(business_name,  '') || ' ' ||
        coalesce(bio,            '') || ' ' ||
        coalesce(city,           '') || ' ' ||
        coalesce(state,          '') || ' ' ||
        coalesce(tier,           '') || ' ' ||
        coalesce(primary_pillar, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS creator_listings_search_idx
  ON public.creator_listings USING gin(search_vector);

-- 4. Documentation
COMMENT ON COLUMN public.creator_listings.primary_pillar IS '3-pillar taxonomy: video_production, photography, or post_production';
COMMENT ON COLUMN public.creator_listings.sub_niches IS 'Array of sub-niche IDs (1 to 3) belonging to primary_pillar';
COMMENT ON COLUMN public.creator_listings.minimum_project_budget IS 'Optional client-facing budget floor in USD';
