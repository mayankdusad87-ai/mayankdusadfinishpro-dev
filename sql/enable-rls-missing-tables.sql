-- =============================================================
-- Enable RLS on 3 unprotected tables: unit_stores, project_milestones, app_settings
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Date: 2026-08-21
-- =============================================================

-- ============================================
-- 1. unit_stores
-- ============================================
-- Used by admin panel for marking material store units.
-- Read by client-side repo (store-repo.ts) using anon key.
-- Writes go through /api/admin/stores (uses supabaseAdmin, bypasses RLS).

ALTER TABLE unit_stores ENABLE ROW LEVEL SECURITY;

-- Admins + finishing_team: full access
CREATE POLICY "Admins full access to unit_stores"
  ON unit_stores FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated users can read stores for their assigned projects
-- (supervisors need to see which units are stores to skip them)
CREATE POLICY "Authenticated users can view unit_stores"
  ON unit_stores FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- 2. project_milestones
-- ============================================
-- Targets/milestones set by admin. Read by client-side target-repo.ts and TargetSetter.tsx.
-- Writes go through /api/targets (uses supabaseAdmin, bypasses RLS).

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

-- Admins + finishing_team: full access
CREATE POLICY "Admins full access to project_milestones"
  ON project_milestones FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated users can read milestones (for dashboard/reports)
CREATE POLICY "Authenticated users can view project_milestones"
  ON project_milestones FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- 3. app_settings
-- ============================================
-- Key-value settings (stage weights, paint days, management access).
-- Read by client-side settings-repo.ts using anon key.
-- Writes also go through client-side (setAppSetting) — needs admin write policy.

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Admins: full access (read + write settings)
CREATE POLICY "Admins full access to app_settings"
  ON app_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated users can read settings (needed for insights computation etc.)
CREATE POLICY "Authenticated users can view app_settings"
  ON app_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Verify: list all tables and their RLS status
-- ============================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
