-- Migration: Add on_hold count to get_dashboard_data heatmap rollup
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_dashboard_data(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'stats', (
      SELECT COALESCE(json_object_agg(status, cnt), '{}'::json)
      FROM (
        SELECT COALESCE(status, 'not_started') as status, COUNT(*) as cnt
        FROM public.activities
        WHERE project_id = p_project_id
        GROUP BY status
      ) s
    ),
    'heatmap', (
      SELECT COALESCE(json_agg(row_to_json(h)), '[]'::json)
      FROM (
        SELECT flat_number, stage, stage_gate, floor,
          COUNT(*) FILTER (WHERE status IN ('completed', 'completed_delayed')) as completed,
          COUNT(*) FILTER (WHERE status = 'not_started') as yet_to_start,
          COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
          COUNT(*) as total
        FROM public.activities
        WHERE project_id = p_project_id
          AND status IS DISTINCT FROM 'not_applicable'
        GROUP BY flat_number, stage, stage_gate, floor
      ) h
    ),
    'stages', (
      SELECT COALESCE(json_agg(DISTINCT stage), '[]'::json)
      FROM public.activities
      WHERE project_id = p_project_id
    ),
    'vendors', (
      SELECT COALESCE(json_agg(DISTINCT vendor), '[]'::json)
      FROM public.activities
      WHERE project_id = p_project_id
      AND vendor IS NOT NULL AND vendor != ''
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
