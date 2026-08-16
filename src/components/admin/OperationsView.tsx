'use client';

import { memo, useState, useMemo } from 'react';
import type { OperationsData, ActionItem } from '@/lib/insights-data';
import type { SupervisorPulse, RecentReversal, SiteActivityEntry } from '@/repositories/audit-repo';
import { STATUS_RANK } from '@/lib/constants';

// ---- Types for grouped site activity ----

interface FloorActivityGroup {
  floor: number;
  activities: {
    activityName: string;
    stage: string;
    started: number[];   // flat numbers
    completed: number[]; // flat numbers
    reversed: number[];  // flat numbers
  }[];
  startedCount: number;
  completedCount: number;
  reversedCount: number;
}

type TimeRange = 'today' | 'week' | 'month';

// ---- Helpers ----

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function isStartTransition(oldStatus: string, newStatus: string): boolean {
  const oldRank = STATUS_RANK[oldStatus] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;
  return oldRank === 0 && newRank >= 1; // not_started/delayed → in_progress+
}

function isCompleteTransition(_oldStatus: string, newStatus: string): boolean {
  return newStatus === 'completed' || newStatus === 'completed_delayed';
}

function isReversalTransition(oldStatus: string, newStatus: string): boolean {
  const oldRank = STATUS_RANK[oldStatus] ?? 0;
  const newRank = STATUS_RANK[newStatus] ?? 0;
  if (oldRank === -1 || newRank === -1) return false;
  return oldRank > newRank;
}

function filterByRange(entries: SiteActivityEntry[], range: TimeRange): SiteActivityEntry[] {
  let since: string;
  if (range === 'today') since = todayDate();
  else if (range === 'week') since = mondayOfWeek();
  else since = firstOfMonth();

  return entries.filter(e => e.createdAt.slice(0, 10) >= since);
}

function groupByFloor(entries: SiteActivityEntry[]): FloorActivityGroup[] {
  const floorMap = new Map<number, Map<string, {
    activityName: string;
    stage: string;
    started: Set<number>;
    completed: Set<number>;
    reversed: Set<number>;
  }>>();

  for (const e of entries) {
    if (!floorMap.has(e.floor)) floorMap.set(e.floor, new Map());
    const actMap = floorMap.get(e.floor)!;
    const key = `${e.stage}|${e.activityName}`;
    if (!actMap.has(key)) {
      actMap.set(key, { activityName: e.activityName, stage: e.stage, started: new Set(), completed: new Set(), reversed: new Set() });
    }
    const act = actMap.get(key)!;

    if (isReversalTransition(e.oldStatus, e.newStatus)) {
      act.reversed.add(e.flatNumber);
    } else if (isCompleteTransition(e.oldStatus, e.newStatus)) {
      act.completed.add(e.flatNumber);
    } else if (isStartTransition(e.oldStatus, e.newStatus)) {
      act.started.add(e.flatNumber);
    }
  }

  const groups: FloorActivityGroup[] = [];
  for (const [floor, actMap] of floorMap) {
    const activities = [...actMap.values()].map(a => ({
      activityName: a.activityName,
      stage: a.stage,
      started: [...a.started].sort((x, y) => x - y),
      completed: [...a.completed].sort((x, y) => x - y),
      reversed: [...a.reversed].sort((x, y) => x - y),
    })).filter(a => a.started.length > 0 || a.completed.length > 0 || a.reversed.length > 0);

    if (activities.length === 0) continue;

    groups.push({
      floor,
      activities,
      startedCount: activities.reduce((s, a) => s + a.started.length, 0),
      completedCount: activities.reduce((s, a) => s + a.completed.length, 0),
      reversedCount: activities.reduce((s, a) => s + a.reversed.length, 0),
    });
  }

  return groups.sort((a, b) => a.floor - b.floor);
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

// ---- KPI Tile ----

function KpiTile({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}

// ---- Floor Accordion ----

function FloorAccordion({ group }: { group: FloorActivityGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 md:p-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-700">F{group.floor}</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">Floor {group.floor}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {group.activities.length} activit{group.activities.length === 1 ? 'y' : 'ies'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary badges */}
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
            {group.reversedCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 border border-red-100">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {group.reversedCount} reversed
              </span>
            )}
          </div>

          {/* Mobile: compact counts */}
          <div className="flex md:hidden items-center gap-1.5 text-[11px] font-semibold tabular-nums">
            {group.startedCount > 0 && <span className="text-blue-600">{group.startedCount}↗</span>}
            {group.completedCount > 0 && <span className="text-emerald-600">{group.completedCount}✓</span>}
            {group.reversedCount > 0 && <span className="text-red-600">{group.reversedCount}↩</span>}
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
                      <span className="text-xs text-gray-700">
                        {act.started.map(f => `Flat ${f}`).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
                {act.completed.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-emerald-700">Completed: </span>
                      <span className="text-xs text-gray-700">
                        {act.completed.map(f => `Flat ${f}`).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
                {act.reversed.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-red-700">Reversed: </span>
                      <span className="text-xs text-gray-700">
                        {act.reversed.map(f => `Flat ${f}`).join(', ')}
                      </span>
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

// ---- Main Component ----

interface Props {
  data: OperationsData;
  supervisors: SupervisorPulse[];
  reversals: RecentReversal[];
  siteActivity: SiteActivityEntry[];
}

function OperationsView({ data, supervisors, reversals, siteActivity }: Props) {
  const { delayReasons, actionItems, kpi } = data;
  const maxReasonCount = delayReasons.length > 0 ? delayReasons[0].count : 1;

  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const rangeLabel = timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This Week' : 'This Month';

  // Filter + group entries by selected time range
  const { floors, startedTotal, completedTotal } = useMemo(() => {
    const filtered = filterByRange(siteActivity, timeRange);
    const grouped = groupByFloor(filtered);
    return {
      floors: grouped,
      startedTotal: grouped.reduce((s, g) => s + g.startedCount, 0),
      completedTotal: grouped.reduce((s, g) => s + g.completedCount, 0),
    };
  }, [siteActivity, timeRange]);

  return (
    <div className="space-y-6">

      {/* ---- KPI TILES ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiTile
          label={`Started ${rangeLabel}`}
          value={startedTotal}
          color="bg-blue-50"
          icon={<svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>}
        />
        <KpiTile
          label={`Completed ${rangeLabel}`}
          value={completedTotal}
          color="bg-emerald-50"
          icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
        />
        <KpiTile
          label="In Progress"
          value={kpi.inProgress}
          color="bg-amber-50"
          icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
        />
        <KpiTile
          label="Overdue"
          value={kpi.overdue}
          color="bg-red-50"
          icon={<svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
        />
      </div>

      {/* ---- SITE ACTIVITY (tabbed) ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-gray-900">Site Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Floor → Activity → Unit drill-down</p>
            </div>
          </div>

          {/* Time range tabs */}
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

      {/* ---- NEEDS YOUR ATTENTION ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold text-gray-900">Needs Your Attention</h3>
              <p className="text-xs text-gray-400 mt-0.5">Priority items that require action today</p>
            </div>
          </div>
        </div>

        {actionItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">All clear — no urgent actions today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 md:p-3.5 rounded-lg border border-l-4 border-gray-100 ${severityBorder(item.severity)} bg-gray-50/50`}
              >
                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${severityDot(item.severity)}`} />
                <div className="hidden md:block mt-0.5">
                  {severityIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{item.text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- SUPERVISOR PULSE ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  {/* Desktop row */}
                  <div className="hidden md:flex items-center gap-3 py-2 px-3">
                    <span className="font-semibold text-gray-900 tabular-nums shrink-0 w-16">
                      F{r.floor}-{r.flatNumber}
                    </span>
                    <span className="text-gray-600 truncate flex-1">{r.stage}</span>
                    <span className="shrink-0 flex items-center gap-1">
                      <span className="text-red-600 font-semibold">{formatStatus(r.oldStatus)}</span>
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                      <span className="text-amber-600 font-semibold">{formatStatus(r.newStatus)}</span>
                    </span>
                    <span className="text-gray-400 tabular-nums shrink-0">{r.changedByName}</span>
                  </div>
                  {/* Mobile stacked */}
                  <div className="md:hidden py-2.5 px-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 tabular-nums">F{r.floor}-{r.flatNumber}</span>
                      <span className="flex items-center gap-1">
                        <span className="text-red-600 font-semibold">{formatStatus(r.oldStatus)}</span>
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
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

      {/* ---- DELAY ROOT CAUSE ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <h3 className="text-base md:text-lg font-bold text-gray-900">Delay Root Cause</h3>
          <p className="text-xs text-gray-400 mt-0.5">Most common reasons for activity delays</p>
        </div>

        {delayReasons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No delay reasons recorded</p>
        ) : (
          <div className="space-y-3">
            {delayReasons.slice(0, 8).map((d, i) => {
              const barWidth = (d.count / maxReasonCount) * 100;
              return (
                <div key={d.reason} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-800 font-medium truncate max-w-[60%]">{d.reason}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 tabular-nums">{d.count}</span>
                      <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{d.pct}%</span>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-50 rounded-full overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: i === 0 ? '#EF4444' : i === 1 ? '#F97316' : i === 2 ? '#F59E0B' : '#94A3B8',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(OperationsView);
