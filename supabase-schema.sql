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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

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
