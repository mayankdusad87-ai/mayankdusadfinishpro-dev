import type { ActivityStatus } from '@/lib/types';

// ---- Activity status values stored in DB ----

export const ACTIVITY_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  IN_PROGRESS_DELAYED: 'in_progress_delayed',
  COMPLETED: 'completed',
  COMPLETED_DELAYED: 'completed_delayed',
  DELAYED: 'delayed',
  ON_HOLD: 'on_hold',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_progress_delayed: 'In Progress (Delayed)',
  completed: 'Completed',
  completed_delayed: 'Completed (Delayed)',
  delayed: 'Delayed',
  on_hold: 'On Hold',
};

// ---- Status option arrays for dropdowns ----

export const ADMIN_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

export const FILTER_STATUS_OPTIONS: { value: ActivityStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

// ---- Status display config (supervisor cards) ----

export const STATUS_DISPLAY: Record<ActivityStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'NOT STARTED', bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'COMPLETED', bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { label: 'DELAYED', bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { label: 'ON HOLD', bg: 'bg-orange-100', text: 'text-orange-700' },
};

// ---- Project status display config ----

export const PROJECT_STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: 'Completed', bg: 'bg-blue-100', text: 'text-blue-700' },
  on_hold: { label: 'On Hold', bg: 'bg-orange-100', text: 'text-orange-700' },
};

// ---- Status progression rank (for reversal detection) ----

export const STATUS_RANK: Record<string, number> = {
  not_started: 0,
  delayed: 0,
  in_progress: 1,
  in_progress_delayed: 1,
  completed: 2,
  completed_delayed: 2,
  on_hold: -1,
};

// ---- Stage weights for weighted progress (must sum to 100) ----
// Adjust these values per project to reflect relative effort/importance of each finishing stage.

export const STAGE_WEIGHTS: Record<string, number> = {
  'Pre-Tiling': 8,
  'Tiling': 25,
  'Post Tiling': 8,
  'Pre Paint Activities': 12,
  '1st coat paint': 15,
  'Post First Coat Paint': 7,
  'Second Coat Paint': 12,
  'Post Second Coat Paint': 8,
  'Lobby Flooring': 5,
};

// Days to paint one flat (used for 1st coat paint projection)
export const PAINT_DAYS_PER_FLAT = 5;

// ---- Pagination ----

export const DEFAULT_PAGE_SIZE = 25;

// ---- Photo upload limits ----

export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTOS_PER_ACTIVITY = 3;
export const PHOTO_BUCKET = 'activity-photos';

export const IMAGE_SIGNATURES: Array<{ bytes: number[]; type: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' },
];
