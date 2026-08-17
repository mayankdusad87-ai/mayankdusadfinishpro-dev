import { supabase } from '@/lib/supabase';

// ---- Types ----

export interface UnitStore {
  id: string;
  projectId: string;
  floor: number;
  flatNumber: number;
  markedAt: string;
  unmarkedAt: string | null;
  markedByName: string;
  unmarkedByName: string | null;
  notes: string | null;
}

interface StoreRow {
  id: string;
  project_id: string;
  floor: number;
  flat_number: number;
  marked_at: string;
  unmarked_at: string | null;
  marked_by: string | null;
  unmarked_by: string | null;
  notes: string | null;
}

// ---- Queries ----

/**
 * Fetch all store records for a project (active + cleared history).
 * Active stores have unmarked_at = null.
 */
export async function getUnitStores(projectId: string): Promise<UnitStore[]> {
  const { data: rows, error } = await supabase
    .from('unit_stores')
    .select('id, project_id, floor, flat_number, marked_at, unmarked_at, marked_by, unmarked_by, notes')
    .eq('project_id', projectId)
    .order('marked_at', { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  // Resolve user names
  const userIds = [
    ...new Set(
      (rows as StoreRow[])
        .flatMap(r => [r.marked_by, r.unmarked_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
  }

  return (rows as StoreRow[]).map(r => ({
    id: r.id,
    projectId: r.project_id,
    floor: r.floor,
    flatNumber: r.flat_number,
    markedAt: r.marked_at,
    unmarkedAt: r.unmarked_at,
    markedByName: r.marked_by ? (nameMap[r.marked_by] || 'Unknown') : 'System',
    unmarkedByName: r.unmarked_by ? (nameMap[r.unmarked_by] || 'Unknown') : null,
    notes: r.notes,
  }));
}

/**
 * Get only active (currently designated) stores for a project.
 */
export async function getActiveStores(projectId: string): Promise<UnitStore[]> {
  const all = await getUnitStores(projectId);
  return all.filter(s => s.unmarkedAt === null);
}

/**
 * Check if a specific unit is currently marked as a store.
 */
export async function isUnitStore(projectId: string, floor: number, flatNumber: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('unit_stores')
    .select('id')
    .eq('project_id', projectId)
    .eq('floor', floor)
    .eq('flat_number', flatNumber)
    .is('unmarked_at', null)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

// ---- Mutations ----

/**
 * Mark a unit as a material store.
 */
export async function markAsStore(
  projectId: string,
  floor: number,
  flatNumber: number,
  userId: string,
  notes?: string,
): Promise<{ error: string | null }> {
  // Check if already active
  const alreadyStore = await isUnitStore(projectId, floor, flatNumber);
  if (alreadyStore) {
    return { error: 'This unit is already marked as a store' };
  }

  const { error } = await supabase.from('unit_stores').insert({
    project_id: projectId,
    floor,
    flat_number: flatNumber,
    marked_by: userId,
    notes: notes || null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Unmark a unit as a store (clear it).
 */
export async function unmarkStore(
  storeId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('unit_stores')
    .update({
      unmarked_at: new Date().toISOString(),
      unmarked_by: userId,
    })
    .eq('id', storeId)
    .is('unmarked_at', null);

  if (error) return { error: error.message };
  return { error: null };
}
