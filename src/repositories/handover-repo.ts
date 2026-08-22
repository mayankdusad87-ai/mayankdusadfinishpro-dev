import { supabase } from '@/lib/supabase';

export interface FloorHandover {
  id: string;
  project_id: string;
  floor: number;
  planned_handover: string | null;
  actual_handover: string | null;
  remarks: string | null;
}

/** Fetch all floor handover records for a project */
export async function getFloorHandovers(projectId: string): Promise<FloorHandover[]> {
  const { data, error } = await supabase
    .from('floor_handovers')
    .select('id, project_id, floor, planned_handover, actual_handover, remarks')
    .eq('project_id', projectId)
    .order('floor', { ascending: true });
  if (error) { console.error('[handover-repo] fetch error:', error); return []; }
  return (data ?? []) as FloorHandover[];
}

/** Upsert a single floor handover (insert or update) */
export async function upsertFloorHandover(
  projectId: string,
  floor: number,
  planned: string | null,
  actual: string | null,
  remarks?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('floor_handovers')
    .upsert(
      {
        project_id: projectId,
        floor,
        planned_handover: planned || null,
        actual_handover: actual || null,
        remarks: remarks ?? null,
      },
      { onConflict: 'project_id,floor' },
    );
  if (error) throw error;
}

/** Bulk upsert all floor handovers for a project */
export async function bulkUpsertFloorHandovers(
  projectId: string,
  handovers: { floor: number; planned: string | null; actual: string | null; remarks?: string | null }[],
): Promise<void> {
  if (handovers.length === 0) return;
  const rows = handovers.map(h => ({
    project_id: projectId,
    floor: h.floor,
    planned_handover: h.planned || null,
    actual_handover: h.actual || null,
    remarks: h.remarks ?? null,
  }));
  const { error } = await supabase
    .from('floor_handovers')
    .upsert(rows, { onConflict: 'project_id,floor' });
  if (error) throw error;
}
