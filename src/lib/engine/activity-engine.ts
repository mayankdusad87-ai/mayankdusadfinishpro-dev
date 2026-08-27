import type { ActivityUpdate } from '@/types/database.types';
import { resolveStatus, isStatusReversal, isDelayReasonRequired, todayISO } from '@/lib/utils';

export interface StatusChangeInput {
  userStatus: string;
  oldStatus: string;
  expectedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  photoCount: number;
  delayReason: string;
}

export interface StatusChangeResult {
  resolvedStatus: string;
  updates: ActivityUpdate;
  isReversal: boolean;
  statusChanged: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateStatusChange(input: StatusChangeInput): ValidationError | null {
  if (isDelayReasonRequired(input.userStatus, input.expectedEnd) && !input.delayReason) {
    return { field: 'delay_reason', message: 'Delay reason is required for overdue activities.' };
  }
  if (input.userStatus === 'completed' && input.photoCount === 0) {
    return { field: 'photos', message: 'At least one photo is required before marking as completed.' };
  }
  return null;
}

export function validateSupervisorSave(input: {
  status: string;
  actualStart: string;
  actualEnd: string;
  expectedEnd: string | null;
  delayReason: string;
  delayReasonIsOther: boolean;
  remarks: string;
  photoCount: number;
  today: string;
  backdateCutoff?: string; // ISO date — earliest allowed date for actual dates
}): ValidationError | null {
  if (input.actualStart && input.actualStart > input.today) {
    return { field: 'actual_start', message: 'Actual start date cannot be a future date.' };
  }
  if (input.actualEnd && input.actualEnd > input.today) {
    return { field: 'actual_end', message: 'Actual end date cannot be a future date.' };
  }
  if (input.backdateCutoff) {
    if (input.actualStart && input.actualStart < input.backdateCutoff) {
      return { field: 'actual_start', message: `Actual start date cannot be earlier than ${input.backdateCutoff}. Contact your admin to extend the back-date window.` };
    }
    if (input.actualEnd && input.actualEnd < input.backdateCutoff) {
      return { field: 'actual_end', message: `Actual end date cannot be earlier than ${input.backdateCutoff}. Contact your admin to extend the back-date window.` };
    }
  }
  if (input.actualEnd && input.actualStart && input.actualEnd < input.actualStart) {
    return { field: 'actual_end', message: 'Actual end date cannot be earlier than actual start date.' };
  }
  if (isDelayReasonRequired(input.status, input.expectedEnd) && !input.delayReason) {
    const label = input.status === 'on_hold' ? 'On Hold' : 'overdue';
    return { field: 'delay_reason', message: `Delay reason is mandatory for ${label} activities.` };
  }
  if (input.delayReasonIsOther && !input.remarks.trim()) {
    return { field: 'remarks', message: 'Please provide remarks when selecting "Other" as reason.' };
  }
  if (input.status === 'completed' && input.photoCount === 0) {
    return { field: 'photos', message: 'At least one photo is required before marking as completed.' };
  }
  return null;
}

export function computeStatusUpdate(input: StatusChangeInput): StatusChangeResult {
  const today = todayISO();
  const resolved = resolveStatus(input.userStatus, input.expectedEnd);

  const updates: ActivityUpdate = { status: resolved };

  // Only clear dates/reason on actual reversals (e.g. in_progress → not_started)
  const isReversalToNotStarted = input.userStatus === 'not_started' &&
    input.oldStatus !== 'not_started' && input.oldStatus !== 'delayed';

  if (isReversalToNotStarted) {
    updates.actual_start = null;
    updates.actual_end = null;
    updates.delay_reason = null;
  } else if (input.userStatus === 'completed') {
    if (!input.actualEnd) updates.actual_end = today;
    if (!input.actualStart) updates.actual_start = today;
  } else if (input.userStatus === 'in_progress' && !input.actualStart) {
    updates.actual_start = today;
  }

  return {
    resolvedStatus: resolved,
    updates,
    isReversal: isStatusReversal(input.oldStatus, resolved),
    statusChanged: input.oldStatus !== resolved,
  };
}

export function computeSupervisorUpdate(input: {
  status: string;
  expectedEnd: string | null;
  oldStatus: string;
  actualStart: string;
  actualEnd: string;
  delayReason: string;
  delayReasonIsOther: boolean;
  remarks: string;
}): StatusChangeResult {
  const today = todayISO();
  const resolved = resolveStatus(input.status, input.expectedEnd);

  let actualStart = input.actualStart;
  let actualEnd = input.actualEnd;

  // Only clear dates/reason on actual reversals (e.g. in_progress → not_started),
  // NOT when the status was already not_started (user just adding delay reason).
  const isReversalToNotStarted = input.status === 'not_started' &&
    input.oldStatus !== 'not_started' && input.oldStatus !== 'delayed';

  if (isReversalToNotStarted) {
    actualStart = '';
    actualEnd = '';
  } else if (input.status === 'completed') {
    if (!actualStart) actualStart = today;
    if (!actualEnd) actualEnd = today;
  }

  const reasonValue = input.delayReasonIsOther ? input.remarks.trim() : input.delayReason;

  const updates: ActivityUpdate = {
    status: resolved,
    actual_start: actualStart || null,
    actual_end: actualEnd || null,
    delay_reason: isReversalToNotStarted ? null : (reasonValue || null),
    remarks: isReversalToNotStarted ? '' : (input.delayReasonIsOther ? input.remarks.trim() : ''),
  };

  return {
    resolvedStatus: resolved,
    updates,
    isReversal: isStatusReversal(input.oldStatus, resolved),
    statusChanged: input.oldStatus !== resolved,
  };
}

export function computeBulkUpdate(
  currentStatus: string,
  currentActualStart: string | null,
  newStatus: 'in_progress' | 'completed' | 'on_hold',
  delayReason?: string,
): ActivityUpdate {
  const today = todayISO();
  const updates: ActivityUpdate = { status: newStatus };

  if (newStatus === 'in_progress') {
    updates.actual_start = today;
  } else if (newStatus === 'on_hold') {
    updates.delay_reason = delayReason || null;
  } else {
    updates.actual_end = today;
    if (!currentActualStart) updates.actual_start = today;
  }

  return updates;
}
