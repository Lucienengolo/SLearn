-- Admin dashboard: unmatched-request rate by subject/neighborhood (CEO plan
-- Row 11, item 11) -- surfaces tutor-supply gaps.
--
-- security_invoker = false (definer semantics, same fix as
-- 0021_fix_course_stats_security_invoker.sql): tutor_requests' own RLS
-- scopes each row to its owning parent or a tied tutor, so a plain
-- security_invoker=true view would show a reviewer almost nothing (they're
-- neither). Unlike course_stats though, this data is NOT meant to be public
-- -- it's an admin-only metric, so unlike course_stats (granted to
-- anon/authenticated) this view embeds its own reviewer check directly:
-- auth.uid() still reflects the real calling user regardless of the view's
-- invoker/definer setting, so `where exists (...)` correctly gates access
-- per-caller even though the aggregation itself bypasses tutor_requests' RLS.
-- A non-reviewer querying this view gets zero rows back, not an error.
create view tutor_request_match_stats
  with (security_invoker = false) as
select
  category_id,
  neighborhood,
  count(*) as total_requests,
  count(*) filter (where status = 'searching') as unmatched_count,
  count(*) filter (where status = 'matched') as matched_count,
  count(*) filter (where status = 'cancelled') as cancelled_count,
  round(100.0 * count(*) filter (where status = 'searching') / nullif(count(*), 0), 1) as unmatched_rate_pct
from tutor_requests
where exists (select 1 from profiles p where p.id = auth.uid() and p.is_reviewer = true)
group by category_id, neighborhood;

grant select on tutor_request_match_stats to authenticated;
