'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TARGET_STATUS_CONFIG,
  formatFloorRange,
  type TargetAchievementResult,
  type TargetSummary,
  type TargetStatus,
  type StatusBreakdown,
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

// ---- Circular progress ring (SVG) ----
function ProgressRing({ pct, status, size = 64 }: { pct: number; status: TargetStatus; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = RING_COLORS[status];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      {/* Center text */}
      <span className="absolute text-sm font-bold text-gray-900 tabular-nums">{pct}%</span>
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
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
          <div className="h-5 w-52 bg-gray-200 rounded" />
        </div>
        <div className="p-5 space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-gray-100 rounded" />
                <div className="h-3 w-48 bg-gray-100 rounded" />
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
  const achievedCount = summary.achieved + summary.delayed;

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
              <span className="text-[#C8922A] font-semibold">{achievedCount}</span> of{' '}
              <span className="text-white font-semibold">{summary.total}</span> targets achieved
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

      {/* ---- Target cards (vertical stack) ---- */}
      <div className="divide-y divide-gray-100">
        {targets.map(t => (
          <TargetCard key={t.id} target={t} />
        ))}
      </div>
    </div>
  );
}

// ---- Target card sub-component ----

/** Build a concise flat-level breakdown string, e.g. "5 flats not started · 2 in progress" */
function formatStatusBreakdown(sb: StatusBreakdown): string {
  const parts: string[] = [];
  const f = (n: number) => n === 1 ? 'flat' : 'flats';
  if (sb.notStarted > 0) parts.push(`${sb.notStarted} ${f(sb.notStarted)} not started`);
  if (sb.inProgress > 0) parts.push(`${sb.inProgress} in progress`);
  if (sb.onHold > 0) parts.push(`${sb.onHold} on hold`);
  return parts.join(' · ');
}

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
    return `${sb.onHold} ${sb.onHold === 1 ? 'flat' : 'flats'} on hold — blocking progress`;
  }
  return null;
}

function TargetCard({ target: t }: { target: TargetAchievementResult }) {
  const cfg = TARGET_STATUS_CONFIG[t.status];
  const floorLabel = formatFloorRange(t.floorFrom, t.floorTo);

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Timing label
  let timingText = '';
  let timingColor = '';

  if (t.status === 'achieved') {
    timingText = '✓ Completed on time';
    timingColor = 'text-emerald-600';
  } else if (t.status === 'delayed' && t.daysLate !== null) {
    timingText = `${t.daysLate} day${t.daysLate === 1 ? '' : 's'} late`;
    timingColor = 'text-amber-600';
  } else if (t.status === 'missed') {
    const overdue = Math.abs(t.daysRemaining);
    timingText = `${overdue} day${overdue === 1 ? '' : 's'} overdue`;
    timingColor = 'text-red-600';
  } else if (t.status === 'not_started' && t.daysRemaining > 0) {
    timingText = `${t.daysRemaining} day${t.daysRemaining === 1 ? '' : 's'} remaining — not started`;
    timingColor = 'text-gray-500';
  } else if (t.status === 'behind' && t.daysRemaining > 0) {
    timingText = `${t.daysRemaining} day${t.daysRemaining === 1 ? '' : 's'} left — no progress`;
    timingColor = 'text-red-600';
  } else if (t.status === 'on_track' && t.daysRemaining > 0) {
    timingText = `${t.daysRemaining} day${t.daysRemaining === 1 ? '' : 's'} remaining`;
    timingColor = 'text-green-600';
  } else if (t.status === 'at_risk' && t.daysRemaining > 0) {
    timingText = `${t.daysRemaining} day${t.daysRemaining === 1 ? '' : 's'} left — pace slow`;
    timingColor = 'text-orange-600';
  }

  const breakdownText = formatStatusBreakdown(t.statusBreakdown);
  const whyMessage = getWhyMessage(t);

  return (
    <div className="px-5 py-4 flex gap-4 items-start hover:bg-gray-50/50 transition-colors">
      {/* Progress ring */}
      <div className="shrink-0 pt-0.5">
        <ProgressRing pct={t.progressPct} status={t.status} size={64} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: stage + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-bold text-gray-900">{t.stage}</h4>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Floor range + target date */}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{floorLabel}</span>
          <span className="text-gray-300">·</span>
          <span>Target: <strong className="text-gray-700">{fmtDate(t.targetDate)}</strong></span>
        </div>

        {/* Completion stats + timing */}
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs text-gray-600 tabular-nums">
            <span className="font-bold text-gray-800">{t.completedFlats}</span>/{t.totalFlats} flats
          </span>
          {timingText && (
            <span className={`text-xs font-semibold ${timingColor}`}>
              {timingText}
            </span>
          )}
        </div>

        {/* Flat-level status breakdown (one-liner) */}
        {breakdownText && t.status !== 'achieved' && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
            {t.statusBreakdown.notStarted > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {t.statusBreakdown.notStarted} {t.statusBreakdown.notStarted === 1 ? 'flat' : 'flats'} not started
              </span>
            )}
            {t.statusBreakdown.inProgress > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-300">·</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {t.statusBreakdown.inProgress} in progress
              </span>
            )}
            {t.statusBreakdown.onHold > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-300">·</span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                {t.statusBreakdown.onHold} on hold
              </span>
            )}
          </div>
        )}

        {/* Smart "why" one-liner for missed/at-risk without delay reasons */}
        {whyMessage && (
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <svg className={`w-3.5 h-3.5 flex-shrink-0 ${t.status === 'not_started' ? 'text-gray-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className={`font-medium ${t.status === 'not_started' ? 'text-gray-500' : 'text-red-600'}`}>{whyMessage}</span>
          </div>
        )}

        {/* Delay reasons table (for missed/at_risk/delayed) */}
        {t.delayReasons.length > 0 && t.status !== 'achieved' && t.status !== 'on_track' && (
          <div className="mt-2.5 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100/80">
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Delay Reason</th>
                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500 w-16">Flats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {t.delayReasons.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-700">{r.reason}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-gray-900 tabular-nums">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* "See blockers" link for missed targets — scrolls to Fix This section */}
        {t.status === 'missed' && (
          <button
            onClick={() => {
              const fixThis = document.getElementById('fix-this-section');
              if (fixThis) fixThis.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#C8922A] hover:text-[#b07e22] transition-colors"
          >
            See blockers
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 5.25 7.5 7.5 7.5-7.5m-15 6 7.5 7.5 7.5-7.5" />
            </svg>
          </button>
        )}

        {/* Notes */}
        {t.notes && (
          <p className="mt-1.5 text-[11px] text-gray-400 italic truncate">{t.notes}</p>
        )}
      </div>
    </div>
  );
}
