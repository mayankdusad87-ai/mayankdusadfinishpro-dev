'use client';

import { memo, useState } from 'react';
import type { ManagementData, StageFloorBreakdown } from '@/lib/insights-data';
import type { UnitStore } from '@/repositories/store-repo';
import MaterialStores from '@/components/admin/MaterialStores';
import MilestoneTracker from '@/components/admin/MilestoneTracker';

interface ActivityForMilestone {
  floor: number;
  flat_number: number;
  stage: string;
  stage_gate: string | null;
  status: string;
}

interface Props {
  data: ManagementData;
  projectName: string;
  projectId: string;
  stores?: UnitStore[];
  activities?: ActivityForMilestone[];
  stages?: string[];
  floors?: number[];
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const REASON_COLORS = ['#EF4444', '#3B82F6', '#F59E0B'];

function barColor(pct: number): string {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  if (pct > 0) return '#EF4444';
  return '#E5E7EB';
}

function barTextColor(pct: number): string {
  if (pct >= 80) return '#059669';
  if (pct >= 50) return '#D97706';
  if (pct > 0) return '#DC2626';
  return '#9CA3AF';
}

function DrilldownPanel({ stage, breakdowns, onClose }: { stage: string; breakdowns: StageFloorBreakdown[]; onClose: () => void }) {
  return (
    <div className="bg-white rounded-xl border-2 border-primary/20 p-4 md:p-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm md:text-base font-bold text-gray-900">
          <span className="text-primary mr-1.5">&#9660;</span>
          {stage} — floor breakdown
        </h4>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          Close
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {breakdowns.map(b => {
          let borderColor = 'border-gray-200';
          let bgColor = 'bg-gray-50';
          if (b.completed === b.total) { borderColor = 'border-emerald-300'; bgColor = 'bg-emerald-50'; }
          else if (b.hasOverdue) { borderColor = 'border-red-300'; bgColor = 'bg-red-50'; }
          else if (b.inProgress > 0) { borderColor = 'border-amber-300'; bgColor = 'bg-amber-50'; }

          return (
            <div key={b.floor} className={`rounded-lg border-l-[3px] ${borderColor} ${bgColor} p-3`}>
              <div className="text-sm font-bold text-gray-900 mb-2">Floor {b.floor}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {b.completed > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-gray-600">{b.completed} done</span>
                  </span>
                )}
                {b.inProgress > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="text-gray-600">{b.inProgress} in progress</span>
                  </span>
                )}
                {b.yetToStart > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    <span className="text-gray-600">{b.yetToStart} yet to start</span>
                  </span>
                )}
                {b.hasOverdue && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-red-600 font-semibold">overdue</span>
                  </span>
                )}
              </div>
              {b.onHoldFlats.length > 0 && (
                <div className="mt-2 space-y-1">
                  {b.onHoldFlats.map(oh => (
                    <div key={`${oh.floor}-${oh.flatNumber}`} className="text-[11px] bg-amber-100/60 text-amber-800 rounded px-2 py-1">
                      <span className="font-semibold">Flat {oh.flatNumber}</span> on hold — {oh.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ManagementView({ data, projectName, projectId, stores = [], activities = [], stages = [], floors = [] }: Props) {
  const { pipeline, bottlenecks, stageFloorBreakdowns, sitePulse } = data;
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [pulseExpanded, setPulseExpanded] = useState(false);

  return (
    <div className="space-y-5">

      {/* ---- SECTION 1: PIPELINE FUNNEL ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900">Flat Completion Pipeline</h3>
            <p className="text-xs text-gray-400 mt-0.5">Click a stage to see floor-level breakdown</p>
          </div>
          <span className="text-xs text-gray-400 hidden md:inline">{projectName}</span>
        </div>

        {/* Desktop: horizontal funnel */}
        <div className="hidden md:block">
          <div className="flex gap-3">
            {pipeline.map((s, i) => {
              const w = s.totalFlats > 0 ? (s.completedFlats / s.totalFlats) * 100 : 0;
              const isActive = selectedStage === s.stage;
              return (
                <div key={s.stage} className="flex-1 relative">
                  {i < pipeline.length - 1 && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                        <path d="M2 1L10 8L2 15" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedStage(isActive ? null : s.stage)}
                    className={`w-full bg-gray-50 rounded-lg p-4 border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 truncate">{s.stage}</div>
                    <div className="text-2xl font-bold text-gray-900 tabular-nums">{s.completedFlats}</div>
                    <div className="text-xs text-gray-400 tabular-nums">/ {s.totalFlats} flats</div>
                    <div className="w-full h-2 bg-gray-200 rounded-full mt-3">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${w}%`, backgroundColor: barColor(w) }} />
                    </div>
                    <div className="text-[11px] font-semibold mt-1.5 tabular-nums" style={{ color: barTextColor(w) }}>{s.pct}%</div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: vertical list */}
        <div className="md:hidden space-y-3">
          {pipeline.map((s, i) => {
            const w = s.totalFlats > 0 ? (s.completedFlats / s.totalFlats) * 100 : 0;
            const bc = barColor(w);
            const isActive = selectedStage === s.stage;
            return (
              <div key={s.stage}>
                <button
                  onClick={() => setSelectedStage(isActive ? null : s.stage)}
                  className={`w-full text-left rounded-lg p-2.5 transition-all cursor-pointer ${
                    isActive ? 'ring-2 ring-primary/20 bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-800">{s.stage}</span>
                    </div>
                    <div className="text-sm tabular-nums">
                      <span className="font-bold text-gray-900">{s.completedFlats}</span>
                      <span className="text-gray-400"> / {s.totalFlats}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${w}%`, backgroundColor: bc }} />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: bc === '#E5E7EB' ? '#9CA3AF' : bc }}>{s.pct}%</span>
                  </div>
                </button>
                {i < pipeline.length - 1 && !isActive && (
                  <div className="flex justify-center py-1">
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M8 2V10M8 10L4 6M8 10L12 6" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- SECTION 3: STAGE DRILL-DOWN ---- */}
      {selectedStage && stageFloorBreakdowns[selectedStage] && (
        <DrilldownPanel
          stage={selectedStage}
          breakdowns={stageFloorBreakdowns[selectedStage]}
          onClose={() => setSelectedStage(null)}
        />
      )}

      {/* ---- SECTION 3b: MILESTONE TRACKER ---- */}
      {projectId && (
        <MilestoneTracker
          projectId={projectId}
          projectName={projectName}
          activities={activities}
          stages={stages}
          floors={floors}
        />
      )}

      {/* ---- SECTION 4: FIX THIS ---- */}
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-900">Fix This</h3>
          {bottlenecks.length > 0 ? (
            <span className="text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {bottlenecks.length} {bottlenecks.length === 1 ? 'blocker' : 'blockers'}
            </span>
          ) : (
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              All clear
            </span>
          )}
        </div>

        {bottlenecks.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-emerald-700 font-medium">All floors progressing on schedule. No action items.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {bottlenecks.map(b => (
              <div key={`${b.floor}-${b.blockedStage}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="h-[3px] bg-red-500" />
                <div className="p-4">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-sm font-bold text-gray-900">Floor {b.floor}</span>
                    <span className="text-xs font-semibold text-red-600">{b.maxDaysBehind}d behind</span>
                  </div>
                  <div className="text-xs font-semibold text-red-600 mb-3">Stuck at {b.blockedStage}</div>

                  <div className="space-y-1.5 border-t border-gray-100 pt-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Vendor</span>
                      <span className="font-semibold text-gray-900">{b.blockedVendor || '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Overdue</span>
                      <span className="font-semibold text-red-600">{b.overdueCount} {b.overdueCount === 1 ? 'activity' : 'activities'}</span>
                    </div>
                  </div>

                  {b.delayReasons.length > 0 && (
                    <div className="border-t border-gray-100 mt-2.5 pt-2.5">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Why it&apos;s stuck</div>
                      <div className="space-y-2">
                        {b.delayReasons.map((dr, i) => {
                          const isNoReason = dr.category === 'No reason logged';
                          const barPct = b.totalFlatsAffected > 0 ? Math.round((dr.flatCount / b.totalFlatsAffected) * 100) : 0;
                          const dotColor = isNoReason ? '#9CA3AF' : REASON_COLORS[i % REASON_COLORS.length];
                          return (
                            <div key={dr.category}>
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
                                  <span className={`text-xs ${isNoReason ? 'text-gray-400 italic' : 'text-gray-700'}`}>{dr.category}</span>
                                </div>
                                <span className={`text-xs font-semibold ${isNoReason ? 'text-gray-400' : 'text-gray-900'}`}>{dr.flatCount} {dr.flatCount === 1 ? 'flat' : 'flats'}</span>
                              </div>
                              <div className="w-full h-1 bg-gray-100 rounded-full">
                                <div className="h-1 rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: dotColor, opacity: isNoReason ? 0.5 : 0.7 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- SECTION 5: SITE PULSE ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Site Pulse</h3>

        {/* 1. Completion snapshot */}
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm text-gray-700">
              <span className="text-2xl md:text-3xl font-bold text-gray-900 tabular-nums">{sitePulse.fullyFinishedFlats}</span>
              <span className="text-gray-400 mx-1">of</span>
              <span className="text-lg font-semibold text-gray-600 tabular-nums">{sitePulse.totalFlats}</span>
              <span className="text-gray-500 ml-1.5">flats fully finished</span>
            </div>
            <span className="text-sm font-bold tabular-nums" style={{ color: sitePulse.completionPct >= 50 ? '#059669' : sitePulse.completionPct >= 20 ? '#D97706' : '#6B7280' }}>
              {sitePulse.completionPct}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{
                width: `${sitePulse.completionPct}%`,
                backgroundColor: sitePulse.completionPct >= 50 ? '#10B981' : sitePulse.completionPct >= 20 ? '#F59E0B' : '#9CA3AF',
              }}
            />
          </div>
        </div>

        {/* 2. This week's velocity */}
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex-1">
            <div className="text-sm text-gray-700">
              <span className="text-xl font-bold text-gray-900 tabular-nums">{sitePulse.completionsThisWeek}</span>
              <span className="text-gray-500 ml-1.5">{sitePulse.completionsThisWeek === 1 ? 'activity' : 'activities'} completed this week</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
              vs {sitePulse.completionsLastWeek} last week
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
        </div>

        {/* 3. Bottleneck alert */}
        {sitePulse.bottleneck && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-red-800">
                {sitePulse.bottleneck.stage} has {sitePulse.bottleneck.waitingFlats} {sitePulse.bottleneck.waitingFlats === 1 ? 'flat' : 'flats'} waiting
              </div>
              <div className="text-xs text-red-600">Longest queue — push this stage to unblock progress</div>
            </div>
          </div>
        )}

        {/* Drill-down toggle */}
        {sitePulse.stagesActiveThisWeek.length > 0 && (
          <>
            <button
              onClick={() => setPulseExpanded(!pulseExpanded)}
              className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary-dark transition-colors cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${pulseExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              {pulseExpanded ? 'Hide' : 'View'} this week&apos;s stage breakdown
            </button>

            {pulseExpanded && (
              <div className="mt-3 space-y-2">
                {sitePulse.stagesActiveThisWeek.map(s => (
                  <div key={s.stage} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{s.stage}</div>
                      <div className="text-[11px] text-gray-400">
                        Floors: {s.floors.map(f => `F${f}`).join(', ')}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-emerald-700 tabular-nums">{s.completedThisWeek}</div>
                      <div className="text-[10px] text-gray-400">completed</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {sitePulse.completionsThisWeek === 0 && sitePulse.completionsLastWeek === 0 && !sitePulse.bottleneck && (
          <div className="text-center py-3 text-sm text-gray-400">
            No completions recorded this week or last week.
          </div>
        )}
      </div>

      {/* ---- SECTION 6: MATERIAL STORES ---- */}
      <MaterialStores stores={stores} />
    </div>
  );
}

export default memo(ManagementView);
