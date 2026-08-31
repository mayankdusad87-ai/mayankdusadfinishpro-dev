'use client';

import { memo, useState, useMemo } from 'react';
import type { OperationsData, ActionItem, InProgressDetail } from '@/lib/insights-data';
import type { SupervisorPulse, RecentReversal } from '@/repositories/audit-repo';
import type { InsightRow } from '@/repositories/activity-repo';

// ---- Types ----

interface FloorActivityGroup {
  floor: number;
  activities: {
    activityName: string;
    stage: string;
    started: number[];
    completed: number[];
  }[];
  startedCount: number;
  completedCount: number;
}

interface InProgressFloorGroup {
  floor: number;
  activities: {
    activityName: string;
    stage: string;
    units: number[];
  }[];
  totalUnits: number;
}

type TimeRange = 'today' | 'week' | 'month';
type ExpandedTile = 'started' | 'completed' | 'inProgress' | null;

// ---- Completion Velocity types ----

const VELOCITY_STAGES = [
  'Pre-Tiling',
  'Tiling',
  'Post Tiling',
  'Pre Paint Activities',
  '1st coat paint',
] as const;

interface VelocityFloorDetail {
  floor: number;
  flats: number[];
}

interface VelocityStageRow {
  stage: string;
  thisWeek: number;
  lastWeek: number;
  thisWeekFloors: VelocityFloorDetail[];
  lastWeekFloors: VelocityFloorDetail[];
}

interface VelocityData {
  stages: VelocityStageRow[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  thisWeekRange: string;  // e.g. "25 – 31 Aug"
  lastWeekRange: string;
}

// ---- Helpers (actual_start / actual_end based) ----

/** Local YYYY-MM-DD (avoids UTC shift that .toISOString() causes in IST) */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayDate(): string {
  return localDateStr(new Date());
}

function mondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return localDateStr(d);
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function sinceDate(range: TimeRange): string {
  if (range === 'today') return todayDate();
  if (range === 'week') return mondayOfWeek();
  return firstOfMonth();
}

/** Get activities that started within the given range (since <= actual_start <= today) */
function getStartedInRange(rows: InsightRow[], range: TimeRange): InsightRow[] {
  const since = sinceDate(range);
  const today = todayDate();
  return rows.filter(r => {
    if (!r.actual_start) return false;
    const d = r.actual_start.slice(0, 10);
    return d >= since && d <= today;
  });
}

/** Get activities that completed within the given range (since <= actual_end <= today) */
function getCompletedInRange(rows: InsightRow[], range: TimeRange): InsightRow[] {
  const since = sinceDate(range);
  const today = todayDate();
  return rows.filter(r => {
    if (!r.actual_end) return false;
    const d = r.actual_end.slice(0, 10);
    return d >= since && d <= today;
  });
}

/** Group InsightRows into FloorActivityGroups for the Site Activity drill-down */
function groupByFloor(started: InsightRow[], completed: InsightRow[]): FloorActivityGroup[] {
  const floorMap = new Map<number, Map<string, {
    activityName: string;
    stage: string;
    started: Set<number>;
    completed: Set<number>;
  }>>();

  function addToMap(rows: InsightRow[], bucket: 'started' | 'completed') {
    for (const r of rows) {
      if (!floorMap.has(r.floor)) floorMap.set(r.floor, new Map());
      const actMap = floorMap.get(r.floor)!;
      const key = `${r.stage}|${r.activity}`;
      if (!actMap.has(key)) {
        actMap.set(key, { activityName: r.activity, stage: r.stage, started: new Set(), completed: new Set() });
      }
      actMap.get(key)![bucket].add(r.flat_number);
    }
  }

  addToMap(started, 'started');
  addToMap(completed, 'completed');

  const groups: FloorActivityGroup[] = [];
  for (const [floor, actMap] of floorMap) {
    const activities = [...actMap.values()].map(a => ({
      activityName: a.activityName,
      stage: a.stage,
      started: [...a.started].sort((x, y) => x - y),
      completed: [...a.completed].sort((x, y) => x - y),
    })).filter(a => a.started.length > 0 || a.completed.length > 0);

    if (activities.length === 0) continue;

    groups.push({
      floor,
      activities,
      startedCount: activities.reduce((s, a) => s + a.started.length, 0),
      completedCount: activities.reduce((s, a) => s + a.completed.length, 0),
    });
  }

  return groups.sort((a, b) => a.floor - b.floor);
}

/** Group in-progress details (from current status, not audit) into floor groups */
function groupInProgressByFloor(details: InProgressDetail[]): InProgressFloorGroup[] {
  const floorMap = new Map<number, Map<string, { activityName: string; stage: string; units: Set<number> }>>();

  for (const d of details) {
    if (!floorMap.has(d.floor)) floorMap.set(d.floor, new Map());
    const actMap = floorMap.get(d.floor)!;
    const key = `${d.stage}|${d.activityName}`;
    if (!actMap.has(key)) {
      actMap.set(key, { activityName: d.activityName, stage: d.stage, units: new Set() });
    }
    actMap.get(key)!.units.add(d.flatNumber);
  }

  const groups: InProgressFloorGroup[] = [];
  for (const [floor, actMap] of floorMap) {
    const activities = [...actMap.values()].map(a => ({
      activityName: a.activityName,
      stage: a.stage,
      units: [...a.units].sort((x, y) => x - y),
    }));
    // Count distinct flats across all activities (not sum of per-activity counts)
    const distinctFlats = new Set<number>();
    for (const a of activities) for (const u of a.units) distinctFlats.add(u);
    groups.push({
      floor,
      activities,
      totalUnits: distinctFlats.size,
    });
  }

  return groups.sort((a, b) => a.floor - b.floor);
}

/** Build subtitle like "Plumbing (F5), Tiling (F7)" from InsightRows */
function buildSubtitle(rows: InsightRow[], maxItems = 3): string {
  if (rows.length === 0) return 'No activity';

  // Group by activity name → set of floors
  const actFloors = new Map<string, Set<number>>();
  for (const r of rows) {
    if (!actFloors.has(r.activity)) actFloors.set(r.activity, new Set());
    actFloors.get(r.activity)!.add(r.floor);
  }

  const items = [...actFloors.entries()].map(([name, floors]) => {
    const fStr = [...floors].sort((a, b) => a - b).map(f => `F${f}`).join(', ');
    return `${name} (${fStr})`;
  });

  if (items.length <= maxItems) return items.join(', ');
  return items.slice(0, maxItems).join(', ') + ` +${items.length - maxItems} more`;
}

function buildInProgressSubtitle(details: InProgressDetail[]): string {
  if (details.length === 0) return 'No activities in progress';
  const uniqueFloors = new Set(details.map(d => d.floor));
  const uniqueActivities = new Set(details.map(d => d.activityName));

  if (uniqueActivities.size <= 3) {
    // List activity names with floors
    const actFloors = new Map<string, Set<number>>();
    for (const d of details) {
      if (!actFloors.has(d.activityName)) actFloors.set(d.activityName, new Set());
      actFloors.get(d.activityName)!.add(d.floor);
    }
    return [...actFloors.entries()].map(([name, floors]) => {
      const fStr = [...floors].sort((a, b) => a - b).slice(0, 4).map(f => `F${f}`).join(', ');
      return `${name} (${fStr}${floors.size > 4 ? '…' : ''})`;
    }).join(', ');
  }

  return `${uniqueActivities.size} activities across ${uniqueFloors.size} floors`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ---- Completion Velocity computation ----

/** Format a date range like "25 – 31 Aug" */
function formatWeekRange(monday: Date, sunday: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d1 = monday.getDate();
  const d2 = sunday.getDate();
  const m1 = months[monday.getMonth()];
  const m2 = months[sunday.getMonth()];
  if (m1 === m2) return `${d1} – ${d2} ${m1}`;
  return `${d1} ${m1} – ${d2} ${m2}`;
}

function computeVelocity(rows: InsightRow[]): VelocityData {
  const now = new Date();

  // This week: Monday to Sunday
  const thisMonday = new Date(now);
  const day = thisMonday.getDay();
  thisMonday.setDate(thisMonday.getDate() - day + (day === 0 ? -6 : 1));
  thisMonday.setHours(0, 0, 0, 0);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisSunday.getDate() + 6);

  // Last week
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);

  const thisStart = localDateStr(thisMonday);
  const thisEnd = localDateStr(thisSunday);
  const lastStart = localDateStr(lastMonday);
  const lastEnd = localDateStr(lastSunday);

  // Only completed activities (completed or completed_delayed)
  const completed = rows.filter(r => {
    const s = r.status;
    return (s === 'completed' || s === 'completed_delayed') && r.actual_end;
  });

  const stages: VelocityStageRow[] = VELOCITY_STAGES.map(stage => {
    const stageRows = completed.filter(r => r.stage === stage);

    // This week: distinct flats with actual_end in [thisStart, thisEnd]
    const thisWeekRows = stageRows.filter(r => {
      const d = r.actual_end.slice(0, 10);
      return d >= thisStart && d <= thisEnd;
    });
    // Last week
    const lastWeekRows = stageRows.filter(r => {
      const d = r.actual_end.slice(0, 10);
      return d >= lastStart && d <= lastEnd;
    });

    // Group by floor → distinct flat numbers
    function groupByFloor(filtered: InsightRow[]): VelocityFloorDetail[] {
      const floorMap = new Map<number, Set<number>>();
      for (const r of filtered) {
        if (!floorMap.has(r.floor)) floorMap.set(r.floor, new Set());
        floorMap.get(r.floor)!.add(r.flat_number);
      }
      return [...floorMap.entries()]
        .map(([floor, flats]) => ({ floor, flats: [...flats].sort((a, b) => a - b) }))
        .sort((a, b) => a.floor - b.floor);
    }

    const thisWeekFloors = groupByFloor(thisWeekRows);
    const lastWeekFloors = groupByFloor(lastWeekRows);

    // Count distinct flats (not activities)
    const thisWeekFlats = new Set<string>();
    for (const r of thisWeekRows) thisWeekFlats.add(`${r.floor}-${r.flat_number}`);
    const lastWeekFlats = new Set<string>();
    for (const r of lastWeekRows) lastWeekFlats.add(`${r.floor}-${r.flat_number}`);

    return {
      stage,
      thisWeek: thisWeekFlats.size,
      lastWeek: lastWeekFlats.size,
      thisWeekFloors,
      lastWeekFloors,
    };
  });

  return {
    stages,
    thisWeekTotal: stages.reduce((s, r) => s + r.thisWeek, 0),
    lastWeekTotal: stages.reduce((s, r) => s + r.lastWeek, 0),
    thisWeekRange: formatWeekRange(thisMonday, thisSunday),
    lastWeekRange: formatWeekRange(lastMonday, lastSunday),
  };
}

// ---- Sub-components ----

function severityDot(severity: ActionItem['severity']) {
  if (severity === 'critical') return 'bg-red-500';
  if (severity === 'warning') return 'bg-amber-400';
  return 'bg-blue-400';
}

function severityBorder(severity: ActionItem['severity']) {
  if (severity === 'critical') return 'border-l-red-500';
  if (severity === 'warning') return 'border-l-amber-400';
  return 'border-l-blue-400';
}

function severityIcon(type: ActionItem['type']) {
  switch (type) {
    case 'floor':
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
        </svg>
      );
    case 'vendor':
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      );
    case 'reversal':
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
  }
}

function supervisorStatusBadge(status: SupervisorPulse['status']) {
  switch (status) {
    case 'active':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">● Active</span>;
    case 'slow':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">● Slow</span>;
    case 'inactive':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">● Inactive</span>;
  }
}

function timeAgo(isoDate: string | null): string {
  if (!isoDate) return 'Never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ---- KPI Tile (clickable, with subtitle + accordion) ----

interface KpiTileProps {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  borderAccent: string;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function KpiTile({ label, value, subtitle, icon, gradient, iconBg, borderAccent, isExpanded, onToggle, children }: KpiTileProps) {
  return (
    <div className="col-span-1">
      <button
        onClick={onToggle}
        className={`w-full text-left rounded-xl border-2 transition-all duration-200 cursor-pointer ${
          isExpanded ? `${borderAccent} shadow-md` : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
        }`}
      >
        <div className={`p-4 md:p-5 rounded-t-[10px] ${isExpanded ? '' : 'rounded-b-[10px]'} ${gradient}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tabular-nums leading-none">{value}</div>
              <div className="text-xs font-semibold text-gray-600 mt-1.5 uppercase tracking-wider">{label}</div>
              <p className="text-[11px] text-gray-500 mt-1 truncate leading-relaxed" title={subtitle}>{subtitle}</p>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ml-3 ${iconBg}`}>
              {icon}
            </div>
          </div>
          {/* Expand indicator */}
          {value > 0 && (
            <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-black/5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {isExpanded ? 'Collapse' : 'View detail'}
              </span>
              <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          )}
        </div>
      </button>

      {/* Accordion content */}
      {isExpanded && children && (
        <div className={`border-2 border-t-0 rounded-b-xl ${borderAccent} bg-white overflow-hidden`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ---- Floor Accordion (for Site Activity section) ----

function FloorAccordion({ group }: { group: FloorActivityGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 md:p-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#162032] to-[#1e2d45] flex items-center justify-center">
            <span className="text-sm font-bold text-white">F{group.floor}</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">Floor {group.floor}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {group.activities.length} activit{group.activities.length === 1 ? 'y' : 'ies'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            {group.startedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {group.startedCount} started
              </span>
            )}
            {group.completedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {group.completedCount} completed
              </span>
            )}
          </div>
          <div className="flex md:hidden items-center gap-1.5 text-[11px] font-semibold tabular-nums">
            {group.startedCount > 0 && <span className="text-blue-600">{group.startedCount}↗</span>}
            {group.completedCount > 0 && <span className="text-emerald-600">{group.completedCount}✓</span>}
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/30 divide-y divide-gray-100">
          {group.activities.map((act, i) => (
            <div key={i} className="px-4 py-3 md:px-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{act.stage}</span>
                <span className="text-gray-300">·</span>
                <span className="text-sm font-semibold text-gray-800">{act.activityName}</span>
              </div>
              <div className="space-y-1.5 pl-0 md:pl-2">
                {act.started.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-blue-700">Started: </span>
                      <span className="text-xs text-gray-700">{act.started.map(f => `Flat ${f}`).join(', ')}</span>
                    </div>
                  </div>
                )}
                {act.completed.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-emerald-700">Completed: </span>
                      <span className="text-xs text-gray-700">{act.completed.map(f => `Flat ${f}`).join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Drill-down content for KPI tiles ----

/** Floor drill-down for Started / Completed tiles (from actual dates) */
function DateDrillDown({ floors, type }: { floors: FloorActivityGroup[]; type: 'started' | 'completed' }) {
  if (floors.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-gray-400">No {type === 'started' ? 'starts' : 'completions'} recorded</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50 max-h-[340px] overflow-y-auto">
      {floors.map(group => {
        const relevantActivities = group.activities
          .map(a => ({
            ...a,
            units: type === 'started' ? a.started : a.completed,
          }))
          .filter(a => a.units.length > 0);

        if (relevantActivities.length === 0) return null;

        return (
          <div key={group.floor} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-[#162032] to-[#1e2d45] text-[10px] font-bold text-white">
                F{group.floor}
              </span>
              <span className="text-sm font-bold text-gray-800">Floor {group.floor}</span>
              <span className="text-[10px] text-gray-400 ml-auto tabular-nums">
                {relevantActivities.reduce((s, a) => s + a.units.length, 0)} unit{relevantActivities.reduce((s, a) => s + a.units.length, 0) !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1.5 pl-9">
              {relevantActivities.map((act, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${type === 'started' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-700">{act.activityName}</span>
                    <span className="text-[10px] text-gray-400 ml-1">({act.stage})</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {act.units.map(u => (
                        <span key={u} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                          type === 'started'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Floor drill-down for In Progress tile (from current activity status) */
function InProgressDrillDown({ groups }: { groups: InProgressFloorGroup[] }) {
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null);

  if (groups.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-gray-400">No activities in progress</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50 max-h-[340px] overflow-y-auto">
      {groups.map(group => (
        <div key={group.floor}>
          <button
            onClick={() => setExpandedFloor(expandedFloor === group.floor ? null : group.floor)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-[#162032] to-[#1e2d45] text-[10px] font-bold text-white">
                F{group.floor}
              </span>
              <span className="text-sm font-bold text-gray-800">Floor {group.floor}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-amber-600 tabular-nums">
                {group.totalUnits} unit{group.totalUnits !== 1 ? 's' : ''} · {group.activities.length} activit{group.activities.length === 1 ? 'y' : 'ies'}
              </span>
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandedFloor === group.floor ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </button>
          {expandedFloor === group.floor && (
            <div className="px-4 pb-3 space-y-1.5 pl-13">
              {group.activities.map((act, i) => (
                <div key={i} className="flex items-start gap-2 pl-9">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-700">{act.activityName}</span>
                    <span className="text-[10px] text-gray-400 ml-1">({act.stage})</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {act.units.map(u => (
                        <span key={u} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums bg-amber-50 text-amber-700">
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Main Component ----

interface Props {
  data: OperationsData;
  supervisors: SupervisorPulse[];
  reversals: RecentReversal[];
  activityRows: InsightRow[];
}

function OperationsView({ data, supervisors, reversals, activityRows }: Props) {
  const { actionItems, kpi } = data;

  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [expandedTile, setExpandedTile] = useState<ExpandedTile>(null);

  // Activities started/completed today (for KPI tiles)
  const startedToday = useMemo(() => getStartedInRange(activityRows, 'today'), [activityRows]);
  const completedToday = useMemo(() => getCompletedInRange(activityRows, 'today'), [activityRows]);

  // Activities started/completed in selected time range (for Site Activity section)
  const { floors, startedTotal, completedTotal } = useMemo(() => {
    const started = getStartedInRange(activityRows, timeRange);
    const completed = getCompletedInRange(activityRows, timeRange);
    const grouped = groupByFloor(started, completed);
    return {
      floors: grouped,
      startedTotal: grouped.reduce((s, g) => s + g.startedCount, 0),
      completedTotal: grouped.reduce((s, g) => s + g.completedCount, 0),
    };
  }, [activityRows, timeRange]);

  // Grouped floors for Started Today drill-down
  const startedTodayFloors = useMemo(() => groupByFloor(startedToday, []), [startedToday]);

  // Grouped floors for Completed Today drill-down
  const completedTodayFloors = useMemo(() => groupByFloor([], completedToday), [completedToday]);

  // In progress floor groups
  const inProgressGroups = useMemo(() => groupInProgressByFloor(kpi.inProgressDetails), [kpi.inProgressDetails]);

  // KPI counts
  const startedTodayCount = startedToday.length;
  const completedTodayCount = completedToday.length;

  // Subtitles
  const startedSubtitle = buildSubtitle(startedToday);
  const completedSubtitle = buildSubtitle(completedToday);
  const inProgressSubtitle = buildInProgressSubtitle(kpi.inProgressDetails);

  // Completion Velocity
  const velocity = useMemo(() => computeVelocity(activityRows), [activityRows]);
  const [expandedVelocityStage, setExpandedVelocityStage] = useState<string | null>(null);

  function toggleTile(tile: ExpandedTile) {
    setExpandedTile(prev => prev === tile ? null : tile);
  }

  return (
    <div className="space-y-6">

      {/* ---- KPI TILES (3 tiles, clickable with accordion) ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile
          label="Started Today"
          value={startedTodayCount}
          subtitle={startedSubtitle}
          gradient="bg-gradient-to-br from-blue-50 via-white to-indigo-50/50"
          iconBg="bg-gradient-to-br from-blue-500 to-indigo-600"
          borderAccent="border-blue-400"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>}
          isExpanded={expandedTile === 'started'}
          onToggle={() => toggleTile('started')}
        >
          <DateDrillDown floors={startedTodayFloors} type="started" />
        </KpiTile>

        <KpiTile
          label="Completed Today"
          value={completedTodayCount}
          subtitle={completedSubtitle}
          gradient="bg-gradient-to-br from-emerald-50 via-white to-teal-50/50"
          iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
          borderAccent="border-emerald-400"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
          isExpanded={expandedTile === 'completed'}
          onToggle={() => toggleTile('completed')}
        >
          <DateDrillDown floors={completedTodayFloors} type="completed" />
        </KpiTile>

        <KpiTile
          label="In Progress"
          value={kpi.inProgress}
          subtitle={inProgressSubtitle}
          gradient="bg-gradient-to-br from-amber-50 via-white to-orange-50/50"
          iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
          borderAccent="border-amber-400"
          icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
          isExpanded={expandedTile === 'inProgress'}
          onToggle={() => toggleTile('inProgress')}
        >
          <InProgressDrillDown groups={inProgressGroups} />
        </KpiTile>
      </div>

      {/* ---- SITE ACTIVITY (tabbed) ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#162032] to-[#1e2d45] flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-[#C8922A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-gray-900">Site Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Floor → Activity → Unit drill-down</p>
            </div>
          </div>

          <div className="flex bg-gray-100 rounded-lg p-0.5 self-start">
            {(['today', 'week', 'month'] as TimeRange[]).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  timeRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {floors.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No status changes recorded {timeRange === 'today' ? 'today' : timeRange === 'week' ? 'this week' : 'this month'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {floors.map(group => (
              <FloorAccordion key={group.floor} group={group} />
            ))}
          </div>
        )}
      </div>

      {/* ---- NEEDS YOUR ATTENTION — disabled, not being used ---- */}
      {/*
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        ...
      </div>
      */}

      {/* ---- SUPERVISOR PULSE ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-gray-900">Supervisor Pulse</h3>
              <p className="text-xs text-gray-400 mt-0.5">Activity tracker — updates in the last 7 days</p>
            </div>
          </div>
        </div>

        {supervisors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No supervisors assigned to this project</p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Supervisor</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Assigned Floors</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Updates / Week</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Last Update</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisors.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            s.status === 'active' ? 'bg-emerald-500' : s.status === 'slow' ? 'bg-amber-500' : 'bg-gray-400'
                          }`}>
                            {initials(s.name)}
                          </div>
                          <span className="font-semibold text-gray-900 truncate max-w-[160px]">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {s.floors.length > 0
                          ? s.floors.map(f => `F${f}`).join(', ')
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-bold tabular-nums ${
                          s.updatesThisWeek >= 20 ? 'text-emerald-600' : s.updatesThisWeek > 0 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {s.updatesThisWeek}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-500 text-xs tabular-nums">
                        {timeAgo(s.lastUpdateAt)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {supervisorStatusBadge(s.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-3">
              {supervisors.map(s => (
                <div key={s.id} className={`rounded-lg border p-3.5 ${
                  s.status === 'inactive' ? 'border-red-100 bg-red-50/30' :
                  s.status === 'slow' ? 'border-amber-100 bg-amber-50/30' :
                  'border-gray-100'
                }`}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                        s.status === 'active' ? 'bg-emerald-500' : s.status === 'slow' ? 'bg-amber-500' : 'bg-gray-400'
                      }`}>
                        {initials(s.name)}
                      </div>
                      <span className="text-sm font-bold text-gray-900 truncate max-w-[140px]">{s.name}</span>
                    </div>
                    {supervisorStatusBadge(s.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Floors</div>
                      <div className="text-[11px] font-semibold text-gray-800 mt-0.5">
                        {s.floors.length > 0 ? s.floors.map(f => `F${f}`).join(', ') : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Updates</div>
                      <div className={`text-sm font-bold mt-0.5 tabular-nums ${
                        s.updatesThisWeek >= 20 ? 'text-emerald-600' : s.updatesThisWeek > 0 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {s.updatesThisWeek}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Last</div>
                      <div className="text-[11px] font-semibold text-gray-500 mt-0.5 tabular-nums">
                        {timeAgo(s.lastUpdateAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Reversals sub-section */}
        {reversals.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Recent Reversals</span>
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-200 tabular-nums">
                {reversals.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {reversals.slice(0, 5).map((r, i) => (
                <div key={i} className="rounded-md bg-red-50/40 text-xs">
                  <div className="hidden md:flex items-center gap-3 py-2 px-3">
                    <span className="font-semibold text-gray-900 tabular-nums shrink-0 w-16">F{r.floor}-{r.flatNumber}</span>
                    <span className="text-gray-600 truncate flex-1">{r.stage}</span>
                    <span className="shrink-0 flex items-center gap-1">
                      <span className="text-red-600 font-semibold">{formatStatus(r.oldStatus)}</span>
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                      <span className="text-amber-600 font-semibold">{formatStatus(r.newStatus)}</span>
                    </span>
                    <span className="text-gray-400 tabular-nums shrink-0">{r.changedByName}</span>
                  </div>
                  <div className="md:hidden py-2.5 px-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 tabular-nums">F{r.floor}-{r.flatNumber}</span>
                      <span className="flex items-center gap-1">
                        <span className="text-red-600 font-semibold">{formatStatus(r.oldStatus)}</span>
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                        <span className="text-amber-600 font-semibold">{formatStatus(r.newStatus)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="truncate">{r.stage}</span>
                      <span className="shrink-0 ml-2 tabular-nums">{r.changedByName}</span>
                    </div>
                  </div>
                </div>
              ))}
              {reversals.length > 5 && (
                <p className="text-[10px] text-gray-400 text-center pt-1">
                  + {reversals.length - 5} more reversal{reversals.length - 5 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---- COMPLETION VELOCITY ---- */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 p-4 md:px-6 md:pt-6 md:pb-4 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C8922A] to-[#a07520] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900">Completion Velocity</h3>
            <p className="text-xs text-gray-400 mt-0.5">Flats completed per stage — weekly comparison</p>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          <div className="px-4 py-3 md:px-5">
            <div className="text-xl font-extrabold text-gray-900 tabular-nums">{velocity.thisWeekTotal}</div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">This Week</div>
            <div className="text-[11px] text-gray-500 tabular-nums">{velocity.thisWeekRange}</div>
          </div>
          <div className="px-4 py-3 md:px-5 text-center">
            {(() => {
              const diff = velocity.thisWeekTotal - velocity.lastWeekTotal;
              const pct = velocity.lastWeekTotal > 0
                ? Math.round(Math.abs(diff) / velocity.lastWeekTotal * 100)
                : velocity.thisWeekTotal > 0 ? 100 : 0;
              return (
                <>
                  <div className={`text-xl font-extrabold tabular-nums ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">vs Last Week</div>
                  {diff !== 0 && (
                    <div className={`text-[11px] tabular-nums ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {diff > 0 ? '↑' : '↓'} {pct}% {diff > 0 ? 'faster' : 'slower'}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="px-4 py-3 md:px-5 text-right">
            <div className="text-xl font-extrabold text-gray-400 tabular-nums">{velocity.lastWeekTotal}</div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">Last Week</div>
            <div className="text-[11px] text-gray-500 tabular-nums">{velocity.lastWeekRange}</div>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_60px_60px_44px] md:grid-cols-[1fr_80px_80px_50px] px-4 md:px-6 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Stage</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">This Wk</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Last Wk</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">Trend</span>
        </div>

        {/* Stage rows */}
        {velocity.stages.map(row => {
          const diff = row.thisWeek - row.lastWeek;
          const isExpanded = expandedVelocityStage === row.stage;
          const stalled = row.thisWeek === 0 && row.lastWeek > 0;
          return (
            <div key={row.stage}>
              <button
                className={`w-full grid grid-cols-[1fr_60px_60px_44px] md:grid-cols-[1fr_80px_80px_50px] px-4 md:px-6 py-2.5 items-center border-b border-gray-50 transition-colors text-left ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50/60'}`}
                onClick={() => setExpandedVelocityStage(isExpanded ? null : row.stage)}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                  {row.stage}
                </span>
                <span className="text-sm font-bold text-gray-900 tabular-nums text-right">{row.thisWeek}</span>
                <span className="text-sm font-semibold text-gray-400 tabular-nums text-right">{row.lastWeek}</span>
                <span className={`text-xs font-bold tabular-nums text-right flex items-center justify-end gap-0.5 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                  {diff > 0 && (
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" /></svg>
                  )}
                  {diff < 0 && (
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" /></svg>
                  )}
                  {diff !== 0 ? (diff > 0 ? `+${diff}` : `${diff}`) : '—'}
                </span>
              </button>

              {/* Expanded floor detail */}
              {isExpanded && (
                <div className="bg-gray-50 border-b border-gray-100 px-4 md:px-6 py-3 pl-10 md:pl-14">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">This Week</h5>
                      {row.thisWeekFloors.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">No completions</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.thisWeekFloors.map(f => (
                            <span key={f.floor} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-600 tabular-nums">
                              Fl {f.floor} — {f.flats.join(', ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Last Week</h5>
                      {row.lastWeekFloors.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">No completions</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.lastWeekFloors.map(f => (
                            <span key={f.floor} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-500 tabular-nums">
                              Fl {f.floor} — {f.flats.join(', ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Stalled alert */}
                  {stalled && (
                    <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-50 text-red-600">
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                      <span className="text-[11px] font-semibold">Zero completions this week — was active last week</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Total row */}
        <div className="grid grid-cols-[1fr_60px_60px_44px] md:grid-cols-[1fr_80px_80px_50px] px-4 md:px-6 py-2.5 bg-gray-50 items-center">
          <span className="text-[13px] font-bold text-gray-900 pl-5">Total</span>
          <span className="text-[15px] font-bold text-gray-900 tabular-nums text-right">{velocity.thisWeekTotal}</span>
          <span className="text-[15px] font-semibold text-gray-400 tabular-nums text-right">{velocity.lastWeekTotal}</span>
          {(() => {
            const diff = velocity.thisWeekTotal - velocity.lastWeekTotal;
            return (
              <span className={`text-xs font-extrabold tabular-nums text-right flex items-center justify-end gap-0.5 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-300'}`}>
                {diff > 0 && (
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" /></svg>
                )}
                {diff < 0 && (
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" /></svg>
                )}
                {diff !== 0 ? (diff > 0 ? `+${diff}` : `${diff}`) : '—'}
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default memo(OperationsView);
