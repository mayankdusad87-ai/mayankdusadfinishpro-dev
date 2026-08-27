'use client';

import { memo, useState } from 'react';
import type { ActiveBlockers as ActiveBlockersData, BlockerGroup } from '@/lib/insights-data';

interface Props {
  data: ActiveBlockersData;
}

/** Threshold: reasons with >= this many floors get a full bar row; rest go into collapsed chips */
const TOP_REASON_THRESHOLD = 2;

function BarSection({ title, icon, groups, barFillColor, barTrackColor, chipDotColor }: {
  title: string;
  icon: React.ReactNode;
  groups: BlockerGroup[];
  barFillColor: string;
  barTrackColor: string;
  chipDotColor: string;
}) {
  const [expandedReason, setExpandedReason] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [expandedChip, setExpandedChip] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const maxFloors = Math.max(...groups.map(g => g.floorCount), 1);
  const topReasons = groups.filter(g => g.floorCount >= TOP_REASON_THRESHOLD);
  const otherReasons = groups.filter(g => g.floorCount < TOP_REASON_THRESHOLD);

  // If all reasons are small (< threshold), show all as bar rows instead of hiding everything
  const barsToShow = topReasons.length > 0 ? topReasons : groups;
  const chipsToShow = topReasons.length > 0 ? otherReasons : [];

  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      </div>

      {/* Bar chart rows */}
      <div className="flex flex-col gap-1">
        {barsToShow.map(group => {
          const isExpanded = expandedReason === group.reason;
          const barPct = Math.max((group.floorCount / maxFloors) * 100, 3);

          return (
            <div key={group.reason}>
              <button
                onClick={() => setExpandedReason(isExpanded ? null : group.reason)}
                className="w-full grid items-center gap-2.5 py-1.5 px-1 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                style={{ gridTemplateColumns: '140px 1fr 56px' }}
              >
                <span className="text-[13px] font-semibold text-gray-900 truncate text-left">{group.reason}</span>
                <div className={`h-5 rounded ${barTrackColor} overflow-hidden`}>
                  <div
                    className={`h-full rounded ${barFillColor} transition-all duration-500`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-900 text-right tabular-nums whitespace-nowrap">
                  {group.floorCount} {group.floorCount === 1 ? 'floor' : 'floors'}
                </span>
              </button>

              {/* Expanded detail: stage → floor · flats */}
              {isExpanded && (
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 ml-1 mr-1 mb-1 space-y-2">
                  {group.stages.map(stage => (
                    <div key={stage.stage}>
                      <div className="text-[11px] font-semibold text-gray-500 mb-1">{stage.stage}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {stage.floors.map(f => (
                          <span
                            key={f.floor}
                            className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 rounded-md px-2 py-1 tabular-nums"
                          >
                            <span className="font-bold text-gray-700">Floor {f.floor}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-gray-500">{f.flatCount} {f.flatCount === 1 ? 'unit' : 'units'}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collapsed chip row for minor reasons */}
      {chipsToShow.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="flex items-center gap-1 text-xs text-gray-500 font-medium hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showOthers ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            {chipsToShow.length} other {chipsToShow.length === 1 ? 'reason' : 'reasons'} (1 floor each)
          </button>
          {showOthers && (
            <div className="space-y-1.5 mt-2">
              {chipsToShow.map(g => {
                const isChipExpanded = expandedChip === g.reason;
                return (
                  <div key={g.reason}>
                    <button
                      onClick={() => setExpandedChip(isChipExpanded ? null : g.reason)}
                      className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md px-2.5 py-1.5 font-medium transition-colors cursor-pointer"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chipDotColor}`} />
                      {g.reason}
                      <span className="text-gray-400 ml-0.5">
                        · {g.floorCount} {g.floorCount === 1 ? 'floor' : 'floors'}
                      </span>
                      <svg
                        className={`w-3 h-3 text-gray-400 transition-transform ${isChipExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                    {isChipExpanded && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 mt-1 ml-4 space-y-1.5">
                        {g.stages.map(stage => (
                          <div key={stage.stage}>
                            <div className="text-[11px] font-semibold text-gray-500 mb-1">{stage.stage}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {stage.floors.map(f => (
                                <span
                                  key={f.floor}
                                  className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 rounded-md px-2 py-1 tabular-nums"
                                >
                                  <span className="font-bold text-gray-700">Floor {f.floor}</span>
                                  <span className="text-gray-300">·</span>
                                  <span className="text-gray-500">{f.flatCount} {f.flatCount === 1 ? 'unit' : 'units'}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActiveBlockers({ data }: Props) {
  const { delayed, onHold, totalFloors, totalActivities } = data;

  if (totalActivities === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900">Active Blockers</h3>
            <p className="text-xs text-gray-400">Currently stuck — needs management attention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900 tabular-nums">{totalFloors}</span>
          <span className="text-xs text-gray-500 leading-tight">
            {totalFloors === 1 ? 'floor' : 'floors'}<br />affected
          </span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Overdue — bar chart */}
        <BarSection
          title="Overdue — Not Started"
          icon={
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          groups={delayed}
          barFillColor="bg-red-500"
          barTrackColor="bg-red-100"
          chipDotColor="bg-red-400"
        />

        {/* On Hold — bar chart */}
        {onHold.length > 0 && delayed.length > 0 && (
          <div className="border-t border-gray-100" />
        )}
        <BarSection
          title="On Hold"
          icon={
            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          }
          groups={onHold}
          barFillColor="bg-orange-500"
          barTrackColor="bg-orange-100"
          chipDotColor="bg-orange-400"
        />
      </div>
    </div>
  );
}

export default memo(ActiveBlockers);
