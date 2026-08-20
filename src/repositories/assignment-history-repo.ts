import { supabase } from '@/lib/supabase';

export interface AssignmentHistoryEntry {
  id: string;
  supervisor_id: string;
  project_id: string | null;
  assigned_floors: number[] | null;
  previous_floors: number[] | null;
  action: 'assigned' | 'updated' | 'unassigned';
  performed_by: string | null;
  performed_by_name: string;
  project_name: string;
  created_at: string;
}

/** Raw row shape returned by the history table query. */
interface HistoryRow {
  id: string;
  supervisor_id: string;
  project_id: string | null;
  assigned_floors: number[] | null;
  previous_floors: number[] | null;
  action: string;
  performed_by: string | null;
  created_at: string;
}

/**
 * Fetch assignment history for a given supervisor, project, or both.
 * Results are enriched with performer names and project names.
 *
 * The table is created via SQL migration (not yet in generated DB types),
 * so we use rpc-style access with explicit typing.
 */
export async function getAssignmentHistory(opts: {
  supervisorId?: string;
  projectId?: string;
  limit?: number;
}): Promise<AssignmentHistoryEntry[]> {
  const { supervisorId, projectId, limit = 50 } = opts;

  // Build query using the untyped .from() overload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('supervisor_assignment_history')
    .select('id, supervisor_id, project_id, assigned_floors, previous_floors, action, performed_by, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (supervisorId) query = query.eq('supervisor_id', supervisorId);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  const rows = (data || []) as HistoryRow[];
  if (error || rows.length === 0) return [];

  // Batch-fetch performer names
  const performerIds = [...new Set(rows.map(r => r.performed_by).filter(Boolean) as string[])];
  let performerMap: Record<string, string> = {};
  if (performerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', performerIds);
    performerMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
  }

  // Batch-fetch project names
  const pIds = [...new Set(rows.map(r => r.project_id).filter(Boolean) as string[])];
  let projectMap: Record<string, string> = {};
  if (pIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, location')
      .in('id', pIds);
    projectMap = Object.fromEntries(
      (projects || []).map(p => [p.id, `${p.name} — ${p.location}`]),
    );
  }

  return rows.map(r => ({
    id: r.id,
    supervisor_id: r.supervisor_id,
    project_id: r.project_id,
    assigned_floors: r.assigned_floors,
    previous_floors: r.previous_floors,
    action: r.action as AssignmentHistoryEntry['action'],
    performed_by: r.performed_by,
    performed_by_name: r.performed_by ? (performerMap[r.performed_by] || 'Unknown') : 'System',
    project_name: r.project_id ? (projectMap[r.project_id] || 'Deleted project') : '-',
    created_at: r.created_at,
  }));
}
