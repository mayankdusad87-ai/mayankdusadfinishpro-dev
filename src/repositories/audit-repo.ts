import { supabase } from '@/lib/supabase';
import type { AuditLogRow as AuditLogDbRow } from '@/types/database.types';

export type AuditLogRow = AuditLogDbRow & {
  changed_by_name?: string;
  changed_by_role?: string;
  project_name?: string;
};

export async function getAuditLog(
  projectId: string,
  filters?: { startDate?: string; endDate?: string; includeAuth?: boolean }
): Promise<AuditLogRow[]> {
  // Fetch project-specific entries
  let projectQuery = supabase
    .from('audit_log')
    .select('id, activity_id, project_id, changed_by, old_status, new_status, floor, flat_number, stage, stage_gate, activity_name, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.startDate) {
    projectQuery = projectQuery.gte('created_at', `${filters.startDate}T00:00:00`);
  }
  if (filters?.endDate) {
    projectQuery = projectQuery.lte('created_at', `${filters.endDate}T23:59:59`);
  }

  const { data: projectData, error: projectError } = await projectQuery.limit(500);

  // Also fetch auth events (stage = 'auth', project_id is null)
  let authQuery = supabase
    .from('audit_log')
    .select('id, activity_id, project_id, changed_by, old_status, new_status, floor, flat_number, stage, stage_gate, activity_name, created_at')
    .eq('stage', 'auth')
    .is('project_id', null)
    .order('created_at', { ascending: false });

  if (filters?.startDate) {
    authQuery = authQuery.gte('created_at', `${filters.startDate}T00:00:00`);
  }
  if (filters?.endDate) {
    authQuery = authQuery.lte('created_at', `${filters.endDate}T23:59:59`);
  }

  const { data: authData } = await authQuery.limit(100);

  if (projectError) return [];

  // Merge and sort by created_at descending
  const rows = [...(projectData || []), ...(authData || [])];
  rows.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

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
