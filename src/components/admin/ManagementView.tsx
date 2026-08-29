'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import type { ManagementData, StageFloorBreakdown, FloorActivityDetail } from '@/lib/insights-data';
import type { UnitStore } from '@/repositories/store-repo';
import type { FloorHandover } from '@/repositories/handover-repo';
import MaterialStores from '@/components/admin/MaterialStores';
import ActiveBlockers from '@/components/admin/ActiveBlockers';
import TargetAchievement from '@/components/admin/TargetAchievement';
// Fix This section imports (hidden for now — re-enable when logic is refined)
// import { TARGET_STATUS_CONFIG, formatFloorRange } from '@/lib/target-engine';
// import type { TargetAchievementResult } from '@/lib/target-engine';

interface Props {
  data: ManagementData;
  projectName: string;
  projectId: string;
  stores?: UnitStore[];
  handovers?: FloorHandover[];
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Fix This section constant (hidden for now)
// const REASON_COLORS = ['#EF4444', '#3B82F6', '#F59E0B'];

function barColor(pct: number): string {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  if (pct > 0) return '#F97316';
  return '#E5E7EB';
}

function barTextColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 50) return '#D97706';
  if (pct > 0) return '#EA580C';
  return '#9CA3AF';
}

function pctBadgeBg(pct: number): string {
  if (pct >= 80) return 'bg-emerald-100 text-emerald-700';
  if (pct >= 50) return 'bg-amber-100 text-amber-700';
  if (pct > 0) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-500';
}

/** Group activities by status → activity name → flat numbers */
function groupByStatusThenActivity(activities: FloorActivityDetail[]) {
  const result: { status: string; label: string; dot: string; items: [string, number[]][] }[] = [];

  for (const [status, label, dot] of [
    ['in_progress', 'In Progress', 'bg-amber-500'],
    ['yet_to_start', 'Yet to Start', 'bg-gray-400'],
    ['on_hold', 'On Hold', 'bg-orange-500'],
  ] as const) {
    const map = new Map<string, Set<number>>();
    for (const a of activities) {
      if (a.status !== status) continue;
      if (!map.has(a.activity)) map.set(a.activity, new Set());
      map.get(a.activity)!.add(a.flatNumber);
    }
    if (map.size > 0) {
      const items = [...map.entries()]
        .map(([activity, flatSet]) => [activity, [...flatSet].sort((a, b) => a - b)] as [string, number[]])
        .sort((a, b) => a[0].localeCompare(b[0]));
      result.push({ status, label, dot, items });
    }
  }
  return result;
}

function FloorCard({ b, handover }: { b: StageFloorBreakdown; handover?: FloorHandover }) {
  const notHandedOver = handover ? !handover.actual_handover : false;
  const [expanded, setExpanded] = useState(false);
  // Deduplicate on-hold flats (one flat can have multiple on-hold activities)
  const onHoldCount = new Set(b.onHoldFlats.map(oh => oh.flatNumber)).size;
  const hasPending = b.activities.length > 0;

  let borderColor = 'border-gray-200';
  let bgColor = 'bg-gray-50';
  if (b.completedUnits === b.totalUnits) { borderColor = 'border-emerald-300'; bgColor = 'bg-emerald-50'; }
  else if (b.inProgressUnits > 0) { borderColor = 'border-amber-300'; bgColor = 'bg-amber-50'; }

  const statusGroups = expanded ? groupByStatusThenActivity(b.activities) : [];

  return (
    <div className={`rounded-lg border-l-[3px] ${borderColor} ${bgColor}`}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">Floor {b.floor}</span>
          <span className="text-xs text-gray-400 tabular-nums">{b.totalUnits} units</span>
        </div>
        {/* RCC handover warning */}
        {notHandedOver && (
          <div className="mb-2 flex items-center gap-1.5 text-xs bg-red-50 border border-red-200 rounded px-2 py-1.5">
            <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-red-700 font-medium">Not handed over by RCC</span>
            {handover?.planned_handover && (
              <span className="text-red-500 ml-auto tabular-nums">
                Planned: {new Date(handover.planned_handover).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
          {b.completedUnits > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-gray-600">{b.completedUnits} completed</span>
            </span>
          )}
          {b.inProgressUnits > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-amber-700 font-medium">{b.inProgressUnits} in progress</span>
            </span>
          )}
          {b.yetToStartUnits > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span className="text-gray-600 font-medium">{b.yetToStartUnits} yet to start</span>
            </span>
          )}
          {onHoldCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-orange-700 font-medium">{onHoldCount} on hold</span>
            </span>
          )}
        </div>

        {/* View details toggle */}
        {hasPending && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="mt-2 flex items-center gap-1 text-xs text-[#C8922A] font-semibold hover:text-[#b07e22] transition-colors cursor-pointer"
          >
            {expanded ? 'Hide' : 'View'} pending activities
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Expandable activity detail — grouped by status, then activity */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {expanded && statusGroups.length > 0 && (
            <div className="px-3 pb-3 pt-1 border-t border-gray-200/60 space-y-3">
              {statusGroups.map(group => (
                <div key={group.status}>
                  {/* Status header */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">{group.label}</span>
                  </div>
                  {/* Activities under this status */}
                  <div className="space-y-1.5 pl-3.5">
                    {group.items.map(([activity, flats]) => (
                      <div key={activity}>
                        <div className="text-xs font-semibold text-gray-700 mb-1">{activity}</div>
                        <div className="flex flex-wrap gap-1">
                          {flats.map(flat => (
                            <span
                              key={flat}
                              className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700 tabular-nums"
                            >
                              {flat}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DrilldownPanel({ stage, breakdowns, onClose, handoverMap }: { stage: string; breakdowns: StageFloorBreakdown[]; onClose: () => void; handoverMap: Map<number, FloorHandover> }) {
  // Floors in this stage not yet handed over by RCC
  const notHandedOverFloors = breakdowns.filter(b => {
    const h = handoverMap.get(b.floor);
    return h && !h.actual_handover;
  }).map(b => b.floor);

  return (
    <div className="bg-white rounded-xl border-2 border-[#C8922A]/20 p-4 md:p-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm md:text-base font-bold text-gray-900">
          <span className="text-[#C8922A] mr-1.5">▾</span>
          {stage} — floor breakdown
        </h4>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-600 transition-colors cursor-pointer flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          Close
        </button>
      </div>

      {/* RCC handover summary */}
      {notHandedOverFloors.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-red-700 font-medium">
            {notHandedOverFloors.length} floor{notHandedOverFloors.length > 1 ? 's' : ''} not handed over by RCC:
          </span>
          <span className="text-red-600 tabular-nums">
            {notHandedOverFloors.join(', ')}
          </span>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3">Tap a floor card to see activity details</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {breakdowns.map(b => <FloorCard key={b.floor} b={b} handover={handoverMap.get(b.floor)} />)}
      </div>
    </div>
  );
}

function ManagementView({ data, projectName, projectId, stores = [], handovers = [] }: Props) {
  const { pipeline, /* bottlenecks, */ stageFloorBreakdowns, sitePulse, pendingWork, activeBlockers } = data;
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Build handover lookup: floor → FloorHandover
  const handoverMap = useMemo(() => {
    const m = new Map<number, FloorHandover>();
    for (const h of handovers) m.set(h.floor, h);
    return m;
  }, [handovers]);
  const [expandedPulseStage, setExpandedPulseStage] = useState<string | null>(null);
  const [weeklyDrillOpen, setWeeklyDrillOpen] = useState(false);

  // Pipeline analysis: drop-offs between stages and bottleneck detection
  const pipelineAnalysis = useMemo(() => {
    const dropOffs: { from: string; to: string; drop: number }[] = [];
    let bottleneckIdx = -1;
    let maxDrop = 0;
    const totalFlats = pipeline.length > 0 ? pipeline[0].totalFlats : 0;

    for (let i = 1; i < pipeline.length; i++) {
      const drop = pipeline[i - 1].completedFlats - pipeline[i].completedFlats;
      dropOffs.push({ from: pipeline[i - 1].stage, to: pipeline[i].stage, drop: Math.max(0, drop) });
      if (drop > maxDrop) {
        maxDrop = drop;
        bottleneckIdx = i;
      }
    }

    return { dropOffs, bottleneckIdx, maxDrop, totalFlats };
  }, [pipeline]);

  // --- Fix This: fetch targets for linkage (hidden for now) ---
  // const [targetResults, setTargetResults] = useState<TargetAchievementResult[]>([]);
  /* useEffect(() => {
    if (!projectId) return;
    fetch(`/api/targets/achievement?projectId=${projectId}`)
      .then(r => r.ok ? r.json() : { targets: [] })
      .then(d => setTargetResults(d.targets || []))
      .catch(() => {});
  }, [projectId]); */

  // --- Fix This section logic (hidden for now — re-enable when logic is refined) ---
  // const blockerGroups = useMemo(() => { ... }, [bottlenecks]);
  // const findTarget = (stage, floors) => { ... };

  return (
    <div className="space-y-6">

      {/* ---- SECTION 0: TARGET ACHIEVEMENT (READ-ONLY, AT THE TOP) ---- */}
      {projectId && (
        <TargetAchievement
          projectId={projectId}
          projectName={projectName}
        />
      )}

      {/* ---- SECTION 1: PIPELINE FUNNEL ---- */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 md:px-6 py-3.5 bg-gradient-to-r from-[#162032] to-[#1e2d45] flex items-center justify-between">
          <div>
            <h3 className="text-sm md:text-base font-bold text-white">Flat Completion Pipeline</h3>
            <p className="text-xs text-gray-400 mt-0.5">{pipelineAnalysis.totalFlats} total flats &bull; Click stage for floor breakdown</p>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {/* Desktop: horizontal cards with drop-off indicators */}
          <div className="hidden md:block">
            <div className="flex items-stretch gap-0">
              {pipeline.map((s, i) => {
                const w = s.totalFlats > 0 ? (s.completedFlats / s.totalFlats) * 100 : 0;
                const isActive = selectedStage === s.stage;
                const isBottleneck = i === pipelineAnalysis.bottleneckIdx && pipelineAnalysis.maxDrop > 0;
                const dropOff = i > 0 ? pipelineAnalysis.dropOffs[i - 1] : null;
                return (
                  <div key={s.stage} className="flex items-stretch flex-1 min-w-0">
                    {/* Drop-off connector between stages */}
                    {dropOff !== null && (
                      <div className="flex flex-col items-center justify-center w-10 shrink-0">
                        <div className={`w-px h-4 ${dropOff.drop >= 16 ? 'bg-red-300' : dropOff.drop >= 6 ? 'bg-amber-300' : 'bg-gray-200'}`} />
                        {dropOff.drop > 0 ? (
                          <div className={`px-1 py-0.5 rounded text-center whitespace-nowrap ${
                            dropOff.drop >= 16 ? 'bg-red-50' : dropOff.drop >= 6 ? 'bg-amber-50' : 'bg-gray-50'
                          }`}>
                            <div className={`text-[10px] font-bold tabular-nums leading-tight ${
                              dropOff.drop >= 16 ? 'text-red-600' : dropOff.drop >= 6 ? 'text-amber-600' : 'text-gray-400'
                            }`}>
                              ↓{dropOff.drop}
                            </div>
                            {dropOff.drop >= 16 && (
                              <div className="text-[8px] font-bold text-red-500 uppercase tracking-wide leading-tight">bottleneck</div>
                            )}
                          </div>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                            <path d="M3 6H9M9 6L6 3M9 6L6 9" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <div className={`w-px h-4 ${dropOff.drop >= 16 ? 'bg-red-300' : dropOff.drop >= 6 ? 'bg-amber-300' : 'bg-gray-200'}`} />
                      </div>
                    )}
                    {/* Stage card */}
                    <button
                      onClick={() => setSelectedStage(isActive ? null : s.stage)}
                      className={`w-full rounded-xl p-4 text-center transition-all cursor-pointer border-2 ${
                        isActive
                          ? 'border-[#C8922A] ring-2 ring-[#C8922A]/20 bg-[#C8922A]/5'
                          : isBottleneck
                            ? 'border-amber-400 bg-amber-50/50 hover:shadow-md'
                            : 'border-gray-100 bg-gray-50/80 hover:border-gray-300 hover:shadow-md hover:bg-white'
                      }`}
                    >
                      {isBottleneck && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 mb-2">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                          </svg>
                          BOTTLENECK
                        </span>
                      )}
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 truncate">{s.stage}</div>
                      <div className="text-2xl font-bold text-gray-900 tabular-nums">{s.completedFlats}</div>
                      <div className="text-xs text-gray-500 tabular-nums">/ {s.totalFlats} flats</div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full mt-3 overflow-hidden">
                        <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${w}%`, backgroundColor: '#3b82f6' }} />
                      </div>
                      <div className="mt-2 text-xs font-bold tabular-nums text-blue-600">{s.pct}%</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile: vertical pipeline with drop-off indicators */}
          <div className="md:hidden space-y-0">
            {pipeline.map((s, i) => {
              const w = s.totalFlats > 0 ? (s.completedFlats / s.totalFlats) * 100 : 0;
              const isActive = selectedStage === s.stage;
              const isBottleneck = i === pipelineAnalysis.bottleneckIdx && pipelineAnalysis.maxDrop > 0;
              const dropOff = i > 0 ? pipelineAnalysis.dropOffs[i - 1] : null;

              return (
                <div key={s.stage}>
                  {/* Drop-off indicator between stages */}
                  {dropOff && dropOff.drop > 0 && (
                    <div className="flex items-center gap-2 py-1.5 pl-4">
                      <svg className={`w-3 h-3 shrink-0 ${dropOff.drop >= 16 ? 'text-red-500' : dropOff.drop >= 6 ? 'text-amber-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
                      </svg>
                      <span className={`text-xs tabular-nums ${
                        dropOff.drop >= 16 ? 'font-bold text-red-600' : dropOff.drop >= 6 ? 'font-semibold text-amber-600' : 'text-gray-400'
                      }`}>
                        Drop-off: {dropOff.drop} flats from previous stage
                      </span>
                    </div>
                  )}

                  {/* Stage card */}
                  <button
                    onClick={() => setSelectedStage(isActive ? null : s.stage)}
                    className={`w-full text-left rounded-xl p-3.5 transition-all cursor-pointer border-2 ${
                      isActive
                        ? 'border-[#C8922A] ring-2 ring-[#C8922A]/20 bg-[#C8922A]/5'
                        : isBottleneck
                          ? 'border-amber-400 bg-amber-50/60'
                          : 'bg-white border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {/* Top row: stage name + flats count */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        {isBottleneck && (
                          <span className="text-lg">🔶</span>
                        )}
                        <span className={`text-sm font-bold ${isBottleneck ? 'text-gray-900' : 'text-gray-800'}`}>{s.stage}</span>
                        {isBottleneck && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">Bottleneck</span>
                        )}
                      </div>
                      <div className="text-sm tabular-nums">
                        <span className="font-bold text-gray-900">{s.completedFlats} flats</span>
                        <span className="text-gray-400"> / {s.totalFlats}</span>
                      </div>
                    </div>

                    {/* Progress bar with percentage inside */}
                    <div className="relative w-full h-6 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-6 rounded-lg transition-all duration-500 flex items-center"
                        style={{ width: `${Math.max(w, 8)}%`, backgroundColor: '#3b82f6' }}
                      >
                        {w >= 15 && (
                          <span className="text-xs font-bold text-white ml-2.5 tabular-nums">{s.pct}%</span>
                        )}
                      </div>
                      {w < 15 && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 tabular-nums">{s.pct}%</span>
                      )}
                    </div>

                    {/* Bottleneck subtitle */}
                    {isBottleneck && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-amber-700">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
                        </svg>
                        Largest drop-off: {pipelineAnalysis.maxDrop} flats stuck here
                      </div>
                    )}
                  </button>

                  {/* Inline drill-down on mobile */}
                  {isActive && stageFloorBreakdowns[s.stage] && (
                    <div className="mt-2 mb-1">
                      <DrilldownPanel
                        stage={s.stage}
                        breakdowns={stageFloorBreakdowns[s.stage]}
                        onClose={() => setSelectedStage(null)}
                        handoverMap={handoverMap}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---- SECTION 2: STAGE DRILL-DOWN (desktop only — mobile renders inline above) ---- */}
      {selectedStage && stageFloorBreakdowns[selectedStage] && (
        <div className="hidden md:block">
          <DrilldownPanel
            stage={selectedStage}
            breakdowns={stageFloorBreakdowns[selectedStage]}
            onClose={() => setSelectedStage(null)}
            handoverMap={handoverMap}
          />
        </div>
      )}

      {/* ---- SECTION 3: FIX THIS (hidden for now — re-enable when logic is refined) ---- */}

      {/* ---- SECTION 4: SITE PULSE ---- */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 md:px-6 py-3.5 bg-gradient-to-r from-[#162032] to-[#1e2d45]">
          <h3 className="text-sm md:text-base font-bold text-white">Site Pulse</h3>
        </div>

        <div className="p-4 md:p-6">
          {/* Weekly progress strip — clickable for drill-down */}
          <div className="mb-5">
            <button
              onClick={() => sitePulse.completionsThisWeek > 0 && setWeeklyDrillOpen(p => !p)}
              className={`w-full flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-left transition-colors ${
                sitePulse.completionsThisWeek > 0 ? 'cursor-pointer hover:bg-blue-100/50' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-700">
                  <span className="text-xl font-bold text-gray-900 tabular-nums">{sitePulse.completionsThisWeek}</span>
                  <span className="text-gray-500 ml-1.5">{sitePulse.completionsThisWeek === 1 ? 'activity' : 'activities'} completed this week</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  vs {sitePulse.completionsLastWeek} last week
                  {sitePulse.completionsThisWeek > 0 && (
                    <span className="text-blue-500 ml-2 font-medium">{weeklyDrillOpen ? '▾ Hide detail' : '▸ View detail'}</span>
                  )}
                </div>
              </div>
              {sitePulse.velocityDelta !== 0 && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${
                  sitePulse.velocityDelta > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  <svg className={`w-3.5 h-3.5 ${sitePulse.velocityDelta < 0 ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                  {Math.abs(sitePulse.velocityDelta)}
                </div>
              )}
              {sitePulse.velocityDelta === 0 && sitePulse.completionsThisWeek > 0 && (
                <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                  Same pace
                </div>
              )}
            </button>

            {/* Drill-down: completed activities this week */}
            {weeklyDrillOpen && sitePulse.completedActivitiesThisWeek.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Floor</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Flat</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sitePulse.completedActivitiesThisWeek.map((ca, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800 font-medium tabular-nums">F{ca.floor}</td>
                          <td className="px-3 py-2 text-gray-700 tabular-nums">{ca.flatNumber}</td>
                          <td className="px-3 py-2 text-gray-800">{ca.activity}</td>
                          <td className="px-3 py-2">
                            <span className="text-xs text-gray-500">{ca.stage}</span>
                            <span className="text-gray-300 mx-1">→</span>
                            <span className="text-xs text-gray-600">{ca.stageGate}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-500 tabular-nums whitespace-nowrap">
                            {new Date(ca.completedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Pending work section */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending work</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {pendingWork.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-10 h-10 text-emerald-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div className="text-sm font-semibold text-gray-700">All clear</div>
              <div className="text-xs text-gray-500 mt-0.5">Every sub-stage is completed across all floors</div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-200">
              {pendingWork.map((stageGroup) => {
                const isExpanded = expandedPulseStage === stageGroup.stage;
                // Floor-level progress: a floor is "done" for the stage only if it's NOT pending in ANY sub-stage
                const totalFloors = stageGroup.subStages[0]?.totalFloors ?? 0;
                const uniquePendingFloors = new Set(
                  stageGroup.subStages.flatMap(sub => sub.pendingFloors.map(pf => pf.floor))
                );
                const floorsCompleted = totalFloors - uniquePendingFloors.size;
                const stagePct = totalFloors > 0 ? Math.round((floorsCompleted / totalFloors) * 100) : 0;

                return (
                  <div key={stageGroup.stage}>
                    {/* Collapsed / expanded header */}
                    <button
                      onClick={() => setExpandedPulseStage(prev => prev === stageGroup.stage ? null : stageGroup.stage)}
                      className={`w-full px-4 py-3 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-[#162032]' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      {/* Row 1: chevron + stage name + sub-stage badge */}
                      <div className="flex items-center gap-2.5">
                        <svg
                          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${
                            isExpanded ? 'rotate-90 text-[#C8922A]' : 'text-gray-500'
                          }`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                        <span className={`text-sm font-semibold ${isExpanded ? 'text-white' : 'text-gray-800'}`}>
                          {stageGroup.stage}
                        </span>
                        <span className={`ml-auto text-xs flex-shrink-0 tabular-nums ${isExpanded ? 'text-gray-400' : 'text-gray-500'}`}>
                          {stageGroup.subStages.length} sub-stage{stageGroup.subStages.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {/* Row 2: progress bar + floor count */}
                      <div className="flex items-center gap-2.5 mt-2 pl-6">
                        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isExpanded ? 'bg-white/15' : 'bg-gray-100'}`}>
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${isExpanded ? 'bg-[#C8922A]' : 'bg-blue-500'}`}
                            style={{ width: `${stagePct}%` }}
                          />
                        </div>
                        <span className={`text-xs tabular-nums flex-shrink-0 font-medium ${
                          isExpanded ? 'text-gray-300' : 'text-gray-500'
                        }`}>
                          {floorsCompleted}/{totalFloors} floors
                        </span>
                      </div>
                    </button>

                    {/* Expanded: sub-stage detail rows */}
                    <div
                      className="grid transition-[grid-template-rows] duration-200 ease-out"
                      style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                    >
                      <div className={`overflow-hidden ${isExpanded ? 'bg-gray-50/80' : ''}`}>
                        {/* Legend row */}
                        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-xs text-gray-500">In progress</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                            <span className="text-xs text-gray-500">Yet to start</span>
                          </div>
                        </div>

                        {stageGroup.subStages.map((sub, idx) => {
                          const pct = sub.totalFloors > 0 ? Math.round((sub.completedFloors / sub.totalFloors) * 100) : 0;
                          return (
                            <div
                              key={sub.subStage}
                              className={`flex items-start md:items-center gap-3 px-4 py-3 ${
                                idx < stageGroup.subStages.length - 1 ? 'border-b border-gray-100' : ''
                              }`}
                            >
                              {/* Sub-stage name */}
                              <div className="w-[120px] md:w-[160px] flex-shrink-0">
                                <div className="text-sm font-medium text-gray-800 leading-tight">{sub.subStage}</div>
                              </div>

                              {/* Progress bar + count + floor chips */}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                                    {sub.completedFloors}/{sub.totalFloors}
                                  </span>
                                </div>
                                <div className="flex gap-1 flex-wrap">
                                  {sub.pendingFloors.map(pf => (
                                    <span
                                      key={pf.floor}
                                      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                                        pf.status === 'in_progress'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                                      }`}
                                    >
                                      F{pf.floor}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          {pendingWork.length > 0 && (
            <div className="text-xs text-gray-500 mt-2.5">
              Tap a stage to see sub-stage detail. Completed sub-stages are hidden.
            </div>
          )}
        </div>
      </div>

      {/* ---- SECTION 5: ACTIVE BLOCKERS ---- */}
      <ActiveBlockers data={activeBlockers} />

      {/* ---- SECTION 6: MATERIAL STORES (compact pills) ---- */}
      <MaterialStores stores={stores} compact />
    </div>
  );
}

export default memo(ManagementView);
