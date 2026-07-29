-- ============================================
-- FINISHING PRO - Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → Paste → Run)
-- ============================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'supervisor' CHECK (role IN ('admin', 'supervisor')),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  total_floors INTEGER DEFAULT 0,
  total_flats INTEGER DEFAULT 0,
  has_template BOOLEAN DEFAULT false,
  refuge_floors INTEGER[] DEFAULT '{}',
  refuge_units INTEGER[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NOTE: If projects table already exists, run:
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS refuge_floors INTEGER[] DEFAULT '{}';
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS refuge_units INTEGER[] DEFAULT '{}';

-- 3. SUPERVISOR-PROJECT ASSIGNMENTS (many-to-many)
CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assigned_floors INTEGER[] DEFAULT '{}',
  allow_vendor_reassignment BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supervisor_id, project_id)
);

-- 4. ACTIVITIES TABLE (uploaded Excel data)
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  series TEXT DEFAULT '',
  floor INTEGER NOT NULL,
  flat_number INTEGER NOT NULL,
  configuration TEXT DEFAULT '',
  stage TEXT NOT NULL,
  stage_gate TEXT DEFAULT '',
  activity TEXT NOT NULL,
  vendor TEXT DEFAULT '',
  applicable BOOLEAN DEFAULT true,
  expected_start TEXT DEFAULT '',
  expected_end TEXT DEFAULT '',
  actual_start TEXT DEFAULT '',
  actual_end TEXT DEFAULT '',
  status TEXT DEFAULT 'not_started',
  delay_days INTEGER DEFAULT 0,
  delay_reason TEXT DEFAULT '',
  remarks TEXT DEFAULT '',
  rooms JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  sub_stage_status TEXT DEFAULT '',
  flat_status TEXT DEFAULT '',
  floor_status TEXT DEFAULT '',
  risk_status TEXT DEFAULT '',
  revised_start TEXT DEFAULT '',
  revised_end TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. UPLOADS METADATA (track upload history)
CREATE TABLE IF NOT EXISTS uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 6. REASONS TABLE (global delay/on-hold reasons configured by admin)
CREATE TABLE IF NOT EXISTS reasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to reasons"
  ON reasons FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can view active reasons"
  ON reasons FOR SELECT
  USING (is_active = true);

-- 7. ACTIVITY PHOTOS TABLE
CREATE TABLE IF NOT EXISTS activity_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  floor INTEGER,
  stage TEXT,
  stage_gate TEXT,
  activity_name TEXT,
  flat_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to activity_photos"
  ON activity_photos FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can insert photos for assigned projects"
  ON activity_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = activity_photos.project_id
    )
  );

CREATE POLICY "Supervisors can view photos for assigned projects"
  ON activity_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = activity_photos.project_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_activity_photos_activity ON activity_photos(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_photos_project ON activity_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_photos_floor ON activity_photos(project_id, floor);

-- ============================================
-- APP ERROR LOG
-- ============================================
CREATE TABLE IF NOT EXISTS app_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  raw_error TEXT NOT NULL,
  friendly_message TEXT NOT NULL,
  context JSONB,
  page_url TEXT
);

ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to app_errors"
  ON app_errors FOR ALL
  USING (public.is_admin());

CREATE POLICY "Authenticated users can insert errors"
  ON app_errors FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_app_errors_created ON app_errors(created_at DESC);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_floor_stage ON activities(project_id, floor, stage);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(project_id, status);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_supervisor ON supervisor_assignments(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_assignments_project ON supervisor_assignments(project_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: bypasses RLS to check admin role (avoids infinite recursion)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES: Users can read their own profile. Admins can read/write all.
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (public.is_admin());

-- PROJECTS: Admins can do everything. Supervisors can read assigned projects.
CREATE POLICY "Admins full access to projects"
  ON projects FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can view assigned projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = projects.id
    )
  );

-- ACTIVITIES: Admins can do everything. Supervisors can read/update assigned project activities.
CREATE POLICY "Admins full access to activities"
  ON activities FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can view assigned project activities"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = activities.project_id
    )
  );

CREATE POLICY "Supervisors can update assigned project activities"
  ON activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = activities.project_id
    )
  );

-- UPLOADS: Admins can do everything. Supervisors can view.
CREATE POLICY "Admins full access to uploads"
  ON uploads FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can view uploads"
  ON uploads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = uploads.project_id
    )
  );

-- SUPERVISOR_ASSIGNMENTS: Admins can manage. Supervisors can view own.
CREATE POLICY "Admins full access to assignments"
  ON supervisor_assignments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can view own assignments"
  ON supervisor_assignments FOR SELECT
  USING (supervisor_id = auth.uid());

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'supervisor'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 8. AUDIT LOG TABLE (status changes only)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  floor INTEGER,
  flat_number INTEGER,
  stage TEXT,
  stage_gate TEXT,
  activity_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to audit_log"
  ON audit_log FOR ALL
  USING (public.is_admin());

CREATE POLICY "Supervisors can view audit_log for assigned projects"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supervisor_assignments
      WHERE supervisor_id = auth.uid() AND project_id = audit_log.project_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_audit_log_project ON audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_project_date ON audit_log(project_id, created_at DESC);

-- ============================================
-- TRIGGER: Log status changes to audit_log
-- ============================================
CREATE OR REPLACE FUNCTION log_activity_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.audit_log (
      activity_id, project_id, changed_by,
      old_status, new_status,
      floor, flat_number, stage, stage_gate, activity_name
    ) VALUES (
      NEW.id, NEW.project_id, auth.uid(),
      COALESCE(OLD.status, 'not_started'), NEW.status,
      NEW.floor, NEW.flat_number, NEW.stage, NEW.stage_gate, NEW.activity
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER activities_status_audit
  AFTER UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION log_activity_status_change();

-- ============================================
-- 9. DASHBOARD AGGREGATION FUNCTION
-- Returns all dashboard data in one call (stats + heatmap rollup + filter options)
-- Replaces loading all 8,880+ individual rows to the browser
-- ============================================
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

-- ============================================
-- 10. GET DISTINCT FLOORS FUNCTION
-- Returns unique floor numbers for a project efficiently
-- (avoids Supabase JS client 1000-row default limit)
-- ============================================
CREATE OR REPLACE FUNCTION get_distinct_floors(p_project_id UUID)
RETURNS TABLE(floor INTEGER) AS $$
BEGIN
  RETURN QUERY
    SELECT DISTINCT a.floor
    FROM public.activities a
    WHERE a.project_id = p_project_id
    ORDER BY a.floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
