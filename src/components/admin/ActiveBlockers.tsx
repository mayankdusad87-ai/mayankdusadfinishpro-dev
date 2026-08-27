'use client';

import { memo, useState } from 'react';
import type { ActiveBlockers as ActiveBlockersData, BlockerGroup } from '@/lib/insights-data';

interface Props {
  data: ActiveBlockersData;
}

function BlockerSection({ title, icon, groups, accentBg, accentText, dotColor }: {
  title: string;
  icon: React.ReactNode;
  groups: BlockerGroup[];
  accentBg: string;
  accentText: string;
  dotColor: string;
}) {
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
      </div>

      {groups.map(group => {
        const isExpanded = expandedReason === group.reason;

        return (
          <div key={group.reason} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Reason header — tappable */}
            <button
              onClick={() => setExpandedReason(isExpanded ? null : group.reason)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="text-sm font-semibold text-gray-900 truncate">{group.reason}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className={`${accentBg} ${accentText} text-xs font-bold px-2 py-0.5 rounded-full tabular-nums`}>
                  {group.floorCount} {group.floorCount === 1 ? 'floor' : 'floors'}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>

            {/* Expanded: stages → floors */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5 space-y-2">
                {group.stages.map(stage => (
                  <div key={stage.stage}>
                    <div className="text-xs font-semibold text-gray-600 mb-1">{stage.stage}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {stage.floors.map(f => (
                        <span
                          key={f.floor}
                          className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-md px-2 py-1 tabular-nums"
                        >
                          <span className="font-semibold text-gray-700">Floor {f.floor}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500">{f.flatCount} {f.flatCount === 1 ? 'flat' : 'flats'}</span>
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

      {/* Summary strip */}
      <div className="flex items-center gap-3 mb-4 text-xs">
        {delayed.length > 0 && (
          <span className="flex items-center gap-1.5 bg-red-50 text-red-700 rounded-full px-2.5 py-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {delayed.reduce((s, g) => s + g.stages.reduce((ss, st) => ss + st.floors.reduce((sf, f) => sf + f.flatCount, 0), 0), 0)} overdue activities
          </span>
        )}
        {onHold.length > 0 && (
          <span className="flex items-center gap-1.5 bg-orange-50 text-orange-700 rounded-full px-2.5 py-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            {onHold.reduce((s, g) => s + g.stages.reduce((ss, st) => ss + st.floors.reduce((sf, f) => sf + f.flatCount, 0), 0), 0)} on hold
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Delayed / overdue */}
        <BlockerSection
          title="Overdue — Not Started"
          icon={
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          groups={delayed}
          accentBg="bg-red-100"
          accentText="text-red-700"
          dotColor="bg-red-500"
        />

        {/* On Hold */}
        <BlockerSection
          title="On Hold"
          icon={
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          }
          groups={onHold}
          accentBg="bg-orange-100"
          accentText="text-orange-700"
          dotColor="bg-orange-500"
        />
      </div>
    </div>
  );
}

export default memo(ActiveBlockers);
