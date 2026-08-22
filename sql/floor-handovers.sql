-- Floor-level RCC handover tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS floor_handovers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  floor integer NOT NULL,
  planned_handover date,
  actual_handover date,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One row per project + floor
  UNIQUE (project_id, floor)
);

-- Enable RLS
ALTER TABLE floor_handovers ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read/write
CREATE POLICY "Authenticated users can manage floor handovers"
  ON floor_handovers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX idx_floor_handovers_project ON floor_handovers(project_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_floor_handovers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER floor_handovers_updated_at
  BEFORE UPDATE ON floor_handovers
  FOR EACH ROW
  EXECUTE FUNCTION update_floor_handovers_updated_at();
