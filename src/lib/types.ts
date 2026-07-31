export type UserRole = 'admin' | 'supervisor';

export type ProjectStatus = 'active' | 'completed' | 'on_hold';

export type ActivityStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';

export type ChangeType = 'date_change' | 'status_change' | 'vendor_change' | 'assignment_change';

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

export interface Supervisor extends User {
  assigned_projects: string[];
  assigned_floors: number[];
  project_name?: string;
  status_label?: string;
}

