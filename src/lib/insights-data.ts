import { supabase } from './supabase';
import type { HeatmapData } from './floor-rollup';

const PIPELINE_STAGES = [
  'Pre-Tiling',
  'Tiling',
  'Post Tiling',
  'Pre Paint Activities',
  '1st coat paint',
];

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

export interface ManagementData {
  pipeline: PipelineStage[];
  floors: FloorProjection[];
  kpi: {
    totalFlats: number;
    overallProgressPct: number;
    overdueCount: number;
    projectSpi: number;
    projectSpiStatus: 'green' | 'yellow' | 'red';
    totalActivities: number;
    completedActivities: number;
  };
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

export interface OperationsData {
  vendors: VendorScore[];
  delayReasons: DelayReason[];
  bottlenecks: FloorBottleneck[];
}

// ---- Lightweight activity row (only fields we need) ----

interface InsightRow {
  floor: number;
  flat_number: number;
  stage: string;
  status: string;
  expected_end: string;
  actual_start: string;
  actual_end: string;
  vendor: string;
  delay_reason: string;
}

// ---- Fetch ----

async function fetchInsightRows(projectId: string): Promise<InsightRow[]> {
  const all: InsightRow[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('activities')
      .select('floor, flat_number, stage, status, expected_end, actual_start, actual_end, vendor, delay_reason')
      .eq('project_id', projectId)
      .neq('status', 'not_applicable')
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as InsightRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
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

const TODAY = new Date().toISOString().slice(0, 10);

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

// ---- Management ----

export function computeManagement(rows: InsightRow[], heatmap: HeatmapData): ManagementData {
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

  const totalFlats = pipeline.length > 0 ? Math.max(...pipeline.map(p => p.totalFlats)) : 0;

  // --- Per-floor aggregation (single pass) ---
  const floorMap = new Map<number, {
    total: number;
    done: number;
    planned: number;
    overdue: number;
    stageActuals: Map<string, { total: number; done: number; starts: string[]; ends: string[] }>;
  }>();

  for (const r of rows) {
    let f = floorMap.get(r.floor);
    if (!f) {
      f = { total: 0, done: 0, planned: 0, overdue: 0, stageActuals: new Map() };
      floorMap.set(r.floor, f);
    }
    f.total++;
    const done = isComplete(r.status);
    if (done) f.done++;
    if (r.expected_end && r.expected_end <= TODAY) f.planned++;
    if (!done && r.expected_end && r.expected_end < TODAY) f.overdue++;

    // Stage-level tracking for projections
    let sa = f.stageActuals.get(r.stage);
    if (!sa) { sa = { total: 0, done: 0, starts: [], ends: [] }; f.stageActuals.set(r.stage, sa); }
    sa.total++;
    if (done) sa.done++;
    if (r.actual_start) sa.starts.push(r.actual_start);
    if (r.actual_end && done) sa.ends.push(r.actual_end);
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
  let projectTotal = 0, projectDone = 0, projectPlanned = 0, projectOverdue = 0;
  for (const [, f] of floorMap) {
    projectTotal += f.total;
    projectDone += f.done;
    projectPlanned += f.planned;
    projectOverdue += f.overdue;
  }
  const projectSpiResult = computeSpi(projectPlanned, projectDone);

  // --- Floor projections ---
  const floorNumbers = [...floorMap.keys()].sort((a, b) => a - b);
  const floors: FloorProjection[] = floorNumbers.map(floorNum => {
    const f = floorMap.get(floorNum)!;
    const progressPct = f.total > 0 ? Math.round((f.done / f.total) * 100) : 0;
    const spiResult = computeSpi(f.planned, f.done);

    // Current stage: first pipeline stage not fully complete on this floor
    let currentStage = PIPELINE_STAGES[PIPELINE_STAGES.length - 1];
    for (const stage of PIPELINE_STAGES) {
      const sa = f.stageActuals.get(stage);
      if (!sa || sa.done < sa.total) {
        currentStage = stage;
        break;
      }
    }

    // Projection: sum remaining stage durations
    let totalRemainingDays = 0;
    let hasData = false;
    let hitCurrentStage = false;
    for (const stage of PIPELINE_STAGES) {
      const sa = f.stageActuals.get(stage);
      if (!sa) continue;
      if (sa.done === sa.total) continue; // fully complete, skip

      hitCurrentStage = true;

      if (benchmarkAvg.has(stage)) {
        // Benchmark available
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
        // Rate-based fallback
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

  return {
    pipeline,
    floors,
    kpi: {
      totalFlats,
      overallProgressPct: projectTotal > 0 ? Math.round((projectDone / projectTotal) * 100) : 0,
      overdueCount: projectOverdue,
      projectSpi: Math.round(projectSpiResult.spi * 100) / 100,
      projectSpiStatus: projectSpiResult.status,
      totalActivities: projectTotal,
      completedActivities: projectDone,
    },
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

  // --- Floor overdue tracking ---
  const floorOverdueMap = new Map<number, {
    total: number;
    done: number;
    stageOverdue: Map<string, { count: number; maxDays: number; vendors: Map<string, number> }>;
  }>();

  for (const r of rows) {
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

    // Delay reasons
    if (r.delay_reason) {
      reasonMap.set(r.delay_reason, (reasonMap.get(r.delay_reason) || 0) + 1);
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

  return { vendors, delayReasons, bottlenecks };
}

// ---- Public API ----

export async function getInsightsData(
  projectId: string,
  heatmap: HeatmapData
): Promise<{ management: ManagementData; operations: OperationsData } | null> {
  const rows = await fetchInsightRows(projectId);
  if (rows.length === 0) return null;
  return {
    management: computeManagement(rows, heatmap),
    operations: computeOperations(rows),
  };
}
