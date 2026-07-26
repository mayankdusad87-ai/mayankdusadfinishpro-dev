import { UploadedActivity } from './project-data-store';
import type { SubstageRollup } from './supabase-data';

export interface RollupCell {
  label: 'completed' | 'running' | 'yet_to_start';
  completed: number;
  running: number;
  total: number;
}

export interface FloorRow {
  floor: number;
  stages: Record<string, RollupCell>;
  readiness: 'completed' | 'running' | 'not_ready';
}

export interface HeatmapData {
  stages: string[];
  floors: FloorRow[];
  stageCompletionFloors: Record<string, RollupCell>;
  stageCompletionUnits: Record<string, RollupCell>;
  floorsFullyReady: number;
  floorsInProgress: number;
}

function isCompleted(s: string): boolean {
  return s === 'completed' || s === 'completed_delayed';
}

function isYetToStart(s: string): boolean {
  return s === 'not_started';
}

function isApplicable(s: string): boolean {
  return s !== 'not_applicable';
}

function rollup(completed: number, yetToStart: number, total: number): RollupCell {
  const running = total - completed - yetToStart;
  if (total === 0) return { label: 'yet_to_start', completed: 0, running: 0, total: 0 };
  if (completed === total) return { label: 'completed', completed: total, running: 0, total };
  if (yetToStart === total) return { label: 'yet_to_start', completed: 0, running: 0, total };
  return { label: 'running', completed, running, total };
}

export function computeHeatmap(activities: UploadedActivity[]): HeatmapData {
  const applicable = activities.filter(a => isApplicable(a.status));
  if (applicable.length === 0) {
    return { stages: [], floors: [], stageCompletionFloors: {}, stageCompletionUnits: {}, floorsFullyReady: 0, floorsInProgress: 0 };
  }

  const stagesSet = new Set<string>();
  const floorsSet = new Set<number>();
  for (const a of applicable) {
    stagesSet.add(a.stage);
    floorsSet.add(a.floor);
  }
  const stages = [...stagesSet];
  const floorNumbers = [...floorsSet].sort((a, b) => a - b);

  // Level 1: Activities → Substage (per flat, per stage, per stage_gate)
  // Key: `flat|stage|stageGate`
  const substageMap = new Map<string, { c: number; y: number; t: number }>();
  for (const a of applicable) {
    const key = `${a.flat_number}|${a.stage}|${a.stage_gate}`;
    let entry = substageMap.get(key);
    if (!entry) { entry = { c: 0, y: 0, t: 0 }; substageMap.set(key, entry); }
    entry.t++;
    if (isCompleted(a.status)) entry.c++;
    else if (isYetToStart(a.status)) entry.y++;
  }

  // Level 2: Substages → Flat's Stage status
  // Key: `flat|stage`
  const flatStageMap = new Map<string, { c: number; y: number; t: number }>();
  for (const [key, counts] of substageMap) {
    const parts = key.split('|');
    const flatStageKey = `${parts[0]}|${parts[1]}`;
    let entry = flatStageMap.get(flatStageKey);
    if (!entry) { entry = { c: 0, y: 0, t: 0 }; flatStageMap.set(flatStageKey, entry); }
    entry.t++;
    const sub = rollup(counts.c, counts.y, counts.t);
    if (sub.label === 'completed') entry.c++;
    else if (sub.label === 'yet_to_start') entry.y++;
  }

  // Level 3: Flats → Floor's Stage status
  // Key: `floor|stage`
  const floorStageMap = new Map<string, { c: number; y: number; t: number }>();
  for (const [key, counts] of flatStageMap) {
    const parts = key.split('|');
    const flat = parts[0];
    const stage = parts[1];
    const floorNum = applicable.find(a => String(a.flat_number) === flat && a.stage === stage)?.floor;
    if (floorNum === undefined) continue;
    const floorStageKey = `${floorNum}|${stage}`;
    let entry = floorStageMap.get(floorStageKey);
    if (!entry) { entry = { c: 0, y: 0, t: 0 }; floorStageMap.set(floorStageKey, entry); }
    entry.t++;
    const flatStatus = rollup(counts.c, counts.y, counts.t);
    if (flatStatus.label === 'completed') entry.c++;
    else if (flatStatus.label === 'yet_to_start') entry.y++;
  }

  // Build floor rows
  const floorRows: FloorRow[] = floorNumbers.map(floor => {
    const stageStatuses: Record<string, RollupCell> = {};
    let allCompleted = true;
    let anyStarted = false;

    for (const stage of stages) {
      const key = `${floor}|${stage}`;
      const entry = floorStageMap.get(key);
      if (entry) {
        stageStatuses[stage] = rollup(entry.c, entry.y, entry.t);
      } else {
        stageStatuses[stage] = { label: 'yet_to_start', completed: 0, running: 0, total: 0 };
      }
      if (stageStatuses[stage].label !== 'completed') allCompleted = false;
      if (stageStatuses[stage].label !== 'yet_to_start') anyStarted = true;
    }

    let readiness: 'completed' | 'running' | 'not_ready';
    if (allCompleted) readiness = 'completed';
    else if (anyStarted) readiness = 'running';
    else readiness = 'not_ready';

    return { floor, stages: stageStatuses, readiness };
  });

  // Stage Wise Completion (Floors): per stage, how many floors are completed
  const stageCompletionFloors: Record<string, RollupCell> = {};
  for (const stage of stages) {
    let c = 0, y = 0, t = 0;
    for (const row of floorRows) {
      const cell = row.stages[stage];
      if (!cell || cell.total === 0) continue;
      t++;
      if (cell.label === 'completed') c++;
      else if (cell.label === 'yet_to_start') y++;
    }
    stageCompletionFloors[stage] = rollup(c, y, t);
  }

  // Stage Wise Completion (Units): per stage, how many flats are completed
  const stageCompletionUnits: Record<string, RollupCell> = {};
  for (const stage of stages) {
    let c = 0, y = 0, t = 0;
    for (const [key, counts] of flatStageMap) {
      if (key.split('|')[1] !== stage) continue;
      t++;
      const flatStatus = rollup(counts.c, counts.y, counts.t);
      if (flatStatus.label === 'completed') c++;
      else if (flatStatus.label === 'yet_to_start') y++;
    }
    stageCompletionUnits[stage] = rollup(c, y, t);
  }

  const floorsFullyReady = floorRows.filter(r => r.readiness === 'completed').length;
  const floorsInProgress = floorRows.filter(r => r.readiness === 'running').length;

  return {
    stages,
    floors: floorRows,
    stageCompletionFloors,
    stageCompletionUnits,
    floorsFullyReady,
    floorsInProgress,
  };
}

export function computeHeatmapFromRollup(rollupData: SubstageRollup[], stagesList: string[]): HeatmapData {
  if (rollupData.length === 0) {
    return { stages: [], floors: [], stageCompletionFloors: {}, stageCompletionUnits: {}, floorsFullyReady: 0, floorsInProgress: 0 };
  }

  const stages = stagesList.length > 0 ? stagesList : [...new Set(rollupData.map(r => r.stage))];
  const floorNumbers = [...new Set(rollupData.map(r => r.floor))].sort((a, b) => a - b);

  const substageMap = new Map<string, { c: number; y: number; t: number }>();
  for (const r of rollupData) {
    const key = `${r.flat_number}|${r.stage}|${r.stage_gate}`;
    substageMap.set(key, { c: r.completed, y: r.yet_to_start, t: r.total });
  }

  const flatStageMap = new Map<string, { c: number; y: number; t: number }>();
  for (const [key, counts] of substageMap) {
    const parts = key.split('|');
    const flatStageKey = `${parts[0]}|${parts[1]}`;
    let entry = flatStageMap.get(flatStageKey);
    if (!entry) { entry = { c: 0, y: 0, t: 0 }; flatStageMap.set(flatStageKey, entry); }
    entry.t++;
    const sub = rollup(counts.c, counts.y, counts.t);
    if (sub.label === 'completed') entry.c++;
    else if (sub.label === 'yet_to_start') entry.y++;
  }

  const flatFloorMap = new Map<string, number>();
  for (const r of rollupData) {
    flatFloorMap.set(String(r.flat_number), r.floor);
  }

  const floorStageMap = new Map<string, { c: number; y: number; t: number }>();
  for (const [key, counts] of flatStageMap) {
    const parts = key.split('|');
    const flat = parts[0];
    const stage = parts[1];
    const floorNum = flatFloorMap.get(flat);
    if (floorNum === undefined) continue;
    const floorStageKey = `${floorNum}|${stage}`;
    let entry = floorStageMap.get(floorStageKey);
    if (!entry) { entry = { c: 0, y: 0, t: 0 }; floorStageMap.set(floorStageKey, entry); }
    entry.t++;
    const flatStatus = rollup(counts.c, counts.y, counts.t);
    if (flatStatus.label === 'completed') entry.c++;
    else if (flatStatus.label === 'yet_to_start') entry.y++;
  }

  const floorRows: FloorRow[] = floorNumbers.map(floor => {
    const stageStatuses: Record<string, RollupCell> = {};
    let allCompleted = true;
    let anyStarted = false;

    for (const stage of stages) {
      const key = `${floor}|${stage}`;
      const entry = floorStageMap.get(key);
      if (entry) {
        stageStatuses[stage] = rollup(entry.c, entry.y, entry.t);
      } else {
        stageStatuses[stage] = { label: 'yet_to_start', completed: 0, running: 0, total: 0 };
      }
      if (stageStatuses[stage].label !== 'completed') allCompleted = false;
      if (stageStatuses[stage].label !== 'yet_to_start') anyStarted = true;
    }

    let readiness: 'completed' | 'running' | 'not_ready';
    if (allCompleted) readiness = 'completed';
    else if (anyStarted) readiness = 'running';
    else readiness = 'not_ready';

    return { floor, stages: stageStatuses, readiness };
  });

  const stageCompletionFloors: Record<string, RollupCell> = {};
  for (const stage of stages) {
    let c = 0, y = 0, t = 0;
    for (const row of floorRows) {
      const cell = row.stages[stage];
      if (!cell || cell.total === 0) continue;
      t++;
      if (cell.label === 'completed') c++;
      else if (cell.label === 'yet_to_start') y++;
    }
    stageCompletionFloors[stage] = rollup(c, y, t);
  }

  const stageCompletionUnits: Record<string, RollupCell> = {};
  for (const stage of stages) {
    let c = 0, y = 0, t = 0;
    for (const [key, counts] of flatStageMap) {
      if (key.split('|')[1] !== stage) continue;
      t++;
      const flatStatus = rollup(counts.c, counts.y, counts.t);
      if (flatStatus.label === 'completed') c++;
      else if (flatStatus.label === 'yet_to_start') y++;
    }
    stageCompletionUnits[stage] = rollup(c, y, t);
  }

  const floorsFullyReady = floorRows.filter(r => r.readiness === 'completed').length;
  const floorsInProgress = floorRows.filter(r => r.readiness === 'running').length;

  return { stages, floors: floorRows, stageCompletionFloors, stageCompletionUnits, floorsFullyReady, floorsInProgress };
}
