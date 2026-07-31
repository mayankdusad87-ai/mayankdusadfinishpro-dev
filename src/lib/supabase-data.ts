import { supabase } from './supabase';
import type { ManagedProject } from './project-store';
import type { UploadedActivity, ProjectData } from './project-data-store';
import type { ActivityRow, ActivityUpdate, ProjectRow, AuditLogRow as AuditLogDbRow, ActivityPhotoRow, AppErrorRow, ReasonRow } from '@/types/database.types';
import { MAX_PHOTO_SIZE, MAX_PHOTOS_PER_ACTIVITY, PHOTO_BUCKET, IMAGE_SIGNATURES } from '@/lib/constants';

function logAppError(action: string, rawError: string, userFriendly: string, extra?: Record<string, unknown>) {
  console.error(`[${action}]`, rawError);
  supabase.auth.getUser().then(({ data }) => {
    supabase.from('app_errors').insert({
      user_id: data.user?.id || null,
      user_email: data.user?.email || null,
      action,
      raw_error: rawError,
      friendly_message: userFriendly,
      context: extra ? JSON.stringify(extra) : null,
      page_url: typeof window !== 'undefined' ? window.location.pathname : null,
    }).then(() => {});
  });
}

function friendlyError(raw: string, context: string, extra?: Record<string, unknown>): string {
  const lower = raw.toLowerCase();
  let friendly: string;
  if (lower.includes('row level security') || lower.includes('rls'))
    friendly = `Permission denied: unable to ${context}. Please contact admin.`;
  else if (lower.includes('duplicate key') || lower.includes('unique constraint'))
    friendly = `This ${context} already exists.`;
  else if (lower.includes('network') || lower.includes('fetch'))
    friendly = `Network error while trying to ${context}. Check your internet connection.`;
  else if (lower.includes('storage') && lower.includes('not found'))
    friendly = `File not found. It may have been deleted already.`;
  else if (lower.includes('payload too large') || lower.includes('too large'))
    friendly = `File is too large to upload. Please reduce the file size.`;
  else if (lower.includes('jwt') || lower.includes('token') || lower.includes('auth'))
    friendly = `Session expired. Please log in again.`;
  else
    friendly = `Something went wrong while trying to ${context}. Please try again.`;
  logAppError(context, raw, friendly, extra);
  return friendly;
}

// ---- Error Log ----

export type { AppErrorRow as AppError };

export async function getAppErrors(filters?: { startDate?: string; endDate?: string; action?: string }): Promise<AppErrorRow[]> {
  let query = supabase
    .from('app_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters?.startDate) query = query.gte('created_at', filters.startDate);
  if (filters?.endDate) query = query.lte('created_at', filters.endDate + 'T23:59:59');
  if (filters?.action) query = query.ilike('action', `%${filters.action}%`);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// ---- Projects ----

export async function getProjectsFromSupabase(): Promise<ManagedProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, location, status, total_floors, total_flats, created_at, has_template')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(projectRowToManaged);
}

function projectRowToManaged(row: Pick<ProjectRow, 'id' | 'name' | 'location' | 'status' | 'total_floors' | 'total_flats' | 'created_at' | 'has_template'>): ManagedProject {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    status: (row.status || 'active') as 'active' | 'completed' | 'on_hold',
    totalFloors: row.total_floors ?? 0,
    totalFlats: row.total_flats ?? 0,
    createdAt: row.created_at ?? '',
    hasTemplate: row.has_template ?? false,
  };
}

export async function getProjectFromSupabase(id: string): Promise<ManagedProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, location, status, total_floors, total_flats, created_at, has_template')
    .eq('id', id)
    .single();

  if (error) return null;
  return projectRowToManaged(data);
}

export async function saveProjectToSupabase(project: ManagedProject, createdBy?: string): Promise<string> {
  const isNew = project.id.startsWith('proj_');

  if (isNew) {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: project.name,
        location: project.location,
        status: project.status,
        total_floors: project.totalFloors,
        total_flats: project.totalFlats,
        has_template: project.hasTemplate,
        created_by: createdBy ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } else {
    const { error } = await supabase
      .from('projects')
      .update({
        name: project.name,
        location: project.location,
        status: project.status,
        total_floors: project.totalFloors,
        total_flats: project.totalFlats,
        has_template: project.hasTemplate,
      })
      .eq('id', project.id);
    if (error) throw error;
    return project.id;
  }
}

export async function deleteProjectFromSupabase(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ---- Activities ----

function activityRowToUploaded(row: ActivityRow): UploadedActivity {
  return {
    id: row.id,
    series: row.series || '',
    floor: row.floor,
    flat_number: row.flat_number,
    configuration: row.configuration || '',
    stage: row.stage,
    stage_gate: row.stage_gate || '',
    activity: row.activity,
    vendor: row.vendor || '',
    applicable: row.applicable ?? true,
    expected_start: row.expected_start || '',
    expected_end: row.expected_end || '',
    actual_start: row.actual_start || '',
    actual_end: row.actual_end || '',
    status: row.status || 'not_started',
    delay_days: row.delay_days || 0,
    delay_reason: row.delay_reason || '',
    remarks: row.remarks || '',
    rooms: (row.rooms as Record<string, string>) || {},
    sort_order: row.sort_order || 0,
    sub_stage_status: row.sub_stage_status || '',
    flat_status: row.flat_status || '',
    floor_status: row.floor_status || '',
    risk_status: row.risk_status || '',
    revised_start: row.revised_start || '',
    revised_end: row.revised_end || '',
  };
}

export async function getActivitiesFromSupabase(projectId: string): Promise<UploadedActivity[]> {
  const PAGE = 1000;
  const allRows: ActivityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return allRows.map(activityRowToUploaded);
}

export async function saveActivitiesToSupabase(
  projectId: string,
  activities: UploadedActivity[]
): Promise<void> {
  // Delete existing activities for this project
  await supabase.from('activities').delete().eq('project_id', projectId);

  // Batch insert in chunks of 500
  const rows = activities.map(a => ({
    project_id: projectId,
    series: a.series,
    floor: a.floor,
    flat_number: a.flat_number,
    configuration: a.configuration,
    stage: a.stage,
    stage_gate: a.stage_gate,
    activity: a.activity,
    vendor: a.vendor,
    applicable: a.applicable,
    expected_start: a.expected_start,
    expected_end: a.expected_end,
    actual_start: a.actual_start,
    actual_end: a.actual_end,
    status: a.status,
    delay_days: a.delay_days,
    delay_reason: a.delay_reason,
    remarks: a.remarks,
    rooms: a.rooms,
    sort_order: a.sort_order,
    sub_stage_status: a.sub_stage_status,
    flat_status: a.flat_status,
    floor_status: a.floor_status,
    risk_status: a.risk_status,
    revised_start: a.revised_start,
    revised_end: a.revised_end,
  }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('activities').insert(chunk);
    if (error) throw error;
  }
}

export async function updateActivityInSupabase(
  activityId: string,
  updates: Partial<UploadedActivity>
): Promise<void> {
  const row: ActivityUpdate = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.actual_start !== undefined) row.actual_start = updates.actual_start;
  if (updates.actual_end !== undefined) row.actual_end = updates.actual_end;
  if (updates.delay_days !== undefined) row.delay_days = updates.delay_days;
  if (updates.delay_reason !== undefined) row.delay_reason = updates.delay_reason;
  if (updates.remarks !== undefined) row.remarks = updates.remarks;
  if (updates.vendor !== undefined) row.vendor = updates.vendor;
  if (updates.rooms !== undefined) row.rooms = updates.rooms;
  if (updates.revised_start !== undefined) row.revised_start = updates.revised_start;
  if (updates.revised_end !== undefined) row.revised_end = updates.revised_end;

  const { error } = await supabase.from('activities').update(row).eq('id', activityId);
  if (error) throw error;
}

// ---- Upload tracking ----

export async function recordUpload(
  projectId: string,
  fileName: string,
  totalRows: number,
  uploadedBy: string
): Promise<void> {
  const { error } = await supabase.from('uploads').insert({
    project_id: projectId,
    file_name: fileName,
    total_rows: totalRows,
    uploaded_by: uploadedBy,
  });
  if (error) throw error;
}

// ---- Build ProjectData from Supabase (compatible with existing components) ----

export async function getProjectDataFromSupabase(projectId: string): Promise<ProjectData | null> {
  const activities = await getActivitiesFromSupabase(projectId);
  if (activities.length === 0) return null;

  const project = await getProjectFromSupabase(projectId);

  const stagesSet = new Set<string>();
  const vendorsSet = new Set<string>();
  const floorsSet = new Set<number>();
  const configsSet = new Set<string>();
  const statusesSet = new Set<string>();
  const stageGatesMap: Record<string, Set<string>> = {};
  const activityNamesMap: Record<string, Set<string>> = {};

  for (const a of activities) {
    stagesSet.add(a.stage);
    if (a.vendor) vendorsSet.add(a.vendor);
    floorsSet.add(a.floor);
    if (a.configuration) configsSet.add(a.configuration);
    if (a.status) statusesSet.add(a.status);

    if (!stageGatesMap[a.stage]) stageGatesMap[a.stage] = new Set();
    stageGatesMap[a.stage].add(a.stage_gate);

    const sgKey = `${a.stage}||${a.stage_gate}`;
    if (!activityNamesMap[sgKey]) activityNamesMap[sgKey] = new Set();
    activityNamesMap[sgKey].add(a.activity);
  }

  return {
    projectId,
    name: project?.name || 'Project',
    uploadedAt: new Date().toISOString(),
    fileName: '',
    totalRows: activities.length,
    activities,
    stages: [...stagesSet],
    stageGates: Object.fromEntries(
      Object.entries(stageGatesMap).map(([k, v]) => [k, [...v]])
    ),
    activityNames: Object.fromEntries(
      Object.entries(activityNamesMap).map(([k, v]) => [k, [...v]])
    ),
    vendors: [...vendorsSet].filter(Boolean).sort(),
    floors: [...floorsSet].sort((a, b) => a - b),
    configurations: [...configsSet].filter(Boolean),
    statuses: [...statusesSet],
  };
}

// ---- Supervisor management ----

export async function createSupervisor(
  email: string,
  password: string,
  fullName: string,
  phone?: string
): Promise<{ error: string | null; userId?: string }> {
  const res = await fetch('/api/admin/create-supervisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, phone }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to create supervisor' };
  return { error: null, userId: json.userId };
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ error: string | null }> {
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, newPassword }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to reset password' };
  return { error: null };
}

export async function deactivateSupervisor(userId: string, isActive: boolean): Promise<{ error: string | null }> {
  const res = await fetch('/api/admin/deactivate-supervisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, isActive }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to update supervisor status' };
  return { error: null };
}

export async function getSupervisors(): Promise<Array<{
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  project_name: string | null;
  assigned_floors: number[];
}>> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      supervisor_assignments(
        project_id,
        assigned_floors,
        projects(name, location)
      )
    `)
    .eq('role', 'supervisor')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => {
    const assignments = (row.supervisor_assignments as Array<{
      project_id: string;
      assigned_floors: number[];
      projects: { name: string; location: string } | null;
    }>) || [];
    const first = assignments[0];
    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      is_active: row.is_active ?? true,
      project_name: first?.projects ? `${first.projects.name} — ${first.projects.location}` : null,
      assigned_floors: first?.assigned_floors || [],
    };
  });
}

export async function getSupervisorAssignments(supervisorId: string): Promise<Array<{ project_id: string; assigned_floors: number[] }>> {
  const { data, error } = await supabase
    .from('supervisor_assignments')
    .select('project_id, assigned_floors')
    .eq('supervisor_id', supervisorId);
  if (error || !data) return [];
  return data.map(d => ({
    project_id: d.project_id || '',
    assigned_floors: d.assigned_floors || [],
  }));
}

export async function assignSupervisorToProject(
  supervisorId: string,
  projectId: string,
  floors: number[]
): Promise<void> {
  const { error } = await supabase.from('supervisor_assignments').upsert({
    supervisor_id: supervisorId,
    project_id: projectId,
    assigned_floors: floors,
  }, { onConflict: 'supervisor_id,project_id' });
  if (error) throw error;
}

// ---- Reasons management ----

export type Reason = ReasonRow;

export async function getReasons(): Promise<Reason[]> {
  const { data, error } = await supabase
    .from('reasons')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getActiveReasons(): Promise<Reason[]> {
  const { data, error } = await supabase
    .from('reasons')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createReason(label: string, sortOrder: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reasons').insert({ label, sort_order: sortOrder });
  if (error) return { error: friendlyError(error.message, 'create reason') };
  return { error: null };
}

export async function updateReason(id: string, updates: { label?: string; is_active?: boolean; sort_order?: number }): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reasons').update(updates).eq('id', id);
  if (error) return { error: friendlyError(error.message, 'update reason') };
  return { error: null };
}

export async function deleteReason(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reasons').delete().eq('id', id);
  if (error) return { error: friendlyError(error.message, 'delete reason') };
  return { error: null };
}

// ---- Activity Photos ----

export type ActivityPhoto = ActivityPhotoRow & { url?: string };


function detectImageType(header: Uint8Array): string | null {
  for (const sig of IMAGE_SIGNATURES) {
    if (sig.bytes.every((b, i) => header[i] === b)) return sig.type;
  }
  return null;
}

export async function uploadActivityPhoto(
  file: Blob,
  storagePath: string,
  metadata: {
    activityId: string;
    projectId: string;
    fileName: string;
    floor: number;
    stage: string;
    stageGate: string;
    activityName: string;
    flatNumber: number;
    uploadedBy: string;
  }
): Promise<{ error: string | null }> {
  if (file.size > MAX_PHOTO_SIZE) {
    return { error: 'Photo exceeds the 5 MB size limit.' };
  }

  const headerSlice = await file.slice(0, 12).arrayBuffer();
  const header = new Uint8Array(headerSlice);
  const detectedType = detectImageType(header);

  if (!detectedType) {
    return { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' };
  }

  const existing = await supabase
    .from('activity_photos')
    .select('id', { count: 'exact' })
    .eq('activity_id', metadata.activityId);

  if ((existing.count ?? 0) >= MAX_PHOTOS_PER_ACTIVITY) {
    return { error: `Maximum ${MAX_PHOTOS_PER_ACTIVITY} photos per activity reached.` };
  }

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, file, { contentType: detectedType, upsert: false });

  const photoCtx = { floor: metadata.floor, flat: metadata.flatNumber, activity: metadata.activityName, stage: metadata.stage };

  if (uploadError) return { error: friendlyError(uploadError.message, 'upload photo', photoCtx) };

  const { error: dbError } = await supabase.from('activity_photos').insert({
    activity_id: metadata.activityId,
    project_id: metadata.projectId,
    storage_path: storagePath,
    file_name: metadata.fileName,
    file_size: file.size,
    uploaded_by: metadata.uploadedBy,
    floor: metadata.floor,
    stage: metadata.stage,
    stage_gate: metadata.stageGate,
    activity_name: metadata.activityName,
    flat_number: metadata.flatNumber,
  });

  if (dbError) return { error: friendlyError(dbError.message, 'save photo record', photoCtx) };
  return { error: null };
}

export async function getPhotosForActivity(activityId: string): Promise<ActivityPhoto[]> {
  const { data, error } = await supabase
    .from('activity_photos')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });

  if (error) return [];

  return (data || []).map(photo => {
    const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(photo.storage_path);
    return { ...photo, url: urlData.publicUrl };
  });
}

export async function getPhotosForProject(
  projectId: string,
  filters?: { floor?: number; stage?: string; stageGate?: string }
): Promise<ActivityPhoto[]> {
  let query = supabase
    .from('activity_photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.floor) query = query.eq('floor', filters.floor);
  if (filters?.stage) query = query.eq('stage', filters.stage);
  if (filters?.stageGate) query = query.eq('stage_gate', filters.stageGate);

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map(photo => {
    const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(photo.storage_path);
    return { ...photo, url: urlData.publicUrl };
  });
}

export async function deleteActivityPhoto(photoId: string, storagePath: string): Promise<{ error: string | null }> {
  const { error: storageErr } = await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  if (storageErr) return { error: friendlyError(storageErr.message, 'delete photo file') };

  const { error: dbErr } = await supabase.from('activity_photos').delete().eq('id', photoId);
  if (dbErr) return { error: friendlyError(dbErr.message, 'delete photo record') };
  return { error: null };
}

// ---- Audit Log ----

export type AuditLogRow = AuditLogDbRow & {
  changed_by_name?: string;
  changed_by_role?: string;
  project_name?: string;
};

export async function getAuditLog(
  projectId: string,
  filters?: { startDate?: string; endDate?: string }
): Promise<AuditLogRow[]> {
  let query = supabase
    .from('audit_log')
    .select('id, activity_id, project_id, changed_by, old_status, new_status, floor, flat_number, stage, stage_gate, activity_name, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('created_at', `${filters.startDate}T00:00:00`);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', `${filters.endDate}T23:59:59`);
  }

  const { data, error } = await query.limit(500);
  if (error) return [];

  const rows = data || [];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map(r => r.changed_by).filter((id): id is string => Boolean(id)))];
  let profilesMap: Record<string, { full_name: string; role: string }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', userIds);

    if (profiles) {
      profilesMap = Object.fromEntries(
        profiles.map(p => [p.id, { full_name: p.full_name, role: p.role }])
      );
    }
  }

  return rows.map(row => ({
    ...row,
    changed_by_name: row.changed_by ? (profilesMap[row.changed_by]?.full_name || 'Unknown') : 'System',
    changed_by_role: row.changed_by ? (profilesMap[row.changed_by]?.role || 'supervisor') : 'system',
  }));
}

// ---- Dashboard Aggregation ----

export interface SubstageRollup {
  flat_number: number;
  stage: string;
  stage_gate: string;
  floor: number;
  completed: number;
  yet_to_start: number;
  total: number;
}

export interface DashboardData {
  stats: Record<string, number>;
  heatmap: SubstageRollup[];
  stages: string[];
  vendors: string[];
}

export async function getDashboardData(projectId: string): Promise<DashboardData | null> {
  const { data, error } = await supabase.rpc('get_dashboard_data', { p_project_id: projectId });
  if (error || !data) return null;
  const result = data as unknown as { stats: Record<string, number>; heatmap: SubstageRollup[]; stages: string[]; vendors: string[] };
  return {
    stats: result.stats || {},
    heatmap: result.heatmap || [],
    stages: (result.stages || []).filter(Boolean),
    vendors: (result.vendors || []).filter(Boolean).sort(),
  };
}

export interface ActivitiesPage {
  rows: ActivityRow[];
  totalCount: number;
}

export async function getActivitiesPage(
  projectId: string,
  filters: { floor?: string; stage?: string; stageGate?: string; vendor?: string; status?: string },
  page: number,
  perPage: number
): Promise<ActivitiesPage> {
  let query = supabase
    .from('activities')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (filters.floor) {
    const floorNum = parseInt(filters.floor.replace('Floor ', ''), 10);
    if (!isNaN(floorNum)) query = query.eq('floor', floorNum);
  }
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.stageGate) query = query.eq('stage_gate', filters.stageGate);
  if (filters.vendor) query = query.eq('vendor', filters.vendor);
  if (filters.status) {
    if (filters.status === 'in_progress') {
      query = query.in('status', ['in_progress', 'in_progress_delayed']);
    } else if (filters.status === 'completed') {
      query = query.in('status', ['completed', 'completed_delayed']);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) return { rows: [], totalCount: 0 };
  return { rows: data || [], totalCount: count || 0 };
}

export async function getCriticalDelays(projectId: string, limit = 5): Promise<Array<Pick<ActivityRow, 'id' | 'floor' | 'flat_number' | 'stage' | 'stage_gate' | 'activity' | 'vendor' | 'delay_days'>>> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, floor, flat_number, stage, stage_gate, activity, vendor, delay_days')
    .eq('project_id', projectId)
    .gt('delay_days', 0)
    .order('delay_days', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function getProjectFloors(projectId: string): Promise<number[]> {
  const [activitiesRes, projectRes] = await Promise.all([
    supabase.from('activities').select('floor').eq('project_id', projectId).limit(50000),
    supabase.from('projects').select('total_floors').eq('id', projectId).single(),
  ]);
  const activityFloors = new Set(
    (activitiesRes.data || []).map((r: { floor: number }) => r.floor)
  );
  const totalFloors = projectRes.data?.total_floors || 0;
  if (totalFloors > 0) {
    for (let i = 1; i <= totalFloors; i++) activityFloors.add(i);
  }
  return [...activityFloors].sort((a, b) => a - b);
}

// ---- Admin Activity Updates ----

export async function updateActivityWithAudit(
  activityId: string,
  updates: ActivityUpdate,
  auditInfo: {
    projectId: string;
    changedBy: string;
    oldStatus?: string;
    newStatus?: string;
    floor?: number;
    flatNumber?: number;
    stage?: string;
    stageGate?: string;
    activityName?: string;
  }
): Promise<{ error: string | null }> {
  const actCtx = { floor: auditInfo.floor, flat: auditInfo.flatNumber, activity: auditInfo.activityName, stage: auditInfo.stage, oldStatus: auditInfo.oldStatus, newStatus: auditInfo.newStatus };
  const { error } = await supabase.from('activities').update(updates).eq('id', activityId);
  if (error) return { error: friendlyError(error.message, 'update activity status', actCtx) };

  if (auditInfo.oldStatus && auditInfo.newStatus && auditInfo.oldStatus !== auditInfo.newStatus) {
    await supabase.from('audit_log').insert({
      activity_id: activityId,
      project_id: auditInfo.projectId,
      changed_by: auditInfo.changedBy || null,
      old_status: auditInfo.oldStatus,
      new_status: auditInfo.newStatus,
      floor: auditInfo.floor,
      flat_number: auditInfo.flatNumber,
      stage: auditInfo.stage,
      stage_gate: auditInfo.stageGate,
      activity_name: auditInfo.activityName,
    });
  }

  return { error: null };
}

export async function bulkUpdateActivities(
  activityIds: string[],
  updates: ActivityUpdate
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('activities').update(updates).in('id', activityIds);
  if (error) return { error: friendlyError(error.message, 'bulk update activities') };
  return { error: null };
}

export async function getPhotoCount(activityId: string): Promise<number> {
  const { count, error } = await supabase
    .from('activity_photos')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId);
  if (error) return 0;
  return count ?? 0;
}

export async function getAllFilteredActivities(
  projectId: string,
  filters: { floor?: string; stage?: string; stageGate?: string; vendor?: string; status?: string }
): Promise<ActivityRow[]> {
  let query = supabase
    .from('activities')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (filters.floor) {
    const floorNum = parseInt(filters.floor.replace('Floor ', ''), 10);
    if (!isNaN(floorNum)) query = query.eq('floor', floorNum);
  }
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.stageGate) query = query.eq('stage_gate', filters.stageGate);
  if (filters.vendor) query = query.eq('vendor', filters.vendor);
  if (filters.status) {
    if (filters.status === 'in_progress') {
      query = query.in('status', ['in_progress', 'in_progress_delayed']);
    } else if (filters.status === 'completed') {
      query = query.in('status', ['completed', 'completed_delayed']);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  const allRows: ActivityRow[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allRows;
}

export async function getAdminEmails(): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin');
  if (!data) return [];
  return data.map(r => r.email).filter((e): e is string => Boolean(e));
}

// ---- Refuge Config ----

export async function getRefugeConfig(projectId: string): Promise<{ floors: number[]; units: number[] }> {
  const { data, error } = await supabase
    .from('projects')
    .select('refuge_floors, refuge_units')
    .eq('id', projectId)
    .single();
  if (error || !data) return { floors: [], units: [] };
  return {
    floors: data.refuge_floors || [],
    units: data.refuge_units || [],
  };
}

export async function saveRefugeConfig(
  projectId: string,
  refugeFloors: number[],
  refugeUnits: number[]
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('projects')
    .update({ refuge_floors: refugeFloors, refuge_units: refugeUnits })
    .eq('id', projectId);
  if (error) return { error: friendlyError(error.message, 'update project settings') };
  return { error: null };
}

