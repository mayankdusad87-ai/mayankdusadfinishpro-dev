-- Cost Estimator: Add Subcategory level between Category and Line Items (Activities)
-- Run this in Supabase SQL Editor AFTER cost-tables-migration.sql
-- Tables are empty so we can safely alter the structure.

-- 1. Create subcategories table
CREATE TABLE IF NOT EXISTS cost_subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES cost_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_subcategories_category ON cost_subcategories(category_id);

ALTER TABLE cost_subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON cost_subcategories FOR ALL USING (true) WITH CHECK (true);

-- 2. Change cost_line_items: replace category_id with subcategory_id
ALTER TABLE cost_line_items DROP CONSTRAINT IF EXISTS cost_line_items_category_id_fkey;
ALTER TABLE cost_line_items DROP COLUMN IF EXISTS category_id;
ALTER TABLE cost_line_items ADD COLUMN subcategory_id UUID NOT NULL REFERENCES cost_subcategories(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cost_line_items_subcategory ON cost_line_items(subcategory_id);

-- Drop the old category index since the column is gone
DROP INDEX IF EXISTS idx_cost_line_items_category;
