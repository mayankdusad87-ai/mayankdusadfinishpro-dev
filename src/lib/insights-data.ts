import type { HeatmapData } from './floor-rollup';
import { todayISO, normalizeToBaseStatus } from '@/lib/utils';
import { getInsightActivities } from '@/repositories/activity-repo';
import type { InsightRow } from '@/repositories/activity-repo';
import { STAGE_WEIGHTS as DEFAULT_STAGE_WEIGHTS, PAINT_DAYS_PER_FLAT as DEFAULT_PAINT_DAYS } from '@/lib/constants';

const PIPELINE_STAGES = [
  'Pre-Tiling',
  'Tiling',
  'Post Tiling',
  'Pre Paint Activities',
  '1st coat paint',
];

// All 9 stages used for weighted progress calculation
const ALL_STAGES = [
  'Pre-Tiling',
  'Tiling',
  'Post Tiling',
  'Pre Paint Activities',
  '1st coat paint',
  'Post First Coat Paint',
  'Second Coat Paint',
  'Post Second Coat Paint',
  'Lobby Flooring',
];

// ---- Delay reason mapping: granular → high-level ----

const DELAY_CATEGORY: Record<string, string> = {
  'Material Not Available': 'Material & Procurement',
  'Material Procurement Delay': 'Material & Procurement',
  'Labour Shortage': 'Manpower',
  'Wrong Measurement': 'Design & Drawings',
  'Drawing / Design Change': 'Design & Drawings',
  'Approval Pending': 'Approvals & Decisions',
  'Management Hold': 'Approvals & Decisions',
  'Customer Change Request': 'Approvals & Decisions',
  'Quality Issue / Rework': 'Quality',
  'Site Not Ready': 'Site & Access',
  'Access Constraint': 'Site & Access',
  'Safety Restriction': 'Site & Access',
  'Equipment / Tools Not Available': 'Equipment & Utilities',
  'Utility Not Available (Power / Water)': 'Equipment & Utilities',
  'Weather Impact': 'External / Other',
  'Coordination Issue': 'External / Other',
  'Previous Activity Pending': 'External / Other',
  'Other': 'External / Other',
};

function mapDelayCategory(reason: string): string {
  return DELAY_CATEGORY[reason] || 'External / Other';
}

// ---- Types ----

export interface PipelineStage {
  stage: string;
  completedFlats: number;
  totalFlats: number;
  pct: number;
}

export interface FloorProjection {
  floor: number;
  progressPct: number;
  currentStage: string;
  projectedFinish: string | null;
  spi: number;
  spiStatus: 'green' | 'yellow' | 'red';
  totalActivities: number;
  completedActivities: number;
}

export interface HealthVerdict {
  status: 'on_track' | 'at_risk' | 'critical';
  overallProgressPct: number;
  firstCoatDate: string | null;
  delayedFlats: number;
  delayedFloors: number;
  projectSpi: number;
  projectSpiStatus: 'green' | 'yellow' | 'red';
}

export interface OnHoldFlat {
  floor: number;
  flatNumber: number;
  reason: string;
}

export interface FloorActivityDetail {
  flatNumber: number;
  activity: string;
  status: 'in_progress' | 'yet_to_start' | 'on_hold';
}

export interface StageActivitySummary {
  activity: string;
  completed: number;
  total: number;
  pct: number;
}

export interface StageFloorBreakdown {
  floor: number;
  /** Flats where ALL activities are completed */
  completedUnits: number;
  /** Flats where at least one activity has started (in_progress) but not all done */
  inProgressUnits: number;
  /** Flats where NO activity has started yet */
  yetToStartUnits: number;
  /** Total flats on this floor for this stage */
  totalUnits: number;
  onHoldFlats: OnHoldFlat[];
  /** Activity-level detail for drill-down (non-completed items only) */
  activities: FloorActivityDetail[];
}

export interface DelayReasonRollup {
  category: string;
  flatCount: number;
}

export interface ManagementBottleneck {
  floor: number;
  blockedStage: string;
  blockedVendor: string;
  overdueCount: number;
  maxDaysBehind: number;
  topDelayCategory: string;
  delayReasons: DelayReasonRollup[];
  totalFlatsAffected: number;
}

export interface SitePulseStage {
  stage: string;
  completedThisWeek: number;
  floors: number[];
}

export interface CompletedActivity {
  floor: number;
  flatNumber: number;
  activity: string;
  stage: string;
  stageGate: string;
  completedDate: string;
}

export interface SitePulse {
  // Completion snapshot: flats where every activity is done
  fullyFinishedFlats: number;
  totalFlats: number;
  completionPct: number;

  // Velocity: activities completed this week vs last week
  completionsThisWeek: number;
  completionsLastWeek: number;
  velocityDelta: number;       // thisWeek − lastWeek

  // Bottleneck: stage with the most flats stuck (overdue & incomplete)
  bottleneck: { stage: string; waitingFlats: number } | null;

  // Drill-down: stages that had completions this week
  stagesActiveThisWeek: SitePulseStage[];

  // Activity-level detail for this week's completions
  completedActivitiesThisWeek: CompletedActivity[];
}

export interface PendingFloor {
  floor: number;
  status: 'in_progress' | 'not_started';
}

export interface PendingSubStage {
  subStage: string;
  completedFloors: number;
  totalFloors: number;
  pendingFloors: PendingFloor[];
}

export interface PendingStage {
  stage: string;
  subStages: PendingSubStage[];
}

// ---- Active Blockers (delay reason analytics) ----

export interface BlockerFlatRemark {
  flatNumber: number;
  remarks: string;
}

export interface BlockerFloor {
  floor: number;
  flatCount: number;
  flatRemarks?: BlockerFlatRemark[];  // populated only for "Previous Activity Pending"
}

export interface BlockerStage {
  stage: string;
  floors: BlockerFloor[];
}

export interface BlockerGroup {
  reason: string;
  type: 'delayed' | 'on_hold';
  floorCount: number;
  flatCount: number;
  stages: BlockerStage[];
}

export interface ActiveBlockers {
  delayed: BlockerGroup[];   // not_started + overdue — sorted by floorCount desc, "Reason not captured" last
  onHold: BlockerGroup[];    // on_hold — sorted by floorCount desc, "Reason not captured" last
  totalFloors: number;       // distinct floors across all blockers
  totalActivities: number;   // raw activity count for header badge
}

export interface ManagementData {
  health: HealthVerdict;
  pipeline: PipelineStage[];
  floors: FloorProjection[];
  bottlenecks: ManagementBottleneck[];
  stageFloorBreakdowns: Record<string, StageFloorBreakdown[]>;
  stageActivitySummaries: Record<string, StageActivitySummary[]>;
  sitePulse: SitePulse;
  pendingWork: PendingStage[];
  activeBlockers: ActiveBlockers;
}

export interface VendorScore {
  vendor: string;
  assigned: number;
  completed: number;
  onTimePct: number;
  avgDelayDays: number;
  pending: number;
  rating: 'Good' | 'Fair' | 'Poor';
}

export interface DelayReason {
  reason: string;
  count: number;
  pct: number;
}

export interface FloorBottleneck {
  floor: number;
  progressPct: number;
  blockedStage: string;
  blockedVendor: string;
  overdueCount: number;
  maxDaysBehind: number;
}

// ---- Action Items (Today's action list) ----

export interface ActionItem {
  severity: 'critical' | 'warning' | 'info';
  text: string;
  meta: string;       // supporting detail (e.g. "Floor 3 — 28d behind")
  type: 'floor' | 'vendor' | 'stalled' | 'reversal';
}

export interface InProgressDetail {
  floor: number;
  flatNumber: number;
  stage: string;
  activityName: string;
}

export interface OperationsKpi {
  inProgress: number;
  overdue: number;
  inProgressDetails: InProgressDetail[];
}

export interface OperationsData {
  vendors: VendorScore[];
  delayReasons: DelayReason[];
  bottlenecks: FloorBottleneck[];
  actionItems: ActionItem[];
  kpi: OperationsKpi;
}

// ---- SPI helper ----

function computeSpi(planned: number, done: number): { spi: number; status: 'green' | 'yellow' | 'red' } {
  if (planned === 0) return { spi: 1, status: 'green' };
  const spi = done / planned;
  if (spi > 0.95) return { spi, status: 'green' };
  if (spi >= 0.80) return { spi, status: 'yellow' };
  return { spi, status: 'red' };
}

function isComplete(status: string) {
  return status === 'completed' || status === 'completed_delayed';
}

// ---- Date helpers ----

const TODAY = todayISO();

function daysBetween(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return 0;
  return Math.round((tb - ta) / 86400000);
}

function addDays(date: string, days: number): string {
  if (!date || !isFinite(days)) return date || '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (ISO string) */
function mondayOf(date: string): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

/** Compute site pulse metrics from activity rows */
function computeSitePulse(rows: InsightRow[]): SitePulse {
  const thisMonday = mondayOf(TODAY);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(thisMonday, -1);

  // 1. Completion snapshot: a flat is "fully finished" when every activity for it is complete
  const flatActivities = new Map<string, { total: number; done: number }>();
  // 2. Velocity: activities completed this week / last week (by actual_end date)
  let completionsThisWeek = 0;
  let completionsLastWeek = 0;
  // Stage drill-down for this week
  const thisWeekByStage = new Map<string, { count: number; floors: Set<number> }>();
  // Activity-level detail for this week
  const completedActivitiesThisWeek: CompletedActivity[] = [];
  // 3. Bottleneck: stage with the most unique flats that are overdue & incomplete
  const stageOverdueFlats = new Map<string, Set<string>>();

  for (const r of rows) {
    const flatKey = `${r.floor}|${r.flat_number}`;
    const done = isComplete(r.status);

    // Track per-flat completion
    let fa = flatActivities.get(flatKey);
    if (!fa) { fa = { total: 0, done: 0 }; flatActivities.set(flatKey, fa); }
    fa.total++;
    if (done) fa.done++;

    // Count completed activities by week (only those with actual_end)
    if (done && r.actual_end) {
      if (r.actual_end >= thisMonday && r.actual_end <= TODAY) {
        completionsThisWeek++;
        let sb = thisWeekByStage.get(r.stage);
        if (!sb) { sb = { count: 0, floors: new Set() }; thisWeekByStage.set(r.stage, sb); }
        sb.count++;
        sb.floors.add(r.floor);
        completedActivitiesThisWeek.push({
          floor: r.floor,
          flatNumber: r.flat_number,
          activity: r.activity,
          stage: r.stage,
          stageGate: r.stage_gate,
          completedDate: r.actual_end,
        });
      }
      if (r.actual_end >= lastMonday && r.actual_end <= lastSunday) {
        completionsLastWeek++;
      }
    }

    // Track overdue incomplete flats per stage
    if (!done && r.expected_end && r.expected_end < TODAY) {
      if (!stageOverdueFlats.has(r.stage)) stageOverdueFlats.set(r.stage, new Set());
      stageOverdueFlats.get(r.stage)!.add(flatKey);
    }
  }

  // Sort completed activities by date descending, then floor ascending
  completedActivitiesThisWeek.sort((a, b) =>
    a.completedDate < b.completedDate ? 1 : a.completedDate > b.completedDate ? -1 : a.floor - b.floor
  );

  // Compute fully-finished flats
  let fullyFinishedFlats = 0;
  for (const fa of flatActivities.values()) {
    if (fa.done === fa.total) fullyFinishedFlats++;
  }
  const totalFlats = flatActivities.size;
  const completionPct = totalFlats > 0 ? Math.round((fullyFinishedFlats / totalFlats) * 100) : 0;

  // Find bottleneck stage (most overdue flats)
  let bottleneck: SitePulse['bottleneck'] = null;
  let maxWaiting = 0;
  for (const [stage, flats] of stageOverdueFlats) {
    if (flats.size > maxWaiting) {
      maxWaiting = flats.size;
      bottleneck = { stage, waitingFlats: flats.size };
    }
  }

  // Build stage drill-down sorted by completions descending
  const stagesActiveThisWeek: SitePulseStage[] = [];
  for (const [stage, data] of thisWeekByStage) {
    stagesActiveThisWeek.push({
      stage,
      completedThisWeek: data.count,
      floors: [...data.floors].sort((a, b) => a - b),
    });
  }
  stagesActiveThisWeek.sort((a, b) => b.completedThisWeek - a.completedThisWeek);

  return {
    fullyFinishedFlats,
    totalFlats,
    completionPct,
    completionsThisWeek,
    completionsLastWeek,
    velocityDelta: completionsThisWeek - completionsLastWeek,
    bottleneck,
    stagesActiveThisWeek,
    completedActivitiesThisWeek,
  };
}

function computePendingWork(rows: InsightRow[]): PendingStage[] {
  // Group rows by stage → subStage (stage_gate) → floor
  // Key: `stage|subStage|floor` → { total, completed, hasInProgress }
  const map = new Map<string, Map<string, Map<number, { total: number; completed: number; hasInProgress: boolean }>>>();

  for (const r of rows) {
    if (!map.has(r.stage)) map.set(r.stage, new Map());
    const stageMap = map.get(r.stage)!;
    if (!stageMap.has(r.stage_gate)) stageMap.set(r.stage_gate, new Map());
    const subMap = stageMap.get(r.stage_gate)!;
    if (!subMap.has(r.floor)) subMap.set(r.floor, { total: 0, completed: 0, hasInProgress: false });
    const entry = subMap.get(r.floor)!;
    entry.total++;
    if (isComplete(r.status)) {
      entry.completed++;
    } else if (r.status === 'in_progress') {
      entry.hasInProgress = true;
    }
  }

  const result: PendingStage[] = [];

  // Use PIPELINE_STAGES order to maintain consistent stage ordering
  for (const stage of PIPELINE_STAGES) {
    const stageMap = map.get(stage);
    if (!stageMap) continue;

    const subStages: PendingSubStage[] = [];

    for (const [subStage, floorMap] of stageMap) {
      const allFloors = [...floorMap.keys()].sort((a, b) => a - b);
      const totalFloors = allFloors.length;
      const pendingFloors: PendingFloor[] = [];

      for (const floor of allFloors) {
        const entry = floorMap.get(floor)!;
        // Floor is pending if not all activities are completed
        if (entry.completed < entry.total) {
          pendingFloors.push({
            floor,
            status: entry.hasInProgress ? 'in_progress' : 'not_started',
          });
        }
      }

      // Only include sub-stages that have pending work
      if (pendingFloors.length > 0) {
        subStages.push({
          subStage,
          completedFloors: totalFloors - pendingFloors.length,
          totalFloors,
          pendingFloors,
        });
      }
    }

    // Only include stages that have pending sub-stages
    if (subStages.length > 0) {
      result.push({ stage, subStages });
    }
  }

  return result;
}

// ---- Active Blockers computation ----

const NO_REASON = 'Reason not captured';

const PREV_ACTIVITY_PENDING = 'Previous Activity Pending';

function computeActiveBlockers(rows: InsightRow[]): ActiveBlockers {
  const today = todayISO();

  // Step 1: Filter to currently stuck activities
  type StuckRow = { reason: string; type: 'delayed' | 'on_hold'; stage: string; floor: number; flat: number; remarks: string };
  const stuck: StuckRow[] = [];

  for (const r of rows) {
    const base = normalizeToBaseStatus(r.status);

    // Rule A + B: not_started + overdue
    if (base === 'not_started' && r.expected_end && r.expected_end < today) {
      stuck.push({
        reason: r.delay_reason?.trim() || NO_REASON,
        type: 'delayed',
        stage: r.stage,
        floor: r.floor,
        flat: r.flat_number,
        remarks: r.remarks?.trim() || '',
      });
    }
    // Rule C + D: on_hold
    else if (base === 'on_hold') {
      stuck.push({
        reason: r.delay_reason?.trim() || NO_REASON,
        type: 'on_hold',
        stage: r.stage,
        floor: r.floor,
        flat: r.flat_number,
        remarks: r.remarks?.trim() || '',
      });
    }
  }

  if (stuck.length === 0) {
    return { delayed: [], onHold: [], totalFloors: 0, totalActivities: 0 };
  }

  // Step 2: Group by type → reason → stage → floor
  function aggregate(items: StuckRow[], type: 'delayed' | 'on_hold'): BlockerGroup[] {
    // reason → stage → floor → Set<flat>
    const reasonMap = new Map<string, Map<string, Map<number, Set<number>>>>();
    // For "Previous Activity Pending": reason → stage → floor → flat → remarks
    const remarksMap = new Map<string, Map<number, Map<number, string>>>();

    for (const item of items) {
      if (!reasonMap.has(item.reason)) reasonMap.set(item.reason, new Map());
      const stageMap = reasonMap.get(item.reason)!;
      if (!stageMap.has(item.stage)) stageMap.set(item.stage, new Map());
      const floorMap = stageMap.get(item.stage)!;
      if (!floorMap.has(item.floor)) floorMap.set(item.floor, new Set());
      floorMap.get(item.floor)!.add(item.flat);

      // Collect remarks for "Previous Activity Pending"
      if (item.reason === PREV_ACTIVITY_PENDING && item.remarks) {
        const key = `${item.stage}`;
        if (!remarksMap.has(key)) remarksMap.set(key, new Map());
        const floorRemarksMap = remarksMap.get(key)!;
        if (!floorRemarksMap.has(item.floor)) floorRemarksMap.set(item.floor, new Map());
        floorRemarksMap.get(item.floor)!.set(item.flat, item.remarks);
      }
    }

    const groups: BlockerGroup[] = [];
    for (const [reason, stageMap] of reasonMap) {
      const allFloors = new Set<number>();
      const uniqueFlats = new Set<number>();
      const stages: BlockerStage[] = [];

      for (const [stage, floorMap] of stageMap) {
        const floors: BlockerFloor[] = [];
        for (const [floor, flats] of floorMap) {
          allFloors.add(floor);
          for (const f of flats) uniqueFlats.add(f);

          // Attach flat-level remarks for "Previous Activity Pending"
          let flatRemarks: BlockerFlatRemark[] | undefined;
          if (reason === PREV_ACTIVITY_PENDING) {
            const stageRemarks = remarksMap.get(stage);
            const floorRemarks = stageRemarks?.get(floor);
            if (floorRemarks && floorRemarks.size > 0) {
              flatRemarks = [...floorRemarks.entries()]
                .map(([flatNumber, remarks]) => ({ flatNumber, remarks }))
                .sort((a, b) => a.flatNumber - b.flatNumber);
            }
          }

          floors.push({ floor, flatCount: flats.size, ...(flatRemarks ? { flatRemarks } : {}) });
        }
        floors.sort((a, b) => a.floor - b.floor);
        stages.push({ stage, floors });
      }
      // Sort stages alphabetically
      stages.sort((a, b) => a.stage.localeCompare(b.stage));

      groups.push({
        reason,
        type,
        floorCount: allFloors.size,
        flatCount: uniqueFlats.size,
        stages,
      });
    }

    // Sort: by floorCount desc, but "Reason not captured" always last
    groups.sort((a, b) => {
      if (a.reason === NO_REASON && b.reason !== NO_REASON) return 1;
      if (b.reason === NO_REASON && a.reason !== NO_REASON) return -1;
      return b.floorCount - a.floorCount;
    });

    return groups;
  }

  const delayedItems = stuck.filter(s => s.type === 'delayed');
  const onHoldItems = stuck.filter(s => s.type === 'on_hold');

  const delayed = aggregate(delayedItems, 'delayed');
  const onHold = aggregate(onHoldItems, 'on_hold');

  const allFloors = new Set<number>();
  for (const s of stuck) allFloors.add(s.floor);

  return {
    delayed,
    onHold,
    totalFloors: allFloors.size,
    totalActivities: stuck.length,
  };
}

// ---- Management ----

export function computeManagement(
  rows: InsightRow[],
  heatmap: HeatmapData,
  stageWeights: Record<string, number> = DEFAULT_STAGE_WEIGHTS,
  paintDaysPerFlat: number = DEFAULT_PAINT_DAYS,
): ManagementData {
  // --- Pipeline from heatmap (reuse existing rollup) ---
  const pipeline: PipelineStage[] = PIPELINE_STAGES.map(stage => {
    const cell = heatmap.stageCompletionUnits[stage];
    if (!cell) return { stage, completedFlats: 0, totalFlats: 0, pct: 0 };
    return {
      stage,
      completedFlats: cell.completed,
      totalFlats: cell.total,
      pct: cell.total > 0 ? Math.round((cell.completed / cell.total) * 100) : 0,
    };
  });

  // --- Per-floor aggregation (single pass) ---
  type FloorAgg = {
    total: number;
    done: number;
    planned: number;
    overdue: number;
    overdueFlats: Set<number>;
    stageActuals: Map<string, { total: number; done: number; starts: string[]; ends: string[] }>;
  };
  const floorMap = new Map<number, FloorAgg>();

  // Track on-hold flats and per-stage overdue for drill-down + bottlenecks
  const onHoldByStage = new Map<string, OnHoldFlat[]>();
  const stageFloorOverdue = new Map<string, Set<string>>();
  const bottleneckMap = new Map<number, {
    total: number; done: number;
    stageOverdue: Map<string, {
      count: number; maxDays: number;
      vendors: Map<string, number>;
      reasons: Map<string, number>;
      reasonFlats: Map<string, Set<number>>;
    }>;
  }>();

  for (const r of rows) {
    let f = floorMap.get(r.floor);
    if (!f) {
      f = { total: 0, done: 0, planned: 0, overdue: 0, overdueFlats: new Set(), stageActuals: new Map() };
      floorMap.set(r.floor, f);
    }
    f.total++;
    const done = isComplete(r.status);
    if (done) f.done++;
    if (r.expected_end && r.expected_end <= TODAY) f.planned++;
    if (!done && r.expected_end && r.expected_end < TODAY) {
      f.overdue++;
      f.overdueFlats.add(r.flat_number);
    }

    // Stage-level tracking for projections
    let sa = f.stageActuals.get(r.stage);
    if (!sa) { sa = { total: 0, done: 0, starts: [], ends: [] }; f.stageActuals.set(r.stage, sa); }
    sa.total++;
    if (done) sa.done++;
    if (r.actual_start) sa.starts.push(r.actual_start);
    if (r.actual_end && done) sa.ends.push(r.actual_end);

    // On-hold flats per stage
    if (r.status === 'on_hold') {
      if (!onHoldByStage.has(r.stage)) onHoldByStage.set(r.stage, []);
      onHoldByStage.get(r.stage)!.push({ floor: r.floor, flatNumber: r.flat_number, reason: r.delay_reason || 'No reason specified' });
    }

    // Track overdue per stage+floor for drill-down
    if (!done && r.expected_end && r.expected_end < TODAY) {
      const key = `${r.stage}|${r.floor}`;
      if (!stageFloorOverdue.has(key)) stageFloorOverdue.set(key, new Set());
      stageFloorOverdue.get(key)!.add(String(r.flat_number));
    }

    // Bottleneck tracking (same logic as operations, but with delay reasons)
    let bo = bottleneckMap.get(r.floor);
    if (!bo) { bo = { total: 0, done: 0, stageOverdue: new Map() }; bottleneckMap.set(r.floor, bo); }
    bo.total++;
    if (done) bo.done++;
    if (!done && r.expected_end && r.expected_end < TODAY) {
      const daysLate = daysBetween(r.expected_end, TODAY);
      let so = bo.stageOverdue.get(r.stage);
      if (!so) { so = { count: 0, maxDays: 0, vendors: new Map(), reasons: new Map(), reasonFlats: new Map() }; bo.stageOverdue.set(r.stage, so); }
      so.count++;
      so.maxDays = Math.max(so.maxDays, daysLate);
      if (r.vendor) so.vendors.set(r.vendor, (so.vendors.get(r.vendor) || 0) + 1);
      const cat = r.delay_reason ? mapDelayCategory(r.delay_reason) : '__none__';
      so.reasons.set(cat, (so.reasons.get(cat) || 0) + 1);
      if (!so.reasonFlats.has(cat)) so.reasonFlats.set(cat, new Set());
      so.reasonFlats.get(cat)!.add(r.flat_number);
    }
  }

  // --- Stage benchmarks: for each stage, collect durations from completed floors ---
  const stageBenchmarks = new Map<string, number[]>();
  for (const [, f] of floorMap) {
    for (const stage of PIPELINE_STAGES) {
      const sa = f.stageActuals.get(stage);
      if (!sa || sa.done < sa.total || sa.total === 0) continue;
      if (sa.starts.length === 0 || sa.ends.length === 0) continue;
      const start = sa.starts.sort()[0];
      const end = sa.ends.sort().reverse()[0];
      const dur = daysBetween(start, end);
      if (dur > 0) {
        if (!stageBenchmarks.has(stage)) stageBenchmarks.set(stage, []);
        stageBenchmarks.get(stage)!.push(dur);
      }
    }
  }
  const benchmarkAvg = new Map<string, number>();
  for (const [stage, durations] of stageBenchmarks) {
    benchmarkAvg.set(stage, durations.reduce((a, b) => a + b, 0) / durations.length);
  }

  // --- Project-level totals ---
  let projectTotal = 0, projectDone = 0, projectPlanned = 0;
  const allDelayedFlats = new Set<number>();
  const allDelayedFloors = new Set<number>();
  for (const [floorNum, f] of floorMap) {
    projectTotal += f.total;
    projectDone += f.done;
    projectPlanned += f.planned;
    for (const flat of f.overdueFlats) {
      allDelayedFlats.add(flat);
      allDelayedFloors.add(floorNum);
    }
  }
  const projectSpiResult = computeSpi(projectPlanned, projectDone);

  // --- Floor projections ---
  const floorNumbers = [...floorMap.keys()].sort((a, b) => a - b);
  const floors: FloorProjection[] = floorNumbers.map(floorNum => {
    const f = floorMap.get(floorNum)!;
    const progressPct = f.total > 0 ? Math.round((f.done / f.total) * 100) : 0;
    const spiResult = computeSpi(f.planned, f.done);

    let currentStage = PIPELINE_STAGES[PIPELINE_STAGES.length - 1];
    for (const stage of PIPELINE_STAGES) {
      const sa = f.stageActuals.get(stage);
      if (!sa || sa.done < sa.total) {
        currentStage = stage;
        break;
      }
    }

    let totalRemainingDays = 0;
    let hasData = false;
    for (const stage of PIPELINE_STAGES) {
      const sa = f.stageActuals.get(stage);
      if (!sa) continue;
      if (sa.done === sa.total) continue;

      if (benchmarkAvg.has(stage)) {
        const avg = benchmarkAvg.get(stage)!;
        if (stage === currentStage && sa.starts.length > 0) {
          const stageStart = sa.starts.sort()[0];
          const spent = daysBetween(stageStart, TODAY);
          totalRemainingDays += Math.max(0, avg - spent);
        } else {
          totalRemainingDays += avg;
        }
        hasData = true;
      } else if (sa.done > 0 && sa.starts.length > 0) {
        const stageStart = sa.starts.sort()[0];
        const daysSoFar = Math.max(1, daysBetween(stageStart, TODAY));
        const rate = sa.done / daysSoFar;
        if (rate > 0) {
          totalRemainingDays += (sa.total - sa.done) / rate;
          hasData = true;
        }
      }
    }

    const projectedFinish = hasData ? addDays(TODAY, totalRemainingDays) : null;

    return {
      floor: floorNum,
      progressPct,
      currentStage,
      projectedFinish,
      spi: Math.round(spiResult.spi * 100) / 100,
      spiStatus: spiResult.status,
      totalActivities: f.total,
      completedActivities: f.done,
    };
  });

  // --- Weighted progress across all 9 stages ---
  // For each stage, compute completion % across all flats, multiply by stage weight
  const totalWeight = ALL_STAGES.reduce((sum, s) => sum + (stageWeights[s] || 0), 0);
  let weightedSum = 0;
  for (const stage of ALL_STAGES) {
    const cell = heatmap.stageCompletionUnits[stage];
    const weight = stageWeights[stage] || 0;
    if (!cell || cell.total === 0) continue;
    const stagePct = cell.completed / cell.total;
    weightedSum += stagePct * weight;
  }
  const weightedProgressPct = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  // --- 1st Coat Paint projected date: project only up to that stage ---
  // For each floor, sum remaining days for stages up to and including "1st coat paint"
  const FIRST_COAT_STAGE = '1st coat paint';
  let firstCoatDate: string | null = null;
  for (const floorNum of floorNumbers) {
    const f = floorMap.get(floorNum)!;
    let remainingDays = 0;
    let hasProjectionData = false;
    let reachedFirstCoat = false;

    for (const stage of PIPELINE_STAGES) {
      const sa = f.stageActuals.get(stage);
      if (!sa) continue;

      if (sa.done === sa.total) {
        if (stage === FIRST_COAT_STAGE) { reachedFirstCoat = true; break; }
        continue;
      }

      if (stage === FIRST_COAT_STAGE) {
        // For the paint stage itself: use paintDaysPerFlat * remaining flats
        const remaining = sa.total - sa.done;
        remainingDays += remaining * paintDaysPerFlat;
        hasProjectionData = true;
        reachedFirstCoat = true;
      } else if (benchmarkAvg.has(stage)) {
        const avg = benchmarkAvg.get(stage)!;
        if (sa.starts.length > 0 && sa.done < sa.total) {
          const stageStart = sa.starts.sort()[0];
          const spent = daysBetween(stageStart, TODAY);
          remainingDays += Math.max(0, avg - spent);
        } else {
          remainingDays += avg;
        }
        hasProjectionData = true;
      } else if (sa.done > 0 && sa.starts.length > 0) {
        const stageStart = sa.starts.sort()[0];
        const daysSoFar = Math.max(1, daysBetween(stageStart, TODAY));
        const rate = sa.done / daysSoFar;
        if (rate > 0) {
          remainingDays += (sa.total - sa.done) / rate;
          hasProjectionData = true;
        }
      }

      if (stage === FIRST_COAT_STAGE) { reachedFirstCoat = true; break; }
    }

    // If this floor hasn't even reached 1st coat paint data, still project it
    if (!reachedFirstCoat) {
      const paintSa = f.stageActuals.get(FIRST_COAT_STAGE);
      if (paintSa) {
        remainingDays += paintSa.total * paintDaysPerFlat;
        hasProjectionData = true;
      }
    }

    if (hasProjectionData) {
      const floorDate = addDays(TODAY, remainingDays);
      if (!firstCoatDate || floorDate > firstCoatDate) {
        firstCoatDate = floorDate;
      }
    }
  }

  // --- Health verdict ---
  const totalFlatCount = pipeline[0]?.totalFlats || 1;
  const overduePct = totalFlatCount > 0 ? (allDelayedFlats.size / totalFlatCount) * 100 : 0;
  const anyFloorRed = floors.some(f => f.spiStatus === 'red');
  let healthStatus: HealthVerdict['status'];
  if (projectSpiResult.spi > 0.95 && !anyFloorRed && overduePct < 5) {
    healthStatus = 'on_track';
  } else if (projectSpiResult.spi < 0.80 || overduePct > 15) {
    healthStatus = 'critical';
  } else {
    healthStatus = 'at_risk';
  }

  const health: HealthVerdict = {
    status: healthStatus,
    overallProgressPct: weightedProgressPct,
    firstCoatDate,
    delayedFlats: allDelayedFlats.size,
    delayedFloors: allDelayedFloors.size,
    projectSpi: Math.round(projectSpiResult.spi * 100) / 100,
    projectSpiStatus: projectSpiResult.status,
  };

  // --- Bottlenecks (top 3) ---
  const bottlenecks: ManagementBottleneck[] = [];
  for (const [floor, bo] of bottleneckMap) {
    if (bo.stageOverdue.size === 0) continue;
    let worstStage = '';
    let worstVendor = '';
    let totalOverdue = 0;
    let maxDays = 0;
    let topReason = '';
    let worstStageSo: { count: number; maxDays: number; vendors: Map<string, number>; reasons: Map<string, number>; reasonFlats: Map<string, Set<number>> } | null = null;
    for (const [stage, so] of bo.stageOverdue) {
      totalOverdue += so.count;
      if (so.maxDays > maxDays) {
        maxDays = so.maxDays;
        worstStage = stage;
        worstStageSo = so;
        let topVendor = '', topVCount = 0;
        for (const [v, c] of so.vendors) {
          if (c > topVCount) { topVCount = c; topVendor = v; }
        }
        worstVendor = topVendor;
        let topReasonName = '', topRCount = 0;
        for (const [rn, rc] of so.reasons) {
          if (rn !== '__none__' && rc > topRCount) { topRCount = rc; topReasonName = rn; }
        }
        topReason = topReasonName;
      }
    }

    // Build flat-level delay reason rollup from the worst stage
    const delayReasons: DelayReasonRollup[] = [];
    let totalFlatsAffected = 0;
    if (worstStageSo?.reasonFlats) {
      const allFlats = new Set<number>();
      for (const [cat, flats] of worstStageSo.reasonFlats) {
        const label = cat === '__none__' ? 'No reason logged' : cat;
        delayReasons.push({ category: label, flatCount: flats.size });
        for (const fn of flats) allFlats.add(fn);
      }
      totalFlatsAffected = allFlats.size;
      delayReasons.sort((a, b) => b.flatCount - a.flatCount);
    }

    bottlenecks.push({
      floor, blockedStage: worstStage, blockedVendor: worstVendor,
      overdueCount: totalOverdue, maxDaysBehind: maxDays, topDelayCategory: topReason,
      delayReasons: delayReasons.slice(0, 3), totalFlatsAffected,
    });
  }
  bottlenecks.sort((a, b) => b.maxDaysBehind - a.maxDaysBehind);

  // --- Pre-group rows by stage (single pass replaces repeated .filter()) ---
  const rowsByStage = new Map<string, InsightRow[]>();
  for (const r of rows) {
    if (r.status === 'not_applicable') continue;
    let arr = rowsByStage.get(r.stage);
    if (!arr) { arr = []; rowsByStage.set(r.stage, arr); }
    arr.push(r);
  }

  // --- Stage floor breakdowns (for drill-down) + activity summaries ---
  const stageFloorBreakdowns: Record<string, StageFloorBreakdown[]> = {};
  const stageActivitySummaries: Record<string, StageActivitySummary[]> = {};
  for (const stage of PIPELINE_STAGES) {
    const breakdowns: StageFloorBreakdown[] = [];
    const stageRows = rowsByStage.get(stage) || [];

    // Build activity drill-down + flat-level counts in a single pass
    const activityByFloor = new Map<number, FloorActivityDetail[]>();
    const floorFlatRows = new Map<number, Map<number, { total: number; completed: number; hasStarted: boolean }>>();
    // Activity-level completion counts (for activity tiles)
    const activityStats = new Map<string, { completed: number; total: number }>();

    for (const r of stageRows) {
      // Flat-level counts
      if (!floorFlatRows.has(r.floor)) floorFlatRows.set(r.floor, new Map());
      const flatMap = floorFlatRows.get(r.floor)!;
      if (!flatMap.has(r.flat_number)) flatMap.set(r.flat_number, { total: 0, completed: 0, hasStarted: false });
      const fc = flatMap.get(r.flat_number)!;
      fc.total++;
      const done = isComplete(r.status);
      if (done) { fc.completed++; fc.hasStarted = true; }
      else if (r.status === 'in_progress' || r.status === 'in_progress_delayed') fc.hasStarted = true;

      // Activity-level completion for tiles
      if (!activityStats.has(r.activity)) activityStats.set(r.activity, { completed: 0, total: 0 });
      const as = activityStats.get(r.activity)!;
      as.total++;
      if (done) as.completed++;

      // Pending activities for drill-down
      if (!done) {
        const isInProg = r.status === 'in_progress' || r.status === 'in_progress_delayed';
        const isOnHold = r.status === 'on_hold';
        if (!activityByFloor.has(r.floor)) activityByFloor.set(r.floor, []);
        activityByFloor.get(r.floor)!.push({
          flatNumber: r.flat_number,
          activity: r.activity,
          status: isOnHold ? 'on_hold' : isInProg ? 'in_progress' : 'yet_to_start',
        });
      }
    }

    // Build sorted activity summaries for this stage
    const summaries: StageActivitySummary[] = [];
    for (const [activity, stats] of activityStats) {
      summaries.push({
        activity,
        completed: stats.completed,
        total: stats.total,
        pct: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      });
    }
    summaries.sort((a, b) => b.pct - a.pct); // highest completion first
    stageActivitySummaries[stage] = summaries;

    for (const floorRow of heatmap.floors) {
      const cell = floorRow.stages[stage];
      if (!cell || cell.total === 0) continue;
      const stageOnHold = (onHoldByStage.get(stage) || []).filter(oh => oh.floor === floorRow.floor);
      const activities = (activityByFloor.get(floorRow.floor) || [])
        .sort((a, b) => a.flatNumber - b.flatNumber);

      // Flat-level counts: completed / in progress / yet to start
      const flatMap = floorFlatRows.get(floorRow.floor);
      let completedUnits = 0;
      let inProgressUnits = 0;
      let yetToStartUnits = 0;
      let totalUnits = 0;
      if (flatMap) {
        for (const fc of flatMap.values()) {
          totalUnits++;
          if (fc.completed === fc.total) completedUnits++;
          else if (fc.hasStarted) inProgressUnits++;
          else yetToStartUnits++;
        }
      }

      breakdowns.push({
        floor: floorRow.floor,
        completedUnits,
        inProgressUnits,
        yetToStartUnits,
        totalUnits,
        onHoldFlats: stageOnHold,
        activities,
      });
    }
    breakdowns.sort((a, b) => a.floor - b.floor);
    stageFloorBreakdowns[stage] = breakdowns;
  }

  // --- Site pulse ---
  const sitePulse = computeSitePulse(rows);

  // --- Pending work matrix ---
  const pendingWork = computePendingWork(rows);
  const activeBlockers = computeActiveBlockers(rows);

  return {
    health,
    pipeline,
    floors,
    bottlenecks,
    stageFloorBreakdowns,
    stageActivitySummaries,
    sitePulse,
    pendingWork,
    activeBlockers,
  };
}

// ---- Operations ----

export function computeOperations(rows: InsightRow[]): OperationsData {
  // --- Vendor scorecard (single pass) ---
  const vendorMap = new Map<string, {
    assigned: number;
    completed: number;
    onTime: number;
    pending: number;
    totalDelayDays: number;
    delayedCount: number;
  }>();

  // --- Delay reasons ---
  const reasonMap = new Map<string, number>();

  // --- KPI counters ---
  let kpiInProgress = 0;
  let kpiOverdue = 0;
  const inProgressDetails: InProgressDetail[] = [];

  // --- Floor overdue tracking ---
  const floorOverdueMap = new Map<number, {
    total: number;
    done: number;
    stageOverdue: Map<string, { count: number; maxDays: number; vendors: Map<string, number> }>;
  }>();

  for (const r of rows) {
    // KPI: in progress
    if (r.status === 'in_progress' || r.status === 'in_progress_delayed') {
      kpiInProgress++;
      inProgressDetails.push({ floor: r.floor, flatNumber: r.flat_number, stage: r.stage, activityName: r.activity });
    }
    // KPI: overdue (past expected_end, not completed)
    if (!isComplete(r.status) && r.expected_end && r.expected_end < TODAY) {
      kpiOverdue++;
    }
    // Vendor
    if (r.vendor) {
      let v = vendorMap.get(r.vendor);
      if (!v) { v = { assigned: 0, completed: 0, onTime: 0, pending: 0, totalDelayDays: 0, delayedCount: 0 }; vendorMap.set(r.vendor, v); }
      v.assigned++;
      const done = isComplete(r.status);
      if (done) {
        v.completed++;
        if (r.actual_end && r.expected_end && r.actual_end <= r.expected_end) {
          v.onTime++;
        } else if (r.actual_end && r.expected_end && r.actual_end > r.expected_end) {
          v.delayedCount++;
          v.totalDelayDays += daysBetween(r.expected_end, r.actual_end);
        }
      } else {
        v.pending++;
      }
    }

    // Delay reasons — aggregate by high-level category
    if (r.delay_reason) {
      const category = mapDelayCategory(r.delay_reason);
      reasonMap.set(category, (reasonMap.get(category) || 0) + 1);
    }

    // Floor overdue
    const done = isComplete(r.status);
    let fo = floorOverdueMap.get(r.floor);
    if (!fo) { fo = { total: 0, done: 0, stageOverdue: new Map() }; floorOverdueMap.set(r.floor, fo); }
    fo.total++;
    if (done) fo.done++;

    if (!done && r.expected_end && r.expected_end < TODAY) {
      const daysLate = daysBetween(r.expected_end, TODAY);
      let so = fo.stageOverdue.get(r.stage);
      if (!so) { so = { count: 0, maxDays: 0, vendors: new Map() }; fo.stageOverdue.set(r.stage, so); }
      so.count++;
      so.maxDays = Math.max(so.maxDays, daysLate);
      if (r.vendor) so.vendors.set(r.vendor, (so.vendors.get(r.vendor) || 0) + 1);
    }
  }

  // Build vendor scorecard
  const vendors: VendorScore[] = [...vendorMap.entries()]
    .map(([vendor, v]) => {
      const onTimePct = v.completed > 0 ? Math.round((v.onTime / v.completed) * 100) : 0;
      const avgDelayDays = v.delayedCount > 0 ? Math.round((v.totalDelayDays / v.delayedCount) * 10) / 10 : 0;
      let rating: 'Good' | 'Fair' | 'Poor';
      if (onTimePct >= 80) rating = 'Good';
      else if (onTimePct >= 50) rating = 'Fair';
      else rating = 'Poor';
      return { vendor, assigned: v.assigned, completed: v.completed, onTimePct, avgDelayDays, pending: v.pending, rating };
    })
    .sort((a, b) => b.assigned - a.assigned);

  // Build delay reasons
  const totalDelays = [...reasonMap.values()].reduce((a, b) => a + b, 0);
  const delayReasons: DelayReason[] = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count, pct: totalDelays > 0 ? Math.round((count / totalDelays) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // Build floor bottlenecks (only floors with overdue activities)
  const bottlenecks: FloorBottleneck[] = [];
  for (const [floor, fo] of floorOverdueMap) {
    if (fo.stageOverdue.size === 0) continue;
    // Find worst stage
    let worstStage = '';
    let worstVendor = '';
    let totalOverdue = 0;
    let maxDays = 0;
    for (const [stage, so] of fo.stageOverdue) {
      totalOverdue += so.count;
      if (so.maxDays > maxDays) {
        maxDays = so.maxDays;
        worstStage = stage;
        // Find vendor with most overdue in this stage
        let topVendor = '', topCount = 0;
        for (const [v, c] of so.vendors) {
          if (c > topCount) { topCount = c; topVendor = v; }
        }
        worstVendor = topVendor;
      }
    }
    bottlenecks.push({
      floor,
      progressPct: fo.total > 0 ? Math.round((fo.done / fo.total) * 100) : 0,
      blockedStage: worstStage,
      blockedVendor: worstVendor,
      overdueCount: totalOverdue,
      maxDaysBehind: maxDays,
    });
  }
  bottlenecks.sort((a, b) => b.maxDaysBehind - a.maxDaysBehind);

  // ---- Action items (derived from the data above) ----
  const actionItems: ActionItem[] = [];

  // 1. Worst floor bottleneck
  if (bottlenecks.length > 0) {
    const worst = bottlenecks[0];
    actionItems.push({
      severity: worst.maxDaysBehind >= 14 ? 'critical' : 'warning',
      text: `Floor ${worst.floor} is ${worst.maxDaysBehind}d behind — stuck at ${worst.blockedStage}`,
      meta: worst.blockedVendor ? `Vendor: ${worst.blockedVendor} · ${worst.overdueCount} overdue` : `${worst.overdueCount} overdue activities`,
      type: 'floor',
    });
  }

  // 2. Worst vendor (highest risk = most pending with poor on-time)
  const riskyVendors = vendors
    .filter(v => v.rating === 'Poor' && v.pending > 0)
    .sort((a, b) => b.pending - a.pending);
  if (riskyVendors.length > 0) {
    const rv = riskyVendors[0];
    actionItems.push({
      severity: rv.onTimePct < 30 ? 'critical' : 'warning',
      text: `${rv.vendor} has ${rv.pending} pending activities with only ${rv.onTimePct}% on-time rate`,
      meta: `${rv.assigned} assigned · ${rv.completed} completed · Avg delay ${rv.avgDelayDays}d`,
      type: 'vendor',
    });
  }

  // 3. Stalled floors (zero completions this week)
  const thisMonday = mondayOf(TODAY);
  const floorCompletionsThisWeek = new Map<number, number>();
  for (const r of rows) {
    if (isComplete(r.status) && r.actual_end && r.actual_end >= thisMonday) {
      floorCompletionsThisWeek.set(r.floor, (floorCompletionsThisWeek.get(r.floor) || 0) + 1);
    }
  }
  // Find floors with activities but zero completions this week
  const allFloors = [...floorOverdueMap.keys()].sort((a, b) => a - b);
  const stalledFloors = allFloors.filter(f => {
    const fo = floorOverdueMap.get(f)!;
    return fo.done < fo.total && !floorCompletionsThisWeek.has(f);
  });
  if (stalledFloors.length > 0) {
    const label = stalledFloors.length <= 3
      ? stalledFloors.map(f => `Floor ${f}`).join(', ')
      : `${stalledFloors.length} floors`;
    actionItems.push({
      severity: stalledFloors.length >= 3 ? 'warning' : 'info',
      text: `${label} — zero completions this week`,
      meta: 'No activity was marked complete since Monday',
      type: 'stalled',
    });
  }

  return { vendors, delayReasons, bottlenecks, actionItems, kpi: { inProgress: kpiInProgress, overdue: kpiOverdue, inProgressDetails } };
}

// ---- Public API ----

/**
 * Compute insights from pre-fetched activity rows.
 * Accepts rows directly so the caller can fetch them in parallel with other queries.
 */
export function computeInsights(
  rows: InsightRow[],
  heatmap: HeatmapData,
  stageWeights?: Record<string, number>,
  paintDaysPerFlat?: number,
): { management: ManagementData; operations: OperationsData } | null {
  if (rows.length === 0) return null;
  return {
    management: computeManagement(rows, heatmap, stageWeights, paintDaysPerFlat),
    operations: computeOperations(rows),
  };
}

/**
 * @deprecated Use computeInsights() with pre-fetched rows for better parallelism.
 * Kept for backward compatibility.
 */
export async function getInsightsData(
  projectId: string,
  heatmap: HeatmapData,
  stageWeights?: Record<string, number>,
  paintDaysPerFlat?: number,
): Promise<{ management: ManagementData; operations: OperationsData } | null> {
  const rows = await getInsightActivities(projectId);
  return computeInsights(rows, heatmap, stageWeights, paintDaysPerFlat);
}
