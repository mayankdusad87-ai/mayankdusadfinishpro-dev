'use client';

import { memo, useState } from 'react';
import type { ActiveBlockers as ActiveBlockersData, BlockerGroup, BlockerFlatRemark } from '@/lib/insights-data';

interface Props {
  data: ActiveBlockersData;
}

function BlockerSection({ title, colorClass, groups }: {
  title: string;
  colorClass: 'red' | 'amber';
  groups: BlockerGroup[];
}) {
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const labelColor = colorClass === 'red' ? 'text-red-500' : 'text-amber-600';
  const cardBg = colorClass === 'red' ? 'bg-red-50' : 'bg-amber-50';
  const cardBorder = colorClass === 'red' ? 'border-red-200' : 'border-amber-200';
  const badgeBg = colorClass === 'red' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600';

  return (
    <div className="px-3.5 py-3">
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${labelColor}`}>{title}</div>
      <div className="space-y-2">
        {groups.map(group => {
          const isExpanded = expandedReason === group.reason;
          const isPreviousActivityPending = group.reason === 'Previous Activity Pending';
          return (
            <div key={group.reason}>
              <button
                onClick={() => setExpandedReason(isExpanded ? null : group.reason)}
                className={`w-full ${cardBg} border ${cardBorder} rounded-lg p-2.5 text-left cursor-pointer transition-colors hover:opacity-90`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-900">{group.reason}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${badgeBg} tabular-nums`}>
                    {group.flatCount} {group.flatCount === 1 ? 'flat' : 'flats'}
                  </span>
                </div>
                {/* Show first stage + floor summary inline */}
                {group.stages.length > 0 && (
                  <div className="text-[11px] text-gray-500 mt-1">
                    {group.stages.slice(0, 2).map(s =>
                      `${s.stage} · ${s.floors.map(f => `Fl ${f.floor}`).join(', ')}`
                    ).join(' | ')}
                    {group.stages.length > 2 && ` +${group.stages.length - 2} more`}
                  </div>
                )}
              </button>

              {/* Expanded detail: stage → floor · flats */}
              {isExpanded && (
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 mt-1 space-y-2">
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
                      {/* Show flat-level remarks for "Previous Activity Pending" */}
                      {isPreviousActivityPending && stage.floors.some(f => f.flatRemarks && f.flatRemarks.length > 0) && (
                        <div className="mt-1.5 space-y-1">
                          {stage.floors.map(f =>
                            f.flatRemarks?.map(fr => (
                              <div key={`${f.floor}-${fr.flatNumber}`} className="flex items-start gap-1.5 text-[11px] bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                                <span className="font-semibold text-amber-700 whitespace-nowrap">Flat {fr.flatNumber}:</span>
                                <span className="text-gray-700 italic">{fr.remarks}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
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

function ActiveBlockers({ data }: Props) {
  const { delayed, onHold, totalFloors, totalActivities } = data;

  if (totalActivities === 0) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-200">
        <div>
          <h4 className="text-sm font-bold text-gray-900">Active Blockers</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">Needs management attention</p>
        </div>
        <div className="flex flex-col items-center bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 min-w-[48px]">
          <span className="text-lg font-extrabold text-red-500 leading-tight tabular-nums">{totalFloors}</span>
          <span className="text-[8px] font-bold text-red-500 uppercase tracking-wide">Total</span>
        </div>
      </div>

      {/* Scrollable blocker content */}
      <div className="max-h-[420px] overflow-y-auto">
        {/* Overdue — Not Started */}
        <BlockerSection title="Overdue — Not Started" colorClass="red" groups={delayed} />

        {/* Separator */}
        {delayed.length > 0 && onHold.length > 0 && (
          <div className="border-t border-gray-100 mx-3.5" />
        )}

        {/* On Hold */}
        <BlockerSection title="On Hold" colorClass="amber" groups={onHold} />
      </div>
    </div>
  );
}

export default memo(ActiveBlockers);
