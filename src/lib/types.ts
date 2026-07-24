export type UserRole = 'admin' | 'supervisor';

export type ProjectStatus = 'active' | 'completed' | 'on_hold';

export type ActivityStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';

export type HoldReasonCategory = 'vendor_delay' | 'material_shortage' | 'structural' | 'weather' | 'other';

export type ChangeType = 'date_change' | 'status_change' | 'vendor_change' | 'assignment_change';

export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
}

export interface User {
  id: string;
  tenant_id: string;
  role: UserRole;
  full_name: string;
  email?: string;
  user_id_login?: string;
  phone?: string;
  is_active: boolean;
  last_login_at?: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  start_date: string;
  target_end_date: string;
  total_floors: number;
  total_flats: number;
  created_at: string;
}

export interface ProjectSupervisor {
  id: string;
  tenant_id: string;
  project_id: string;
  user_id: string;
  assigned_floors: number[];
  allow_vendor_reassignment: boolean;
  assigned_at: string;
}

export interface Stage {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  sequence_order: number;
}

export interface StageGate {
  id: string;
  tenant_id: string;
  stage_id: string;
  name: string;
  sequence_order: number;
}

export interface Floor {
  id: string;
  tenant_id: string;
  project_id: string;
  floor_number: number;
  floor_label: string;
}

export interface Flat {
  id: string;
  tenant_id: string;
  floor_id: string;
  flat_number: string;
  series: string;
  configuration: string;
}

export interface FinishingActivityMaster {
  id: string;
  tenant_id: string;
  project_id: string;
  stage_id: string;
  stage_gate_id: string;
  name: string;
  default_vendor: string;
  default_duration_days: number;
}

export interface ActivityRow {
  id: string;
  tenant_id: string;
  project_id: string;
  flat_id: string;
  finishing_activity_id: string;
  vendor_name: string;
  expected_start_date: string;
  expected_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status: ActivityStatus;
  hold_reason_category?: HoldReasonCategory;
  hold_reason_notes?: string;
  delay_reason_notes?: string;
  is_applicable: boolean;
  last_updated_by: string;
  last_updated_at: string;
  // Denormalized for display
  floor_number?: number;
  floor_label?: string;
  flat_number?: string;
  configuration?: string;
  stage_name?: string;
  stage_gate_name?: string;
  activity_name?: string;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  project_id?: string;
  entity_type: string;
  entity_id: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  change_type: ChangeType;
  changed_by: string;
  changed_by_name: string;
  changed_by_role: UserRole;
  changed_at: string;
  ip_address: string;
  user_agent: string;
  // Denormalized
  project_name?: string;
  floor_label?: string;
  flat_number?: string;
  activity_name?: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: 'expected_date_changed' | 'activity_delayed' | 'activity_on_hold' | 'assignment_changed';
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface Supervisor extends User {
  assigned_projects: string[];
  assigned_floors: number[];
  project_name?: string;
  status_label?: string;
}

export interface VendorPerformance {
  vendor: string;
  on_time_pct: number;
  delayed_pct: number;
}

export interface FloorCoverageItem {
  floor_number: number;
  floor_label: string;
  supervisors: { name: string; color: string }[];
}
