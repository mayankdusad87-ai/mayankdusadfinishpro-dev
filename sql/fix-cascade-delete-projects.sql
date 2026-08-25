-- =============================================================
-- Fix: Add ON DELETE CASCADE to tables that reference projects
-- but were created after the initial schema without CASCADE.
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Date: 2026-08-25
-- =============================================================

-- 1. project_milestones (targets)
ALTER TABLE project_milestones
  DROP CONSTRAINT IF EXISTS project_milestones_project_id_fkey,
  ADD CONSTRAINT project_milestones_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- 2. unit_stores
ALTER TABLE unit_stores
  DROP CONSTRAINT IF EXISTS unit_stores_project_id_fkey,
  ADD CONSTRAINT unit_stores_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- 3. floor_handovers
ALTER TABLE floor_handovers
  DROP CONSTRAINT IF EXISTS floor_handovers_project_id_fkey,
  ADD CONSTRAINT floor_handovers_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- 4. app_settings (if it has a project_id column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'project_id'
  ) THEN
    EXECUTE 'ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_project_id_fkey';
    EXECUTE 'ALTER TABLE app_settings ADD CONSTRAINT app_settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE';
  END IF;
END $$;

-- 5. notifications (if it has a project_id column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'project_id'
  ) THEN
    EXECUTE 'ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_project_id_fkey';
    EXECUTE 'ALTER TABLE notifications ADD CONSTRAINT notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE';
  END IF;
END $$;
