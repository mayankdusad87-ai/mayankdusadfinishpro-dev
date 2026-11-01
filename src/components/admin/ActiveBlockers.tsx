'use client';

import { memo, useState } from 'react';
import type { ActiveBlockers as ActiveBlockersData, BlockerGroup } from '@/lib/insights-data';

interface Props {
  data: ActiveBlockersData;
  projectName?: string;
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

function PipelineQueueSection({ groups }: { groups: BlockerGroup[] }) {
  const [expanded, setExpanded] = useState(false);

  if (groups.length === 0) return null;

  const totalFlats = groups.reduce((sum, g) => sum + g.flatCount, 0);
  const stageNames = groups.flatMap(g => g.stages.map(s => s.stage));
  const uniqueStages = [...new Set(stageNames)];

  return (
    <div className="px-3.5 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-gray-400">Pipeline Queue</div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-left cursor-pointer transition-colors hover:bg-gray-100"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[13px] font-semibold text-gray-600">Waiting for earlier stages</span>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {uniqueStages.slice(0, 3).join(', ')}{uniqueStages.length > 3 ? ` +${uniqueStages.length - 3} more` : ''}
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500 tabular-nums">
            {totalFlats} {totalFlats === 1 ? 'flat' : 'flats'}
          </span>
        </div>
      </button>

      {expanded && groups.map(group => (
        <div key={group.reason} className="bg-gray-50 rounded-lg px-3 py-2.5 mt-1 space-y-2">
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
      ))}
    </div>
  );
}

function formatBlockerGroupsForShare(label: string, groups: BlockerGroup[]): string {
  if (groups.length === 0) return '';
  const lines = groups.map(g => {
    const floors = g.stages.flatMap(s => s.floors.map(f => f.floor));
    const uniqueFloors = [...new Set(floors)].sort((a, b) => a - b);
    const floorText = uniqueFloors.length <= 5
      ? uniqueFloors.map(f => `Fl ${f}`).join(', ')
      : `${uniqueFloors.slice(0, 4).map(f => `Fl ${f}`).join(', ')} +${uniqueFloors.length - 4} more`;
    return `• ${g.reason} — ${g.flatCount} flat${g.flatCount !== 1 ? 's' : ''} (${floorText})`;
  });
  return `*${label}:*\n${lines.join('\n')}`;
}

function shareBlockersOnWhatsApp(data: ActiveBlockersData, projectName: string) {
  const parts: string[] = [`🚧 *Active Blockers — ${projectName}*\n`];

  const delayed = formatBlockerGroupsForShare('Overdue — Not Started', data.delayed);
  if (delayed) parts.push(delayed);

  const onHold = formatBlockerGroupsForShare('On Hold — Needs Action', data.onHoldExternal);
  if (onHold) parts.push(onHold);

  const pipelineFlats = data.onHoldPipeline.reduce((s, g) => s + g.flatCount, 0);
  if (pipelineFlats > 0) {
    parts.push(`Pipeline Queue: ${pipelineFlats} flat${pipelineFlats !== 1 ? 's' : ''} waiting`);
  }

  parts.push('— FinishPro Dashboard');

  const text = parts.join('\n\n');
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function ActiveBlockers({ data, projectName }: Props) {
  const { delayed, onHoldExternal, onHoldPipeline, totalFloors, totalActivities } = data;

  if (totalActivities === 0) return null;

  const actionableCount = delayed.reduce((s, g) => s + g.floorCount, 0)
    + onHoldExternal.reduce((s, g) => s + g.floorCount, 0);
  const pipelineFlats = onHoldPipeline.reduce((s, g) => s + g.flatCount, 0);
  const hasActionable = delayed.length > 0 || onHoldExternal.length > 0;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-200">
        <div>
          <h4 className="text-sm font-bold text-gray-900">Active Blockers</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">Needs management attention</p>
        </div>
        <div className="flex items-center gap-2">
          {projectName && (
            <button
              onClick={() => shareBlockersOnWhatsApp(data, projectName)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              title="Share on WhatsApp"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
          )}
          {pipelineFlats > 0 && (
            <div className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 min-w-[44px]">
              <span className="text-sm font-extrabold text-gray-400 leading-tight tabular-nums">{pipelineFlats}</span>
              <span className="text-[7px] font-bold text-gray-400 uppercase tracking-wide">Queue</span>
            </div>
          )}
          <div className="flex flex-col items-center bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 min-w-[48px]">
            <span className="text-lg font-extrabold text-red-500 leading-tight tabular-nums">{actionableCount}</span>
            <span className="text-[8px] font-bold text-red-500 uppercase tracking-wide">Blocked</span>
          </div>
        </div>
      </div>

      {/* Scrollable blocker content */}
      <div className="max-h-[420px] overflow-y-auto">
        {/* Overdue — Not Started */}
        <BlockerSection title="Overdue — Not Started" colorClass="red" groups={delayed} />

        {/* Separator */}
        {delayed.length > 0 && onHoldExternal.length > 0 && (
          <div className="border-t border-gray-100 mx-3.5" />
        )}

        {/* External blockers (actionable) */}
        <BlockerSection title="On Hold — Needs Action" colorClass="amber" groups={onHoldExternal} />

        {/* Separator */}
        {hasActionable && onHoldPipeline.length > 0 && (
          <div className="border-t border-gray-100 mx-3.5" />
        )}

        {/* Pipeline queue (informational) */}
        <PipelineQueueSection groups={onHoldPipeline} />
      </div>
    </div>
  );
}

export default memo(ActiveBlockers);
