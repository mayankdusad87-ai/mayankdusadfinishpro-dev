'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TARGET_STATUS_CONFIG,
  formatFloorRange,
  type TargetAchievementResult,
  type TargetSummary,
  type TargetStatus,
} from '@/lib/target-engine';

interface Props {
  projectId: string;
  projectName: string;
}

interface AchievementData {
  targets: TargetAchievementResult[];
  summary: TargetSummary;
}

// ---- Cache helper (SWR pattern) ----
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
function cacheKey(pid: string) { return `target_ach_${pid}`; }

function readCache(pid: string): AchievementData | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(pid));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) {
      sessionStorage.removeItem(cacheKey(pid));
      return null;
    }
    return cached.data as AchievementData;
  } catch { return null; }
}

function writeCache(pid: string, data: AchievementData) {
  try {
    sessionStorage.setItem(cacheKey(pid), JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full */ }
}

// ---- Status colors for the circular ring ----
const RING_COLORS: Record<TargetStatus, string> = {
  achieved: '#10B981',
  delayed: '#F59E0B',
  missed: '#EF4444',
  on_track: '#22C55E',
  at_risk: '#F97316',
  not_started: '#9CA3AF',
  behind: '#EF4444',
};

const DOT_COLORS: Record<TargetStatus, string> = {
  achieved: '#10B981',
  delayed: '#F59E0B',
  missed: '#EF4444',
  on_track: '#22C55E',
  at_risk: '#F97316',
  not_started: '#9CA3AF',
  behind: '#EF4444',
};

const ROW_STYLES: Record<TargetStatus, { bg: string; border: string }> = {
  achieved: { bg: 'bg-emerald-50/50', border: 'border-l-emerald-500' },
  delayed: { bg: 'bg-amber-50/40', border: 'border-l-amber-500' },
  missed: { bg: 'bg-red-50/50', border: 'border-l-red-500' },
  on_track: { bg: 'bg-green-50/30', border: 'border-l-green-500' },
  at_risk: { bg: 'bg-orange-50/40', border: 'border-l-orange-400' },
  not_started: { bg: 'bg-gray-50/40', border: 'border-l-gray-300' },
  behind: { bg: 'bg-red-50/40', border: 'border-l-red-400' },
};

// ---- Target filtering (hide old completed targets) ----
function filterTargets(targets: TargetAchievementResult[]): { visible: TargetAchievementResult[]; hidden: TargetAchievementResult[] } {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const visible: TargetAchievementResult[] = [];
  const hidden: TargetAchievementResult[] = [];

  for (const t of targets) {
    if (t.status !== 'achieved' && t.status !== 'delayed') {
      visible.push(t);
      continue;
    }
    const td = new Date(t.targetDate);
    if (td >= currentMonthStart || td >= thirtyDaysAgo) {
      visible.push(t);
    } else {
      hidden.push(t);
    }
  }
  return { visible, hidden };
}

// ---- Priority grouping (urgency-sorted sections) ----
type PrioritySection = 'needsAction' | 'active' | 'upcoming';

const PRIORITY_ORDER: Record<TargetStatus, number> = {
  missed: 0, at_risk: 1, behind: 2,
  on_track: 3, delayed: 4, achieved: 5,
  not_started: 6,
};

function groupByPriority(targets: TargetAchievementResult[]): Record<PrioritySection, TargetAchievementResult[]> {
  const groups: Record<PrioritySection, TargetAchievementResult[]> = { needsAction: [], active: [], upcoming: [] };
  for (const t of targets) {
    if (t.status === 'missed' || t.status === 'at_risk' || t.status === 'behind') groups.needsAction.push(t);
    else if (t.status === 'not_started') groups.upcoming.push(t);
    else groups.active.push(t);
  }
  groups.needsAction.sort((a, b) => PRIORITY_ORDER[a.status] - PRIORITY_ORDER[b.status] || a.daysRemaining - b.daysRemaining);
  groups.active.sort((a, b) => PRIORITY_ORDER[a.status] - PRIORITY_ORDER[b.status] || a.daysRemaining - b.daysRemaining);
  groups.upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return groups;
}

// ---- Circular progress ring (SVG) ----
function ProgressRing({ pct, status, size = 32 }: { pct: number; status: TargetStatus; size?: number }) {
  const strokeWidth = size <= 36 ? 3 : 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = RING_COLORS[status];
  const textClass = size <= 36 ? 'text-[9px]' : 'text-sm';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className={`absolute ${textClass} font-bold text-gray-900 tabular-nums`}>{pct}%</span>
    </div>
  );
}

/**
 * Read-only Target Achievement display.
 * Shows a summary strip + vertical target cards with circular progress rings.
 * Placed at the TOP of Management Insights — no CRUD here.
 */
export default function TargetAchievement({ projectId, projectName }: Props) {
  const [data, setData] = useState<AchievementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const loadedForProject = useRef<string | null>(null);

  const loadAchievements = useCallback(async (skipCache = false) => {
    if (!projectId) return;

    if (!skipCache) {
      const cached = readCache(projectId);
      if (cached) {
        setData(cached);
        setLoading(false);
        loadedForProject.current = projectId;
      } else {
        setLoading(true);
      }
    }

    try {
      const res = await fetch(`/api/targets/achievement?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to load');
      const fresh: AchievementData = await res.json();
      setData(fresh);
      writeCache(projectId, fresh);
      loadedForProject.current = projectId;
    } catch (err) {
      console.error('[TargetAchievement] load error:', err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadedForProject.current = null;
    loadAchievements();
  }, [loadAchievements]);

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
        <div className="px-5 py-3.5 bg-gray-100">
          <div className="h-4 w-44 bg-gray-200 rounded" />
        </div>
        <div className="px-3 py-2 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2.5 items-center px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
              <div className="flex-1 flex gap-2 items-center">
                <div className="h-3.5 w-24 bg-gray-100 rounded" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No targets or empty → nothing shown
  if (!data || data.targets.length === 0) return null;

  const { targets, summary } = data;
  const { visible, hidden } = filterTargets(targets);
  const groups = groupByPriority(visible);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ---- Summary strip ---- */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-[#162032] to-[#1e2d45] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-[#C8922A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Target Achievement</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="text-white font-semibold">{visible.length}</span> active targets
              {groups.needsAction.length > 0 && (
                <> · <span className="text-red-400 font-semibold">{groups.needsAction.length} needs action</span></>
              )}
            </p>
          </div>
        </div>

        {/* Status dots summary + legend toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {targets.map(t => (
              <span
                key={t.id}
                className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                style={{ backgroundColor: DOT_COLORS[t.status] }}
                title={`${t.stage}: ${TARGET_STATUS_CONFIG[t.status].label}`}
              />
            ))}
          </div>
          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend(p => !p)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="What do these statuses mean?"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18.75h.007v.008H12v-.008Z" />
            </svg>
            Legend
          </button>
        </div>
      </div>

      {/* ---- Status legend (collapsible) ---- */}
      {showLegend && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
            {([
              { status: 'on_track' as TargetStatus, desc: 'Current pace will finish before deadline' },
              { status: 'at_risk' as TargetStatus, desc: 'Work started but pace too slow to finish on time' },
              { status: 'behind' as TargetStatus, desc: 'No progress made with >30% of time elapsed' },
              { status: 'not_started' as TargetStatus, desc: 'Work hasn\'t begun yet (early in timeline)' },
              { status: 'missed' as TargetStatus, desc: 'Deadline passed, work incomplete' },
              { status: 'achieved' as TargetStatus, desc: 'All flats completed on or before target date' },
              { status: 'delayed' as TargetStatus, desc: 'All flats completed but after the target date' },
            ]).map(item => {
              const cfg = TARGET_STATUS_CONFIG[item.status];
              return (
                <div key={item.status} className="flex items-start gap-2">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div>
                    <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Chip strip ---- */}
      <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
        {groups.needsAction.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600">
            {groups.needsAction.length} needs action
          </span>
        )}
        {groups.active.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600">
            {groups.active.length} on track
          </span>
        )}
        {groups.upcoming.length > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">
            {groups.upcoming.length} upcoming
          </span>
        )}
        {hidden.length > 0 && (
          <button
            onClick={() => setShowHidden(p => !p)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-gray-400 border border-dashed border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {hidden.length} done (hidden)
            <svg className={`w-3 h-3 transition-transform ${showHidden ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* ---- Priority sections ---- */}
      <div className="px-2.5 pb-2.5 space-y-0.5">
        {groups.needsAction.length > 0 && (
          <>
            <div className="px-1.5 pt-2 pb-1">
              <span className="text-[10px] font-extrabold text-red-600 uppercase tracking-[0.08em]">▼ Needs action</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {groups.needsAction.map(t => <TargetRow key={t.id} target={t} />)}
            </div>
          </>
        )}
        {groups.active.length > 0 && (
          <>
            <div className="px-1.5 pt-2 pb-1">
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-[0.08em]">● Active</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {groups.active.map(t => <TargetRow key={t.id} target={t} />)}
            </div>
          </>
        )}
        {groups.upcoming.length > 0 && (
          <>
            <div className="px-1.5 pt-2 pb-1">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.08em]">○ Upcoming</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {groups.upcoming.map(t => <TargetRow key={t.id} target={t} />)}
            </div>
          </>
        )}
        {showHidden && hidden.length > 0 && (
          <>
            <div className="px-1.5 pt-2 pb-1">
              <span className="text-[10px] font-extrabold text-gray-300 uppercase tracking-[0.08em]">✓ Completed (older)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {hidden.map(t => <TargetRow key={t.id} target={t} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Target card sub-component ----

/** Smart "why" message for actionable statuses */
function getWhyMessage(t: TargetAchievementResult): string | null {
  // Show "why" for not_started, behind, at_risk, missed
  if (t.status !== 'missed' && t.status !== 'at_risk' && t.status !== 'not_started' && t.status !== 'behind') return null;
  // Show "why" even when delay reasons exist — they complement each other

  const sb = t.statusBreakdown;

  // not_started / behind: always say work hasn't begun
  if (t.status === 'not_started' || t.status === 'behind') {
    if (sb.inProgress > 0) {
      return `${sb.inProgress} ${sb.inProgress === 1 ? 'flat' : 'flats'} in progress but no completions yet`;
    }
    return `Work not started on any of ${t.totalFlats} flats`;
  }

  if (sb.notStarted > 0 && sb.inProgress === 0 && sb.completed === 0) {
    return `Work not started on any flat`;
  }
  if (sb.inProgress > 0 && sb.completed === 0) {
    return `${sb.inProgress} ${sb.inProgress === 1 ? 'flat' : 'flats'} in progress but no completions yet`;
  }
  if (sb.onHold > 0) {
    const gateText = t.onHoldStageGates.length > 0
      ? t.onHoldStageGates.slice(0, 2).join(', ')
      : null;
    return gateText
      ? `${sb.onHold} ${sb.onHold === 1 ? 'flat' : 'flats'} on hold — ${gateText} pending`
      : `${sb.onHold} ${sb.onHold === 1 ? 'flat' : 'flats'} on hold — blocking progress`;
  }
  return null;
}

function TargetRow({ target: t }: { target: TargetAchievementResult }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TARGET_STATUS_CONFIG[t.status];
  const rowStyle = ROW_STYLES[t.status];
  const floorLabel = formatFloorRange(t.floorFrom, t.floorTo);
  const isComplete = t.status === 'achieved' || t.status === 'delayed';

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Compact timing label
  let timingText = '';
  let timingColor = '';
  if (t.status === 'achieved') { timingText = '✓ On time'; timingColor = 'text-emerald-600'; }
  else if (t.status === 'delayed' && t.daysLate !== null) { timingText = `${t.daysLate}d late`; timingColor = 'text-amber-600'; }
  else if (t.status === 'missed') { timingText = `${Math.abs(t.daysRemaining)}d overdue`; timingColor = 'text-red-600'; }
  else if (t.status === 'not_started' && t.daysRemaining > 0) { timingText = `${t.daysRemaining}d left`; timingColor = 'text-gray-500'; }
  else if (t.status === 'behind' && t.daysRemaining > 0) { timingText = `${t.daysRemaining}d left`; timingColor = 'text-red-600'; }
  else if (t.status === 'on_track' && t.daysRemaining > 0) { timingText = `${t.daysRemaining}d left`; timingColor = 'text-green-600'; }
  else if (t.status === 'at_risk' && t.daysRemaining > 0) { timingText = `${t.daysRemaining}d left`; timingColor = 'text-orange-600'; }

  const whyMessage = getWhyMessage(t);
  const hasDetails = whyMessage || (t.delayReasons.length > 0 && !isComplete && t.status !== 'on_track') || t.notes || t.status === 'missed';
  return (
    <div className={`border-l-[3px] ${rowStyle.border} ${rowStyle.bg} rounded-r-lg self-start`}>
      {/* Collapsed row — always visible */}
      <button
        onClick={() => hasDetails && setExpanded(p => !p)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${hasDetails ? 'cursor-pointer hover:brightness-[0.97]' : 'cursor-default'}`}
      >
        <ProgressRing pct={t.progressPct} status={t.status} size={36} />

        <div className="flex-1 min-w-0">
          {/* Top line: stage name + badge + timing */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-gray-900">{t.stage}</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {timingText && (
              <span className={`text-[11px] font-bold ${timingColor} ml-auto`}>{timingText}</span>
            )}
          </div>

          {/* Bottom line: floor, flats, activity %, progress bar */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-400">{floorLabel}</span>
            <span className="text-gray-300">·</span>
            <span className="text-[11px] text-gray-600 tabular-nums">
              <strong className="text-gray-800">{t.completedFlats}/{t.totalFlats}</strong> flats
            </span>
            {t.activityPct > t.progressPct && !isComplete && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[11px] font-semibold text-emerald-600">{t.activityPct}% activities</span>
              </>
            )}
          </div>
        </div>

        {hasDetails && (
          <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="pl-14 pr-4 pb-3 space-y-2">
          {/* Target date */}
          <div className="text-[11px] text-gray-500">
            Target: <strong className="text-gray-700">{fmtDate(t.targetDate)}</strong>
            {t.status === 'not_started' && ' — not started'}
            {t.status === 'behind' && ' — no progress'}
            {t.status === 'at_risk' && ' — pace slow'}
          </div>

          {/* Status breakdown */}
          {t.status !== 'achieved' && (
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              {t.statusBreakdown.completed > 0 && !isComplete && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {t.statusBreakdown.completed} done
                </span>
              )}
              {t.statusBreakdown.inProgress > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {t.statusBreakdown.inProgress} in progress
                </span>
              )}
              {t.statusBreakdown.onHold > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  {t.statusBreakdown.onHold} on hold
                </span>
              )}
              {t.statusBreakdown.notStarted > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  {t.statusBreakdown.notStarted} not started
                </span>
              )}
            </div>
          )}

          {/* Why message */}
          {whyMessage && (
            <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md ${t.status === 'not_started' ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-700'}`}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span className="font-medium">{whyMessage}</span>
            </div>
          )}

          {/* Delay reasons */}
          {t.delayReasons.length > 0 && !isComplete && t.status !== 'on_track' && (
            <div className="rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Delay Reason</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-gray-500 w-14">Flats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {t.delayReasons.flatMap((r, i) => [
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-700">{r.reason}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-gray-900 tabular-nums">{r.count}</td>
                    </tr>,
                    ...(r.remarkDetails || []).map((rd, j) => (
                      <tr key={`${i}-rd-${j}`} className="bg-amber-50/60">
                        <td className="pl-5 pr-3 py-1 text-[10px] text-amber-800">
                          <span className="text-amber-400 mr-1">↳</span>
                          {rd.remark}
                        </td>
                        <td className="px-3 py-1 text-right text-[10px] font-semibold text-amber-700 tabular-nums">{rd.count}</td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          )}

          {/* See blockers */}
          {t.status === 'missed' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const fixThis = document.getElementById('fix-this-section');
                if (fixThis) fixThis.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C8922A] hover:text-[#b07e22] transition-colors"
            >
              See blockers
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 5.25 7.5 7.5 7.5-7.5m-15 6 7.5 7.5 7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Notes */}
          {t.notes && (
            <p className="text-[10px] text-gray-400 italic">{t.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
