import { supabase } from '@/lib/supabase';
import type { ActivityRow, ActivityUpdate } from '@/types/database.types';
import {
  validateStatusChange,
  computeStatusUpdate,
  computeSupervisorUpdate,
  computeBulkUpdate,
  validateSupervisorSave,
} from '@/lib/engine/activity-engine';
import type { StatusChangeResult, ValidationError } from '@/lib/engine/activity-engine';
import {
  updateActivityWithAudit,
  bulkUpdateActivities,
  getPhotoCount,
} from '@/repositories/activity-repo';
import { friendlyError } from '@/repositories/errors';
import { normalizeToDisplayStatus } from '@/lib/utils';

export type { StatusChangeResult, ValidationError };

async function getCurrentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || '';
}

async function sendReversalNotification(
  projectName: string,
  row: { floor: number; flat_number: number; activity: string; stage: string; stage_gate: string | null },
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    // Uses /api/notify-reversal (not /api/admin/) so supervisors can reach it
    await fetch('/api/notify-reversal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName,
        floor: row.floor,
        flatNumber: row.flat_number,
        activity: row.activity,
        stage: row.stage,
        stageGate: row.stage_gate,
        oldStatus,
        newStatus,
      }),
    });
  } catch {
    // best-effort
  }
}

export interface StatusUpdateResult {
  error: string | null;
  resolvedStatus?: string;
  updates?: ActivityUpdate;
  isReversal?: boolean;
}

export async function updateActivityStatus(
  row: ActivityRow,
  newUserStatus: string,
  projectId: string,
  projectName: string,
): Promise<StatusUpdateResult> {
  const photoCount = newUserStatus === 'completed' ? await getPhotoCount(row.id) : 1;

  const validation = validateStatusChange({
    userStatus: newUserStatus,
    oldStatus: row.status || 'not_started',
    expectedEnd: row.expected_end,
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    photoCount,
    delayReason: row.delay_reason || '',
  });

  if (validation) {
    return { error: validation.message };
  }

  const change = computeStatusUpdate({
    userStatus: newUserStatus,
    oldStatus: row.status || 'not_started',
    expectedEnd: row.expected_end,
    actualStart: row.actual_start,
    actualEnd: row.actual_end,
    photoCount,
    delayReason: row.delay_reason || '',
  });

  const userId = await getCurrentUserId();

  const result = await updateActivityWithAudit(row.id, change.updates, {
    projectId,
    changedBy: userId,
    oldStatus: row.status || 'not_started',
    newStatus: change.resolvedStatus,
    floor: row.floor,
    flatNumber: row.flat_number,
    stage: row.stage,
    stageGate: row.stage_gate || '',
    activityName: row.activity,
  });

  if (result.error) {
    return { error: result.error };
  }

  if (change.isReversal) {
    sendReversalNotification(projectName, row, row.status || 'not_started', change.resolvedStatus);
  }

  return {
    error: null,
    resolvedStatus: change.resolvedStatus,
    updates: change.updates,
    isReversal: change.isReversal,
  };
}

export async function updateActivityField(
  activityId: string,
  field: string,
  value: string,
): Promise<{ error: string | null }> {
  const updates = { [field]: value } as ActivityUpdate;
  const { error } = await supabase.from('activities').update(updates).eq('id', activityId);
  if (error) {
    return { error: friendlyError(error.message, 'update activity field') };
  }
  return { error: null };
}

export interface SupervisorSaveInput {
  activityId: string;
  status: string;
  expectedEnd: string | null;
  oldStatus: string;
  actualStart: string;
  actualEnd: string;
  delayReason: string;
  delayReasonIsOther: boolean;
  remarks: string;
  photoCount: number;
  projectId: string;
  projectName: string;
  userId: string;
  floor: number;
  flatNumber: number;
  stage: string;
  stageGate: string;
  activityName: string;
}

export async function saveActivityDetail(input: SupervisorSaveInput): Promise<StatusUpdateResult> {
  const today = new Date().toISOString().slice(0, 10);

  const validation = validateSupervisorSave({
    status: input.status,
    actualStart: input.actualStart,
    actualEnd: input.actualEnd,
    expectedEnd: input.expectedEnd,
    delayReason: input.delayReason,
    delayReasonIsOther: input.delayReasonIsOther,
    remarks: input.remarks,
    photoCount: input.photoCount,
    today,
  });

  if (validation) {
    return { error: validation.message };
  }

  const change = computeSupervisorUpdate({
    status: input.status,
    expectedEnd: input.expectedEnd,
    oldStatus: input.oldStatus,
    actualStart: input.actualStart,
    actualEnd: input.actualEnd,
    delayReason: input.delayReason,
    delayReasonIsOther: input.delayReasonIsOther,
    remarks: input.remarks,
  });

  const result = await updateActivityWithAudit(input.activityId, change.updates, {
    projectId: input.projectId,
    changedBy: input.userId,
    oldStatus: change.statusChanged ? input.oldStatus : undefined,
    newStatus: change.statusChanged ? change.resolvedStatus : undefined,
    floor: input.floor,
    flatNumber: input.flatNumber,
    stage: input.stage,
    stageGate: input.stageGate,
    activityName: input.activityName,
  });

  if (result.error) {
    return { error: result.error };
  }

  if (change.isReversal) {
    sendReversalNotification(
      input.projectName,
      { floor: input.floor, flat_number: input.flatNumber, activity: input.activityName, stage: input.stage, stage_gate: input.stageGate },
      input.oldStatus,
      change.resolvedStatus,
    );
  }

  return {
    error: null,
    resolvedStatus: change.resolvedStatus,
    updates: change.updates,
    isReversal: change.isReversal,
  };
}

export async function bulkUpdateStatus(
  activityIds: string[],
  allActivities: Array<{ id: string; status: string; actual_start: string | null; floor: number; flat_number: number; stage: string; stage_gate: string; activity: string }>,
  newStatus: 'in_progress' | 'completed',
  projectId: string,
  userId: string,
): Promise<{ error: string | null; skippedNoPhoto?: number }> {
  let skippedNoPhoto = 0;

  for (const id of activityIds) {
    const row = allActivities.find(r => r.id === id);
    if (!row || normalizeToDisplayStatus(row.status) === 'completed') continue;

    // For bulk complete: skip activities that have no photos
    if (newStatus === 'completed') {
      const photoCount = await getPhotoCount(id);
      if (photoCount === 0) {
        skippedNoPhoto++;
        continue;
      }
    }

    const updates = computeBulkUpdate(row.status, row.actual_start, newStatus);

    await updateActivityWithAudit(id, updates, {
      projectId,
      changedBy: userId,
      oldStatus: row.status,
      newStatus,
      floor: row.floor,
      flatNumber: row.flat_number,
      stage: row.stage,
      stageGate: row.stage_gate,
      activityName: row.activity,
    });
  }
  return { error: null, skippedNoPhoto };
}

export async function bulkUpdateField(
  activityIds: string[],
  updates: ActivityUpdate,
): Promise<{ error: string | null }> {
  return bulkUpdateActivities(activityIds, updates);
}
