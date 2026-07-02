-- ============================================================================
-- Performance indexes for time-ranged analytics and collaboration RLS joins
--
-- 1. platform_events is aggregated by day (platform_intelligence_daily_rollups)
--    and filtered by occurred_at ranges from the admin dashboard, CSV export,
--    and every scheduled report. The existing indexes all lead with
--    event_name / actor_id / entity_type, so a bare time-range scan falls back
--    to a sequential scan. Add a btree on occurred_at to support the range and
--    ordered aggregation. (If EXPLAIN later shows the day-grouping still scans,
--    an expression index on date_trunc('day', occurred_at) or a materialized
--    rollup table is the next step.)
--
-- 2. collaboration_workspace_link_history.collaboration_id drives the RLS SELECT
--    policy's EXISTS join and per-collaboration history lookups, but is only
--    covered by a composite unique index that does not lead with it. Add a
--    btree so those reads stay O(log n) instead of scanning the table.
-- ============================================================================

create index if not exists idx_platform_events_occurred_at
  on public.platform_events (occurred_at);

create index if not exists idx_collaboration_workspace_link_history_collaboration
  on public.collaboration_workspace_link_history (collaboration_id);
