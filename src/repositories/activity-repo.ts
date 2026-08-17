import { supabase } from '@/lib/supabase';
import type { UploadedActivity } from '@/lib/project-data-store';
import type { ActivityRow, ActivityUpdate } from '@/types/database.types';
import { friendlyError } from './errors';

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
  await supabase.from('activities').delete().eq('project_id', projectId);

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

export interface ActivitiesPage {
  rows: ActivityRow[];
  totalCount: number;
}

export async function getActivitiesPage(
  projectId: string,
  filters: { floor?: string; flat?: string; stage?: string; stageGate?: string; vendor?: string; status?: string; search?: string },
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
  if (filters.flat) {
    const flatNum = parseInt(filters.flat.replace('Flat ', ''), 10);
    if (!isNaN(flatNum)) query = query.eq('flat_number', flatNum);
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

  // Global text search — matches flat_number, floor, stage, or stage_gate
  if (filters.search) {
    const term = filters.search.trim();
    const num = parseInt(term, 10);
    const orClauses: string[] = [
      `stage.ilike.%${term}%`,
      `stage_gate.ilike.%${term}%`,
    ];
    if (!isNaN(num)) {
      orClauses.push(`flat_number.eq.${num}`);
      orClauses.push(`floor.eq.${num}`);
    }
    query = query.or(orClauses.join(','));
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

export async function getAdminEmails(): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin');
  if (!data) return [];
  return data.map(r => r.email).filter((e): e is string => Boolean(e));
}

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

export interface InsightRow {
  floor: number;
  flat_number: number;
  stage: string;
  stage_gate: string;
  activity: string;
  status: string;
  expected_start: string;
  expected_end: string;
  actual_start: string;
  actual_end: string;
  vendor: string;
  delay_reason: string;
}

export async function getInsightActivities(projectId: string): Promise<InsightRow[]> {
  const all: InsightRow[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('activities')
      .select('floor, flat_number, stage, stage_gate, activity, status, expected_start, expected_end, actual_start, actual_end, vendor, delay_reason')
      .eq('project_id', projectId)
      .neq('status', 'not_applicable')
      .range(from, from + PAGE - 1);
    if (error) { console.error('[getInsightActivities] query error:', error.message, error.code); break; }
    if (!data || data.length === 0) break;
    all.push(...(data as InsightRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
