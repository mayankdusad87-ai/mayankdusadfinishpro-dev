import { supabase } from '@/lib/supabase';
import type { AuditLogRow as AuditLogDbRow } from '@/types/database.types';
import { STATUS_RANK } from '@/lib/constants';

export type AuditLogRow = AuditLogDbRow & {
  changed_by_name?: string;
  changed_by_role?: string;
  project_name?: string;
};

// ---- Supervisor Activity ----

export interface SupervisorPulse {
  id: string;
  name: string;
  floors: number[];
  updatesThisWeek: number;
  lastUpdateAt: string | null;
  status: 'active' | 'slow' | 'inactive';
}

// ---- Reversals ----

export interface RecentReversal {
  floor: number;
  flatNumber: number;
  stage: string;
  activityName: string;
  oldStatus: string;
  newStatus: string;
  changedByName: string;
  createdAt: string;
}

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

// ---- Supervisor Activity for Operations Dashboard ----

export async function getSupervisorActivity(projectId: string): Promise<SupervisorPulse[]> {
  // 1. Get all supervisors assigned to this project
  const { data: assignments, error: assignErr } = await supabase
    .from('supervisor_assignments')
    .select('supervisor_id, assigned_floors')
    .eq('project_id', projectId);

  if (assignErr || !assignments || assignments.length === 0) return [];

  const supervisorIds = assignments.map(a => a.supervisor_id).filter(Boolean) as string[];
  if (supervisorIds.length === 0) return [];

  // 2+3. Fetch profiles and audit_log IN PARALLEL (both need supervisorIds only)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  const [{ data: profiles }, { data: auditRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, is_active')
      .in('id', supervisorIds),
    supabase
      .from('audit_log')
      .select('changed_by, created_at')
      .eq('project_id', projectId)
      .in('changed_by', supervisorIds)
      .gte('created_at', sevenDaysAgoISO)
      .neq('stage', 'auth')
      .order('created_at', { ascending: false }),
  ]);

  const profileMap = new Map(
    (profiles || []).map(p => [p.id, { name: p.full_name, isActive: p.is_active ?? true }])
  );

  // Count updates per supervisor and find last update
  const updateCounts = new Map<string, { count: number; lastAt: string | null }>();
  for (const row of auditRows || []) {
    if (!row.changed_by) continue;
    const entry = updateCounts.get(row.changed_by) || { count: 0, lastAt: null };
    entry.count++;
    if (!entry.lastAt || (row.created_at && row.created_at > entry.lastAt)) {
      entry.lastAt = row.created_at;
    }
    updateCounts.set(row.changed_by, entry);
  }

  // 4. Build result — include all assigned supervisors, even those with 0 updates
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoISO = threeDaysAgo.toISOString();

  const results: SupervisorPulse[] = [];
  for (const a of assignments) {
    const sid = a.supervisor_id as string;
    if (!sid) continue;
    const profile = profileMap.get(sid);
    if (!profile) continue;

    const stats = updateCounts.get(sid) || { count: 0, lastAt: null };
    let status: SupervisorPulse['status'];
    if (stats.count === 0 || !stats.lastAt || stats.lastAt < threeDaysAgoISO) {
      status = 'inactive';
    } else if (stats.count < 20) {
      status = 'slow';
    } else {
      status = 'active';
    }

    results.push({
      id: sid,
      name: profile.name,
      floors: (a.assigned_floors as number[]) || [],
      updatesThisWeek: stats.count,
      lastUpdateAt: stats.lastAt,
      status,
    });
  }

  // Sort: inactive first, then slow, then active
  const statusOrder = { inactive: 0, slow: 1, active: 2 };
  results.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return results;
}

// ---- Recent Reversals (status demotions) for Operations Dashboard ----

export async function getRecentReversals(projectId: string): Promise<RecentReversal[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  const { data: rows, error } = await supabase
    .from('audit_log')
    .select('floor, flat_number, stage, activity_name, old_status, new_status, changed_by, created_at')
    .eq('project_id', projectId)
    .gte('created_at', sevenDaysAgoISO)
    .neq('stage', 'auth')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !rows) return [];

  // Filter to actual reversals using status rank
  const reversals = rows.filter(r => {
    if (!r.old_status || !r.new_status) return false;
    const oldRank = STATUS_RANK[r.old_status] ?? 0;
    const newRank = STATUS_RANK[r.new_status] ?? 0;
    if (oldRank === -1 || newRank === -1) return false; // ignore on_hold transitions
    return oldRank > newRank;
  });

  if (reversals.length === 0) return [];

  // Get names for changed_by
  const userIds = [...new Set(reversals.map(r => r.changed_by).filter(Boolean) as string[])];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
  }

  return reversals.map(r => ({
    floor: r.floor ?? 0,
    flatNumber: r.flat_number ?? 0,
    stage: r.stage || '',
    activityName: r.activity_name || '',
    oldStatus: r.old_status || '',
    newStatus: r.new_status || '',
    changedByName: r.changed_by ? (nameMap[r.changed_by] || 'Unknown') : 'System',
    createdAt: r.created_at || '',
  }));
}

// ---- Site Activity Feed for Operations Dashboard ----

export interface SiteActivityEntry {
  floor: number;
  flatNumber: number;
  stage: string;
  activityName: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  createdAt: string;
}

/**
 * Fetch all status-change audit entries for the last 30 days.
 * Client-side code filters by today/week/month tabs.
 */
export async function getSiteActivity(projectId: string): Promise<SiteActivityEntry[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceISO = thirtyDaysAgo.toISOString();

  const { data: rows, error } = await supabase
    .from('audit_log')
    .select('floor, flat_number, stage, activity_name, old_status, new_status, changed_by, created_at')
    .eq('project_id', projectId)
    .gte('created_at', sinceISO)
    .neq('stage', 'auth')
    .not('old_status', 'is', null)
    .not('new_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error || !rows) return [];

  // Get names
  const userIds = [...new Set(rows.map(r => r.changed_by).filter(Boolean) as string[])];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
  }

  return rows.map(r => ({
    floor: r.floor ?? 0,
    flatNumber: r.flat_number ?? 0,
    stage: r.stage || '',
    activityName: r.activity_name || '',
    oldStatus: r.old_status || '',
    newStatus: r.new_status || '',
    changedBy: r.changed_by ? (nameMap[r.changed_by] || 'Unknown') : 'System',
    createdAt: r.created_at || '',
  }));
}
