import type { Milestone, MilestoneProgress } from '@/repositories/milestone-repo';

interface ActivityForMilestone {
  floor: number;
  flat_number: number;
  stage: string;
  stage_gate: string | null;
  status: string;
}

/**
 * Compute SPI-based progress for a set of milestones against activity data.
 *
 * SPI (Schedule Performance Index) = Completed / Expected-by-now
 *   - SPI ≥ 0.95 → On Track
 *   - SPI 0.85–0.94 → At Risk
 *   - SPI < 0.85 → Critical
 *
 * Thresholds sourced from PMI PMBOK / construction industry standards.
 */
export function computeMilestoneProgress(
  milestones: Milestone[],
  activities: ActivityForMilestone[],
): MilestoneProgress[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return milestones.map(m => {
    // 1. Find matching activities for this milestone's scope
    const matching = activities.filter(a => {
      if (a.floor < m.floorFrom || a.floor > m.floorTo) return false;
      if (a.stage !== m.stage) return false;
      if (m.stageGate && a.stage_gate !== m.stageGate) return false;
      return true;
    });

    // Deduplicate by floor+flat (one entry per flat)
    const flatMap = new Map<string, ActivityForMilestone>();
    for (const a of matching) {
      const key = `${a.floor}-${a.flat_number}`;
      const existing = flatMap.get(key);
      // Keep the most progressed status per flat
      if (!existing || isMoreComplete(a.status, existing.status)) {
        flatMap.set(key, a);
      }
    }

    const totalFlats = flatMap.size;
    const completedFlats = [...flatMap.values()].filter(
      a => a.status === 'completed' || a.status === 'completed_delayed'
    ).length;
    const progressPercent = totalFlats > 0 ? Math.round((completedFlats / totalFlats) * 100) : 0;

    // 2. Time calculations
    const targetDate = new Date(m.targetDate);
    targetDate.setHours(0, 0, 0, 0);
    const createdDate = new Date(m.createdAt);
    createdDate.setHours(0, 0, 0, 0);

    const totalDuration = Math.max(1, diffDays(createdDate, targetDate));
    const elapsed = diffDays(createdDate, today);
    const daysRemaining = diffDays(today, targetDate);

    // 3. Compute SPI
    let spi: number | null = null;
    let estimatedFinish: string | null = null;
    let status: MilestoneProgress['status'];

    if (totalFlats === 0) {
      // No activities match this milestone scope
      status = 'not_started';
    } else if (completedFlats === totalFlats) {
      // All done
      status = 'completed';
    } else if (completedFlats === 0) {
      // Not started
      if (elapsed <= 0) {
        status = 'not_started';
      } else {
        const timeRatio = elapsed / totalDuration;
        if (timeRatio > 0.6) status = 'critical';
        else if (timeRatio > 0.3) status = 'at_risk';
        else status = 'not_started';
      }
    } else {
      // In progress — compute SPI
      const timeRatio = Math.min(elapsed / totalDuration, 1);
      const expectedByNow = timeRatio * totalFlats;
      spi = expectedByNow > 0 ? completedFlats / expectedByNow : 1;

      // Velocity-based estimated finish
      const velocity = elapsed > 0 ? completedFlats / elapsed : 0;
      const remaining = totalFlats - completedFlats;
      if (velocity > 0) {
        const daysToFinish = remaining / velocity;
        const estDate = new Date(today);
        estDate.setDate(estDate.getDate() + Math.ceil(daysToFinish));
        estimatedFinish = estDate.toISOString().split('T')[0];
      }

      // Status based on SPI thresholds (PMI standard)
      if (daysRemaining < 0 && completedFlats < totalFlats) {
        // Overdue
        status = 'critical';
      } else if (spi >= 0.95) {
        status = 'on_track';
      } else if (spi >= 0.85) {
        status = 'at_risk';
      } else {
        status = 'critical';
      }
    }

    return {
      ...m,
      totalFlats,
      completedFlats,
      progressPercent,
      spi,
      status,
      daysRemaining,
      estimatedFinish,
    };
  });
}

/** Days between two dates (positive if b > a) */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Check if status a is more complete than status b */
function isMoreComplete(a: string, b: string): boolean {
  const rank: Record<string, number> = {
    not_started: 0,
    in_progress: 1,
    in_progress_delayed: 2,
    on_hold: 1,
    completed_delayed: 3,
    completed: 4,
  };
  return (rank[a] ?? 0) > (rank[b] ?? 0);
}
