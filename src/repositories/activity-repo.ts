import { supabase } from '@/lib/supabase';
import type { UploadedActivity } from '@/lib/project-data-store';
import type { ActivityRow, ActivityInsert, ActivityUpdate } from '@/types/database.types';
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

/**
 * Lightweight query for supervisor pages:
 *  - Selects only the columns supervisors actually use (skips rooms, sub_stage_status, flat_status, floor_status, risk_status, series)
 *  - Optionally filters by assigned floors server-side so Supabase returns fewer rows
 */
export async function getSupervisorActivities(
  projectId: string,
  assignedFloors?: number[] | null
): Promise<UploadedActivity[]> {
  const COLS = 'id, floor, flat_number, configuration, stage, stage_gate, activity, vendor, applicable, expected_start, expected_end, actual_start, actual_end, status, delay_days, delay_reason, remarks, sort_order, revised_start, revised_end';
  const PAGE = 1000;
  const allRows: Partial<ActivityRow>[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('activities')
      .select(COLS)
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (assignedFloors && assignedFloors.length > 0) {
      query = query.in('floor', assignedFloors);
    }

    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return allRows.map(row => activityRowToUploaded(row as ActivityRow));
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

// ---------------------------------------------------------------------------
// Smart merge for re-upload — protects supervisor work by default
// ---------------------------------------------------------------------------

export type UploadMode = 'smart_merge' | 'force_overwrite' | 'delete_all';

export interface MergeSummary {
  /** Rows in Excel that don't exist in DB — will be inserted */
  newRows: number;
  /** Rows in both, untouched by supervisor — will be updated from Excel */
  updatedRows: number;
  /** Rows in both, touched by supervisor — preserved (smart_merge only) */
  protectedRows: number;
  /** Rows in DB but not in new Excel — kept (not deleted) */
  orphanedRows: number;
  totalExcelRows: number;
  totalExistingRows: number;
  /** First N protected rows with details for the UI summary */
  protectedDetails: Array<{
    floor: number;
    flat_number: number;
    activity: string;
    stage: string;
    status: string;
    reasons: string[];
  }>;
}

/** Composite key to match activities between Excel and DB */
function activityKey(a: { floor: number; flat_number: number; stage: string; stage_gate: string | null; activity: string }): string {
  return `${a.floor}|${a.flat_number}|${a.stage}|${a.stage_gate || ''}|${a.activity}`;
}

/** Check if a DB row has been touched by a supervisor */
function isTouchedBySupvisor(
  row: ActivityRow,
  hasPhotos: boolean,
): { touched: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (row.status && row.status !== 'not_started') reasons.push(`Status: ${row.status.replace(/_/g, ' ')}`);
  if (row.actual_start) reasons.push('Has actual start date');
  if (row.actual_end) reasons.push('Has actual end date');
  if (row.remarks) reasons.push('Has remarks');
  if (row.delay_reason) reasons.push('Has delay reason');
  if (row.revised_start || row.revised_end) reasons.push('Has revised dates');
  if (hasPhotos) reasons.push('Has uploaded photos');
  return { touched: reasons.length > 0, reasons };
}

/**
 * Compute a merge summary without writing anything.
 * Call this to show the user what will happen before they confirm.
 */
export async function computeMergeSummary(
  projectId: string,
  newActivities: UploadedActivity[],
): Promise<MergeSummary> {
  // 1. Fetch all existing activities as raw rows (need ActivityRow for isTouched check)
  const existingMap = new Map<string, ActivityRow>();
  const PAGE = 1000;
  const rawRows: ActivityRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('project_id', projectId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rawRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  for (const row of rawRows) {
    existingMap.set(activityKey(row), row);
  }

  // 2. Batch-check which activity IDs have photos
  const existingIds = rawRows.map(r => r.id);
  const photosSet = new Set<string>();
  // Query in chunks of 500 to avoid URL-length issues
  for (let i = 0; i < existingIds.length; i += 500) {
    const chunk = existingIds.slice(i, i + 500);
    const { data: photoRows } = await supabase
      .from('activity_photos')
      .select('activity_id')
      .in('activity_id', chunk);
    if (photoRows) {
      for (const p of photoRows) photosSet.add(p.activity_id);
    }
  }

  // 3. Walk through new activities and classify
  let newRows = 0;
  let updatedRows = 0;
  let protectedRows = 0;
  const protectedDetails: MergeSummary['protectedDetails'] = [];
  const matchedKeys = new Set<string>();

  for (const act of newActivities) {
    const key = activityKey(act);
    const existingRow = existingMap.get(key);

    if (!existingRow) {
      newRows++;
    } else {
      matchedKeys.add(key);
      const { touched, reasons } = isTouchedBySupvisor(existingRow, photosSet.has(existingRow.id));
      if (touched) {
        protectedRows++;
        if (protectedDetails.length < 50) {
          protectedDetails.push({
            floor: existingRow.floor,
            flat_number: existingRow.flat_number,
            activity: existingRow.activity,
            stage: existingRow.stage,
            status: existingRow.status || 'not_started',
            reasons,
          });
        }
      } else {
        updatedRows++;
      }
    }
  }

  // 4. Orphaned rows (in DB but not in new Excel)
  // Build a set of all new-activity keys for O(1) lookup
  const newActivityKeys = new Set(newActivities.map(a => activityKey(a)));
  const orphanedRows = rawRows.filter(r => !newActivityKeys.has(activityKey(r))).length;

  return {
    newRows,
    updatedRows,
    protectedRows,
    orphanedRows,
    totalExcelRows: newActivities.length,
    totalExistingRows: rawRows.length,
    protectedDetails,
  };
}

/**
 * Smart merge: insert new rows, update untouched rows, protect supervisor work.
 * - smart_merge: protect touched rows, update untouched, insert new, keep orphans
 * - force_overwrite: update ALL rows from Excel (overwrite supervisor work), insert new, keep orphans
 * - delete_all: wipe everything and re-insert (original behavior)
 */
export async function mergeActivitiesToSupabase(
  projectId: string,
  newActivities: UploadedActivity[],
  mode: UploadMode,
): Promise<MergeSummary> {
  // delete_all: use the original destructive approach
  if (mode === 'delete_all') {
    await saveActivitiesToSupabase(projectId, newActivities);
    return {
      newRows: newActivities.length,
      updatedRows: 0,
      protectedRows: 0,
      orphanedRows: 0,
      totalExcelRows: newActivities.length,
      totalExistingRows: 0,
      protectedDetails: [],
    };
  }

  // 1. Fetch existing rows
  const PAGE = 1000;
  const rawRows: ActivityRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('project_id', projectId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rawRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const existingMap = new Map<string, ActivityRow>();
  for (const row of rawRows) {
    existingMap.set(activityKey(row), row);
  }

  // 2. Batch-check photos
  const existingIds = rawRows.map(r => r.id);
  const photosSet = new Set<string>();
  for (let i = 0; i < existingIds.length; i += 500) {
    const chunk = existingIds.slice(i, i + 500);
    const { data: photoRows } = await supabase
      .from('activity_photos')
      .select('activity_id')
      .in('activity_id', chunk);
    if (photoRows) {
      for (const p of photoRows) photosSet.add(p.activity_id);
    }
  }

  // 3. Classify and execute
  const toInsert: ActivityInsert[] = [];
  const toUpdate: Array<{ id: string; data: ActivityUpdate }> = [];
  let protectedCount = 0;
  const protectedDetails: MergeSummary['protectedDetails'] = [];

  for (const act of newActivities) {
    const key = activityKey(act);
    const existingRow = existingMap.get(key);

    // Template fields — safe to update even on protected rows
    const templateFields: ActivityUpdate = {
      project_id: projectId,
      series: act.series,
      floor: act.floor,
      flat_number: act.flat_number,
      configuration: act.configuration,
      stage: act.stage,
      stage_gate: act.stage_gate,
      activity: act.activity,
      vendor: act.vendor,
      applicable: act.applicable,
      expected_start: act.expected_start,
      expected_end: act.expected_end,
      sort_order: act.sort_order,
      sub_stage_status: act.sub_stage_status,
      flat_status: act.flat_status,
      floor_status: act.floor_status,
      risk_status: act.risk_status,
    };

    // Supervisor fields — only written on new/untouched/force rows
    const supervisorFields: ActivityUpdate = {
      actual_start: act.actual_start,
      actual_end: act.actual_end,
      status: act.status,
      delay_days: act.delay_days,
      delay_reason: act.delay_reason,
      remarks: act.remarks,
      rooms: act.rooms,
      revised_start: act.revised_start,
      revised_end: act.revised_end,
    };

    if (!existingRow) {
      // New row — insert with all fields
      const insertRow: ActivityInsert = {
        project_id: projectId,
        floor: act.floor,
        flat_number: act.flat_number,
        stage: act.stage,
        activity: act.activity,
        series: act.series,
        configuration: act.configuration,
        stage_gate: act.stage_gate,
        vendor: act.vendor,
        applicable: act.applicable,
        expected_start: act.expected_start,
        expected_end: act.expected_end,
        sort_order: act.sort_order,
        sub_stage_status: act.sub_stage_status,
        flat_status: act.flat_status,
        floor_status: act.floor_status,
        risk_status: act.risk_status,
        actual_start: act.actual_start,
        actual_end: act.actual_end,
        status: act.status,
        delay_days: act.delay_days,
        delay_reason: act.delay_reason,
        remarks: act.remarks,
        rooms: act.rooms,
        revised_start: act.revised_start,
        revised_end: act.revised_end,
      };
      toInsert.push(insertRow);
    } else {
      const { touched, reasons } = isTouchedBySupvisor(existingRow, photosSet.has(existingRow.id));

      if (touched && mode === 'smart_merge') {
        // Protected — only update template fields, preserve supervisor work
        protectedCount++;
        if (protectedDetails.length < 50) {
          protectedDetails.push({
            floor: existingRow.floor,
            flat_number: existingRow.flat_number,
            activity: existingRow.activity,
            stage: existingRow.stage,
            status: existingRow.status || 'not_started',
            reasons,
          });
        }
        toUpdate.push({ id: existingRow.id, data: templateFields });
      } else {
        // Untouched OR force_overwrite — update everything from Excel
        toUpdate.push({
          id: existingRow.id,
          data: { ...templateFields, ...supervisorFields },
        });
      }
    }
  }

  // 4. Execute inserts in chunks
  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from('activities').insert(chunk);
    if (error) throw error;
  }

  // 5. Execute updates via upsert for bulk efficiency
  // Each row includes id + all fields being updated. Upsert on id conflict
  // sends one request per 500-row chunk instead of one per row (~18x fewer requests).
  const upsertRows: ActivityInsert[] = toUpdate.map(({ id, data }) => ({
    id,
    // Required Insert fields — always present in both templateFields and supervisorFields
    activity: (data.activity ?? '') as string,
    floor: (data.floor ?? 0) as number,
    flat_number: (data.flat_number ?? 0) as number,
    project_id: projectId,
    stage: (data.stage ?? '') as string,
    // Spread remaining update fields
    ...data,
  }));
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const chunk = upsertRows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('activities')
      .upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }

  // Orphaned rows (in DB but not in Excel) are deliberately kept — no deletion
  const matchedKeys = new Set(newActivities.map(a => activityKey(a)));
  const orphanedRows = rawRows.filter(r => !matchedKeys.has(activityKey(r))).length;

  return {
    newRows: toInsert.length,
    updatedRows: toUpdate.length - protectedCount,
    protectedRows: protectedCount,
    orphanedRows,
    totalExcelRows: newActivities.length,
    totalExistingRows: rawRows.length,
    protectedDetails,
  };
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

  const statusChanged = auditInfo.oldStatus && auditInfo.newStatus && auditInfo.oldStatus !== auditInfo.newStatus;
  const delayReasonSet = updates.delay_reason !== undefined && updates.delay_reason !== null && updates.delay_reason !== '';

  if (statusChanged || delayReasonSet) {
    await supabase.from('audit_log').insert({
      activity_id: activityId,
      project_id: auditInfo.projectId,
      changed_by: auditInfo.changedBy || null,
      old_status: auditInfo.oldStatus || null,
      new_status: auditInfo.newStatus || auditInfo.oldStatus || null,
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
  const COLS = 'floor, flat_number, stage, stage_gate, activity, status, expected_start, expected_end, actual_start, actual_end, vendor, delay_reason';
  const PAGE = 1000;

  // First page + exact count in one request
  const { data: first, error, count } = await supabase
    .from('activities')
    .select(COLS, { count: 'exact' })
    .eq('project_id', projectId)
    .neq('status', 'not_applicable')
    .range(0, PAGE - 1);

  if (error) { console.error('[getInsightActivities] query error:', error.message, error.code); return []; }
  if (!first || first.length === 0) return [];

  const all: InsightRow[] = first as InsightRow[];
  const total = count ?? first.length;

  // Fetch remaining pages in parallel
  if (total > PAGE) {
    const remaining = Math.ceil((total - PAGE) / PAGE);
    const pages = await Promise.all(
      Array.from({ length: remaining }, (_, i) => {
        const start = (i + 1) * PAGE;
        return supabase
          .from('activities')
          .select(COLS)
          .eq('project_id', projectId)
          .neq('status', 'not_applicable')
          .range(start, start + PAGE - 1);
      }),
    );
    for (const pg of pages) {
      if (pg.data) all.push(...(pg.data as InsightRow[]));
    }
  }

  return all;
}
