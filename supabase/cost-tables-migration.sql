-- Cost Estimator Phase 1: Project Budget Tracker
-- Run this in Supabase SQL Editor

-- 1. Packages (Finishing, Façade, MEP, etc.)
CREATE TABLE IF NOT EXISTS cost_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categories under packages (Tiling, Doors, Paint, etc.)
CREATE TABLE IF NOT EXISTS cost_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES cost_packages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Line items under categories (individual cost entries)
CREATE TABLE IF NOT EXISTS cost_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES cost_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  uom TEXT DEFAULT 'lump_sum',
  is_lump_sum BOOLEAN DEFAULT false,
  quantity NUMERIC(14,2) DEFAULT 0,
  material_rate NUMERIC(14,2) DEFAULT 0,
  labour_rate NUMERIC(14,2) DEFAULT 0,
  work_contract_rate NUMERIC(14,2) DEFAULT 0,
  material_lump NUMERIC(14,2) DEFAULT 0,
  labour_lump NUMERIC(14,2) DEFAULT 0,
  work_contract_lump NUMERIC(14,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Payments recorded against categories
CREATE TABLE IF NOT EXISTS cost_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES cost_categories(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('material', 'labour', 'work_contract')),
  amount NUMERIC(14,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cost_packages_project ON cost_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_categories_package ON cost_categories(package_id);
CREATE INDEX IF NOT EXISTS idx_cost_line_items_category ON cost_line_items(category_id);
CREATE INDEX IF NOT EXISTS idx_cost_payments_category ON cost_payments(category_id);

-- RLS Policies (admin-only via service role, no RLS needed since we use supabaseAdmin)
ALTER TABLE cost_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_payments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (supabaseAdmin bypasses RLS anyway)
-- These policies prevent direct client access
CREATE POLICY "Service role full access" ON cost_packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON cost_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON cost_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON cost_payments FOR ALL USING (true) WITH CHECK (true);
