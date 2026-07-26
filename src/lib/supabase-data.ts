import { supabase } from './supabase';
import type { ManagedProject } from './project-store';
import type { UploadedActivity, ProjectData } from './project-data-store';

// ---- Projects ----

export async function getProjectsFromSupabase(): Promise<ManagedProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    location: row.location,
    status: row.status as 'active' | 'completed' | 'on_hold',
    totalFloors: row.total_floors,
    totalFlats: row.total_flats,
    createdAt: row.created_at,
    hasTemplate: row.has_template,
  }));
}

export async function getProjectFromSupabase(id: string): Promise<ManagedProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;

  return {
    id: data.id,
    name: data.name,
    location: data.location,
    status: data.status as 'active' | 'completed' | 'on_hold',
    totalFloors: data.total_floors,
    totalFlats: data.total_flats,
    createdAt: data.created_at,
    hasTemplate: data.has_template,
  };
}

export async function saveProjectToSupabase(project: ManagedProject, createdBy?: string): Promise<string> {
  const isNew = project.id.startsWith('proj_');
  const row: Record<string, unknown> = {
    name: project.name,
    location: project.location,
    status: project.status,
    total_floors: project.totalFloors,
    total_flats: project.totalFlats,
    has_template: project.hasTemplate,
  };

  if (isNew) {
    if (createdBy) row.created_by = createdBy;
    const { data, error } = await supabase
      .from('projects')
      .insert(row)
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } else {
    const { error } = await supabase
      .from('projects')
      .update(row)
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

export async function getActivitiesFromSupabase(projectId: string): Promise<UploadedActivity[]> {
  const PAGE = 1000;
  const allRows: Record<string, unknown>[] = [];
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

  return allRows.map(row => ({
    id: row.id as string,
    series: (row.series as string) || '',
    floor: row.floor as number,
    flat_number: row.flat_number as number,
    configuration: (row.configuration as string) || '',
    stage: row.stage as string,
    stage_gate: (row.stage_gate as string) || '',
    activity: row.activity as string,
    vendor: (row.vendor as string) || '',
    applicable: (row.applicable as boolean) ?? true,
    expected_start: (row.expected_start as string) || '',
    expected_end: (row.expected_end as string) || '',
    actual_start: (row.actual_start as string) || '',
    actual_end: (row.actual_end as string) || '',
    status: (row.status as string) || 'not_started',
    delay_days: (row.delay_days as number) || 0,
    delay_reason: (row.delay_reason as string) || '',
    remarks: (row.remarks as string) || '',
    rooms: (row.rooms as Record<string, string>) || {},
    sort_order: (row.sort_order as number) || 0,
    sub_stage_status: (row.sub_stage_status as string) || '',
    flat_status: (row.flat_status as string) || '',
    floor_status: (row.floor_status as string) || '',
    risk_status: (row.risk_status as string) || '',
    revised_start: (row.revised_start as string) || '',
    revised_end: (row.revised_end as string) || '',
  }));
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
  const row: Record<string, unknown> = {};
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
}>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'supervisor')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
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
