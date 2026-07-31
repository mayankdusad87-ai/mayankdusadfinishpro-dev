import { UploadedActivity } from '@/lib/project-data-store';
import type { ActivityStatus } from '@/lib/types';
import { STATUS_DISPLAY, ADMIN_STATUS_OPTIONS, FILTER_STATUS_OPTIONS } from '@/lib/constants';
import {
  todayISO,
  normalizeToDisplayStatus,
  resolveStatus as _resolveStatus,
  isDelayReasonRequired as _isDelayReasonRequired,
  daysOverdue as _daysOverdue,
} from '@/lib/utils';

export const TODAY = todayISO();

export type SupervisorStatus = ActivityStatus;

export type PriorityView = 'floor' | 'all' | 'overdue' | 'due_today' | 'starting_today';

export const STATUS_CONFIG = STATUS_DISPLAY;

export const SUPERVISOR_STATUS_OPTIONS = ADMIN_STATUS_OPTIONS;

export const STATUS_OPTIONS = FILTER_STATUS_OPTIONS;

export const resolveStatus = _resolveStatus;

export const isDelayReasonRequired = _isDelayReasonRequired;

export function normalizeStatus(raw: string): SupervisorStatus {
  return normalizeToDisplayStatus(raw);
}

export const daysOverdue = _daysOverdue;

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function matchesSearch(r: UploadedActivity, q: string): boolean {
  return (
    String(r.flat_number).includes(q) ||
    String(r.floor).includes(q) ||
    r.stage.toLowerCase().includes(q) ||
    r.stage_gate.toLowerCase().includes(q) ||
    r.activity.toLowerCase().includes(q) ||
    r.vendor.toLowerCase().includes(q) ||
    normalizeStatus(r.status).replace('_', ' ').includes(q)
  );
}
