import { supabase } from '@/lib/supabase';

// ---- Types ----

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  stage: string;
  stageGate: string | null;
  floorFrom: number;
  floorTo: number;
  targetDate: string;
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
}

export interface MilestoneProgress extends Milestone {
  totalFlats: number;
  completedFlats: number;
  progressPercent: number;
  spi: number | null; // null when not started or target date not yet meaningful
  status: 'completed' | 'on_track' | 'at_risk' | 'critical' | 'not_started';
  daysRemaining: number; // negative = overdue
  estimatedFinish: string | null; // projected completion date based on velocity
}

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  stage: string;
  stage_gate: string | null;
  floor_from: number;
  floor_to: number;
  target_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

// ---- Queries ----

export async function getMilestones(projectId: string): Promise<Milestone[]> {
  const { data: rows, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('target_date', { ascending: true });

  if (error || !rows) return [];

  // Resolve creator names
  const userIds = [...new Set(
    (rows as MilestoneRow[]).map(r => r.created_by).filter((id): id is string => Boolean(id))
  )];

  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name]));
  }

  return (rows as MilestoneRow[]).map(r => ({
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    stage: r.stage,
    stageGate: r.stage_gate,
    floorFrom: r.floor_from,
    floorTo: r.floor_to,
    targetDate: r.target_date,
    createdBy: r.created_by,
    createdByName: r.created_by ? (nameMap[r.created_by] || 'Unknown') : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    notes: r.notes,
  }));
}

// ---- Mutations ----

export async function createMilestone(
  projectId: string,
  data: {
    title: string;
    stage: string;
    stageGate?: string;
    floorFrom: number;
    floorTo: number;
    targetDate: string;
    notes?: string;
  },
  userId: string,
): Promise<{ id?: string; error: string | null }> {
  const { data: result, error } = await supabase
    .from('project_milestones')
    .insert({
      project_id: projectId,
      title: data.title,
      stage: data.stage,
      stage_gate: data.stageGate || null,
      floor_from: data.floorFrom,
      floor_to: data.floorTo,
      target_date: data.targetDate,
      notes: data.notes || null,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  return { id: result?.id, error: null };
}

export async function updateMilestone(
  milestoneId: string,
  data: {
    title?: string;
    targetDate?: string;
    notes?: string;
  },
): Promise<{ error: string | null }> {
  const updates: {
    updated_at: string;
    title?: string;
    target_date?: string;
    notes?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.targetDate !== undefined) updates.target_date = data.targetDate;
  if (data.notes !== undefined) updates.notes = data.notes || null;

  const { error } = await supabase
    .from('project_milestones')
    .update(updates)
    .eq('id', milestoneId);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteMilestone(milestoneId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', milestoneId);

  if (error) return { error: error.message };
  return { error: null };
}
