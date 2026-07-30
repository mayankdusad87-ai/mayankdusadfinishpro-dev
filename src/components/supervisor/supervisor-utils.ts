import { UploadedActivity } from '@/lib/project-data-store';

export const TODAY = new Date().toISOString().slice(0, 10);

export type SupervisorStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';

export type PriorityView = 'floor' | 'all' | 'overdue' | 'due_today' | 'starting_today';

export const STATUS_CONFIG: Record<SupervisorStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'NOT STARTED', bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'COMPLETED', bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { label: 'DELAYED', bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { label: 'ON HOLD', bg: 'bg-orange-100', text: 'text-orange-700' },
};

// Supervisor picks from 4 options; system auto-detects delay
export const SUPERVISOR_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

// Filter dropdown still shows all statuses
export const STATUS_OPTIONS: { value: SupervisorStatus | ''; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On Hold' },
];

// Auto-detect the actual status to store in DB based on user selection + dates
export function resolveStatus(userStatus: string, expectedEnd: string | null): string {
  if (!expectedEnd) return userStatus;
  const overdue = expectedEnd < TODAY;
  if (userStatus === 'in_progress' && overdue) return 'in_progress_delayed';
  if (userStatus === 'not_started' && overdue) return 'delayed';
  if (userStatus === 'completed' && overdue) return 'completed_delayed';
  return userStatus;
}

// Delay reason is mandatory when: on_hold, OR any status when activity is overdue
export function isDelayReasonRequired(userStatus: string, expectedEnd: string | null): boolean {
  if (userStatus === 'on_hold') return true;
  if (!expectedEnd) return false;
  return expectedEnd < TODAY;
}

export function normalizeStatus(raw: string): SupervisorStatus {
  if (raw === 'in_progress_delayed') return 'delayed';
  if (raw === 'completed_delayed') return 'completed';
  if (raw === 'not_started' || raw === 'in_progress' || raw === 'completed' || raw === 'delayed' || raw === 'on_hold') return raw;
  return 'not_started';
}

export function daysOverdue(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date(TODAY);
  return Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
}

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
