/**
 * Target Achievement Engine — pure functions for computing target status.
 *
 * ZERO side-effects, ZERO DB calls. Takes data in, returns status out.
 * Every edge case is handled here so the UI never needs to think.
 *
 * Status definitions:
 *  - achieved:  100% done on/before target date
 *  - delayed:   100% done but AFTER target date
 *  - missed:    target date passed, < 100% done
 *  - on_track:  target date in future, pace is healthy
 *  - at_risk:   target date in future, pace too slow to finish on time
 */

// ---- Types ----

export type TargetStatus = 'achieved' | 'delayed' | 'missed' | 'on_track' | 'at_risk';

export interface TargetRow {
  id: string;
  project_id: string;
  stage: string;
  stage_gate: string | null;
  floor_from: number;
  floor_to: number;
  target_date: string;     // ISO date, e.g. '2026-09-15'
  created_by: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  title: string;
}

/** Flat-level status counts for a target's scope */
export interface StatusBreakdown {
  notStarted: number;
  inProgress: number;
  completed: number;
  onHold: number;
}

/** Aggregated flat-level data for a single target's scope */
export interface TargetScopeData {
  totalFlats: number;          // distinct (floor, flat_number) combos
  completedFlats: number;      // flats where ALL activities are completed
  lastCompletionDate: string | null;  // latest actual_end across completed activities
  delayReasons: { reason: string; count: number }[];  // top 3 reasons
  statusBreakdown: StatusBreakdown;  // flat-level status counts
}

/** Computed result for one target */
export interface TargetAchievementResult {
  id: string;
  stage: string;
  floorFrom: number;
  floorTo: number;
  targetDate: string;
  notes: string | null;
  // Computed
  totalFlats: number;
  completedFlats: number;
  progressPct: number;         // 0-100 integer
  status: TargetStatus;
  daysRemaining: number;       // negative = overdue
  daysLate: number | null;     // only for 'delayed' status: how many days late
  delayReasons: { reason: string; count: number }[];
  statusBreakdown: StatusBreakdown;  // flat-level status counts
}

/** Summary across all targets for a project */
export interface TargetSummary {
  total: number;
  achieved: number;
  delayed: number;
  missed: number;
  onTrack: number;
  atRisk: number;
}

// ---- Core computation ----

/**
 * Compute status for a single target given its scope data.
 *
 * @param target  - The target definition (from DB)
 * @param scope   - Aggregated activity data for this target's stage+floor range
 * @param now     - Current date (injectable for testing)
 */
export function computeTargetStatus(
  target: TargetRow,
  scope: TargetScopeData,
  now: Date = new Date(),
): TargetAchievementResult {
  const today = stripTime(now);
  const targetDate = stripTime(new Date(target.target_date));
  const daysRemaining = diffDays(today, targetDate);

  const { totalFlats, completedFlats, lastCompletionDate, delayReasons, statusBreakdown } = scope;

  // Guard: no flats in scope → 0%
  const progressPct = totalFlats > 0
    ? Math.round((completedFlats / totalFlats) * 100)
    : 0;

  let status: TargetStatus;
  let daysLate: number | null = null;

  if (totalFlats === 0) {
    // No data for this scope — treat as at risk if future, missed if past
    status = daysRemaining >= 0 ? 'at_risk' : 'missed';
  } else if (completedFlats >= totalFlats) {
    // 100% complete — check if on time or late
    if (lastCompletionDate) {
      const completionDate = stripTime(new Date(lastCompletionDate));
      const diff = diffDays(targetDate, completionDate);
      if (diff <= 0) {
        // Finished on or before target date
        status = 'achieved';
      } else {
        // Finished after target date
        status = 'delayed';
        daysLate = diff;
      }
    } else {
      // All completed but no actual_end dates → assume achieved
      status = 'achieved';
    }
  } else if (daysRemaining < 0) {
    // Target date passed, not 100% complete
    status = 'missed';
  } else {
    // Target date in future, still in progress
    status = assessPace(completedFlats, totalFlats, daysRemaining, target);
  }

  return {
    id: target.id,
    stage: target.stage,
    floorFrom: target.floor_from,
    floorTo: target.floor_to,
    targetDate: target.target_date,
    notes: target.notes,
    totalFlats,
    completedFlats,
    progressPct,
    status,
    daysRemaining,
    daysLate,
    delayReasons,
    statusBreakdown,
  };
}

/**
 * Assess if pace is "on_track" or "at_risk".
 *
 * Logic:
 *  1. Compute how many days have elapsed since the target was created
 *  2. Compute velocity = completedFlats / elapsed days
 *  3. If velocity > 0: project remaining days = remainingFlats / velocity
 *  4. If projected finish is before target date → on_track, else → at_risk
 *  5. Special case: velocity is 0 but >50% time remains → on_track (just started)
 *  6. Special case: <30% time left and <50% done → at_risk
 */
function assessPace(
  completedFlats: number,
  totalFlats: number,
  daysRemaining: number,
  target: TargetRow,
): TargetStatus {
  const created = stripTime(new Date(target.created_at));
  const targetDate = stripTime(new Date(target.target_date));
  const totalDuration = Math.max(1, diffDays(created, targetDate));
  const elapsed = totalDuration - daysRemaining;

  const progressRatio = completedFlats / totalFlats;
  const timeRatio = elapsed / totalDuration;  // 0 = just started, 1 = target date

  // No progress at all
  if (completedFlats === 0) {
    // If less than 30% time passed, still okay
    if (timeRatio < 0.3) return 'on_track';
    return 'at_risk';
  }

  // Velocity-based projection
  const velocity = elapsed > 0 ? completedFlats / elapsed : 0;
  if (velocity > 0) {
    const remainingFlats = totalFlats - completedFlats;
    const daysNeeded = remainingFlats / velocity;
    // Buffer: need to finish with at least 0 days to spare
    if (daysNeeded <= daysRemaining) return 'on_track';
    return 'at_risk';
  }

  // Edge case: velocity is 0 (elapsed = 0 but some flats done — same-day creation)
  // If progress > 50%, probably on track
  if (progressRatio >= 0.5) return 'on_track';

  // Fallback: less than 50% done, can't compute velocity
  return 'at_risk';
}

/**
 * Compute summary counts across all target results.
 */
export function computeTargetSummary(results: TargetAchievementResult[]): TargetSummary {
  const summary: TargetSummary = {
    total: results.length,
    achieved: 0,
    delayed: 0,
    missed: 0,
    onTrack: 0,
    atRisk: 0,
  };

  for (const r of results) {
    switch (r.status) {
      case 'achieved': summary.achieved++; break;
      case 'delayed': summary.delayed++; break;
      case 'missed': summary.missed++; break;
      case 'on_track': summary.onTrack++; break;
      case 'at_risk': summary.atRisk++; break;
    }
  }

  return summary;
}

// ---- Flat-level aggregation from raw activity rows ----

export interface RawActivityRow {
  floor: number;
  flat_number: number;
  status: string;
  actual_end: string | null;
  delay_reason: string | null;
}

/**
 * Aggregate raw activity rows into TargetScopeData.
 *
 * A flat is "complete" when ALL its activities (for the given stage+floor range)
 * have status 'completed' or 'completed_delayed'.
 *
 * Excludes 'not_applicable' rows (they should already be filtered before calling).
 */
export function aggregateScopeData(rows: RawActivityRow[]): TargetScopeData {
  if (rows.length === 0) {
    return { totalFlats: 0, completedFlats: 0, lastCompletionDate: null, delayReasons: [], statusBreakdown: { notStarted: 0, inProgress: 0, completed: 0, onHold: 0 } };
  }

  // Group by flat key — track per-flat activity statuses
  const flatMap = new Map<string, {
    total: number;
    completed: number;
    inProgress: number;
    onHold: number;
    latestEnd: string | null;
  }>();

  for (const row of rows) {
    const key = `${row.floor}-${row.flat_number}`;
    let entry = flatMap.get(key);
    if (!entry) {
      entry = { total: 0, completed: 0, inProgress: 0, onHold: 0, latestEnd: null };
      flatMap.set(key, entry);
    }

    entry.total++;

    const s = row.status;
    if (s === 'completed' || s === 'completed_delayed') {
      entry.completed++;
      if (row.actual_end) {
        if (!entry.latestEnd || row.actual_end > entry.latestEnd) {
          entry.latestEnd = row.actual_end;
        }
      }
    } else if (s === 'in_progress') {
      entry.inProgress++;
    } else if (s === 'on_hold') {
      entry.onHold++;
    }
  }

  let totalFlats = 0;
  let completedFlats = 0;
  let lastCompletionDate: string | null = null;

  // Flat-level status breakdown
  const statusBreakdown: StatusBreakdown = { notStarted: 0, inProgress: 0, completed: 0, onHold: 0 };

  for (const entry of flatMap.values()) {
    totalFlats++;

    if (entry.completed === entry.total) {
      // ALL activities completed → flat is "completed"
      completedFlats++;
      statusBreakdown.completed++;
      if (entry.latestEnd) {
        if (!lastCompletionDate || entry.latestEnd > lastCompletionDate) {
          lastCompletionDate = entry.latestEnd;
        }
      }
    } else if (entry.onHold > 0) {
      // ANY activity on hold → flat is "on hold"
      statusBreakdown.onHold++;
    } else if (entry.inProgress > 0) {
      // ANY activity in progress → flat is "in progress"
      statusBreakdown.inProgress++;
    } else {
      // All remaining activities are not started
      statusBreakdown.notStarted++;
    }
  }

  // Top delay reasons (from incomplete activities)
  const reasonCounts = new Map<string, number>();
  for (const row of rows) {
    if (
      row.delay_reason &&
      row.delay_reason.trim() !== '' &&
      row.status !== 'completed' &&
      row.status !== 'completed_delayed'
    ) {
      const r = row.delay_reason.trim();
      reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
    }
  }

  const delayReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { totalFlats, completedFlats, lastCompletionDate, delayReasons, statusBreakdown };
}

// ---- Helpers ----

/** Strip time from a Date, return midnight copy */
function stripTime(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Positive = b is after a. Days between two dates. */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ---- Display helpers (for UI) ----

export const TARGET_STATUS_CONFIG: Record<TargetStatus, {
  label: string;
  bg: string;
  text: string;
  dot: string;
  border: string;
}> = {
  achieved: {
    label: 'Achieved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  delayed: {
    label: 'Achieved (Delayed)',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
  },
  missed: {
    label: 'Missed',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    border: 'border-red-200',
  },
  on_track: {
    label: 'On Track',
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    border: 'border-green-200',
  },
  at_risk: {
    label: 'At Risk',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    border: 'border-orange-200',
  },
};

/** Format floor range for display: "Floor 3" or "Floors 3–8" */
export function formatFloorRange(from: number, to: number): string {
  if (from === to) return `Floor ${from}`;
  return `Floors ${from}–${to}`;
}
