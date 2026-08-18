import { supabase } from '@/lib/supabase';
import type { TargetRow } from '@/lib/target-engine';

// ---- Queries ----

/**
 * Get all targets for a project, ordered by target date.
 */
export async function getTargets(projectId: string): Promise<TargetRow[]> {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('target_date', { ascending: true });

  if (error || !data) return [];
  return data as TargetRow[];
}

/**
 * Check if a duplicate target exists (same project + stage + floor range + target date month).
 * Returns true if a conflict exists.
 */
export async function checkDuplicateTarget(
  projectId: string,
  stage: string,
  floorFrom: number,
  floorTo: number,
  targetDate: string,
  excludeId?: string,
): Promise<boolean> {
  // Parse month boundaries from target date
  const d = new Date(targetDate);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];

  let query = supabase
    .from('project_milestones')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('stage', stage)
    .eq('floor_from', floorFrom)
    .eq('floor_to', floorTo)
    .gte('target_date', monthStart)
    .lte('target_date', monthEnd);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { count } = await query;
  return (count ?? 0) > 0;
}

// ---- Mutations (browser-side, used only for admin reads) ----
// Actual writes go through /api/targets route using supabaseAdmin
