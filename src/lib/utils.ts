import type { ActivityStatus } from '@/lib/types';
import { STATUS_RANK } from '@/lib/constants';

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d: string | null): string {
  if (!d) return '';
  return d.slice(0, 10);
}

export function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return { date, time };
}

/**
 * Collapse delayed variants to their base status.
 * Used by admin views where the StatusPill shows base color.
 */
export function normalizeToBaseStatus(raw: string): ActivityStatus {
  if (raw === 'in_progress' || raw === 'in_progress_delayed') return 'in_progress';
  if (raw === 'completed' || raw === 'completed_delayed') return 'completed';
  if (raw === 'delayed') return 'delayed';
  if (raw === 'on_hold') return 'on_hold';
  return 'not_started';
}

/**
 * Reveal delay status for supervisor views.
 * in_progress_delayed → delayed, completed_delayed → completed.
 */
export function normalizeToDisplayStatus(raw: string): ActivityStatus {
  if (raw === 'in_progress_delayed') return 'delayed';
  if (raw === 'completed_delayed') return 'completed';
  if (raw === 'not_started' || raw === 'in_progress' || raw === 'completed' || raw === 'delayed' || raw === 'on_hold') return raw;
  return 'not_started';
}

export function resolveStatus(userStatus: string, expectedEnd: string | null): string {
  if (!expectedEnd) return userStatus;
  const overdue = expectedEnd < todayISO();
  if (userStatus === 'in_progress' && overdue) return 'in_progress_delayed';
  if (userStatus === 'not_started' && overdue) return 'delayed';
  if (userStatus === 'completed' && overdue) return 'completed_delayed';
  return userStatus;
}

/**
 * Should the delay/non-start reason field be visible?
 * True for on_hold, and any non-completed overdue activity (in_progress or not_started).
 */
export function isDelayReasonVisible(userStatus: string, expectedEnd: string | null): boolean {
  if (userStatus === 'on_hold') return true;
  if (userStatus === 'completed') return false;
  if (!expectedEnd) return false;
  return expectedEnd < todayISO();
}

/**
 * Is the delay reason mandatory (blocks save)?
 * True for on_hold and in_progress+overdue. NOT required for not_started+overdue (optional).
 */
export function isDelayReasonRequired(userStatus: string, expectedEnd: string | null): boolean {
  if (userStatus === 'on_hold') return true;
  if (userStatus === 'completed' || userStatus === 'not_started') return false;
  if (!expectedEnd) return false;
  return expectedEnd < todayISO();
}

export function daysOverdue(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date(todayISO());
  return Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
}

export function isStatusReversal(oldStatus: string, newStatus: string): boolean {
  const oldRank = STATUS_RANK[oldStatus] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;
  if (oldRank === -1 || newRank === -1) return false;
  return oldRank > newRank;
}
