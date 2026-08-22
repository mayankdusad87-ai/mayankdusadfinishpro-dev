-- RPC functions for fast DISTINCT stage/floor lookups
-- Instead of fetching all activity rows (thousands) and deduplicating client-side,
-- these return only the unique values (~9 stages, ~22 floors).

-- Returns distinct stage values for a given project
CREATE OR REPLACE FUNCTION distinct_stages(p_project_id UUID)
RETURNS TABLE(stage TEXT)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT a.stage
  FROM activities a
  WHERE a.project_id = p_project_id
    AND a.stage IS NOT NULL
  ORDER BY a.stage;
$$;

-- Returns distinct floor values for a given project
CREATE OR REPLACE FUNCTION distinct_floors(p_project_id UUID)
RETURNS TABLE(floor INT)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT a.floor
  FROM activities a
  WHERE a.project_id = p_project_id
    AND a.floor IS NOT NULL
  ORDER BY a.floor;
$$;
