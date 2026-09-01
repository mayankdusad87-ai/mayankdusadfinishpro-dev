'use client';

import { memo } from 'react';
import { HeatmapData, RollupCell } from '@/lib/floor-rollup';

interface FloorHeatmapProps {
  data: HeatmapData;
  projectName: string;
}

const STAGE_COLORS: Record<string, string> = {
  'Pre-Tiling': 'bg-green-600',
  'Pre Tiling': 'bg-green-600',
  'Tiling': 'bg-blue-600',
  'Post Tiling': 'bg-red-600',
  'Post-Tiling': 'bg-red-600',
  'Pre Paint Activities': 'bg-orange-500',
  'Pre Paint readiness': 'bg-orange-500',
  '1st Coat Paint': 'bg-purple-500',
  'First Coat Paint': 'bg-purple-500',
  'Post First Coat Paint': 'bg-pink-500',
  'Second Coat Paint': 'bg-indigo-500',
  'Post Second Coat Paint': 'bg-teal-500',
  'Lobby Flooring': 'bg-cyan-600',
};

function getStageColor(stage: string): string {
  return STAGE_COLORS[stage] || 'bg-gray-600';
}

const MILESTONE_1_STAGES = [
  'pre-tiling', 'pre tiling',
  'tiling',
  'post tiling', 'post-tiling',
  'pre paint activities', 'pre paint readiness',
  '1st coat paint', 'first coat paint',
];

function isMilestone1(stage: string): boolean {
  return MILESTONE_1_STAGES.includes(stage.toLowerCase());
}

function cellStyle(cell: RollupCell): string {
  if (cell.total === 0) return 'bg-gray-100 text-gray-400';
  switch (cell.label) {
    case 'completed': return 'bg-green-100 text-green-800 font-medium';
    case 'running': return 'bg-yellow-100 text-yellow-800 font-medium';
    case 'yet_to_start': return 'bg-red-100 text-red-800 font-medium';
  }
}

function cellIcon(cell: RollupCell): string {
  if (cell.total === 0) return '';
  switch (cell.label) {
    case 'completed': return '✓ ';
    case 'running': return '▶ ';
    case 'yet_to_start': return '○ ';
  }
}

function cellText(cell: RollupCell): string {
  if (cell.total === 0) return '-';
  switch (cell.label) {
    case 'completed': return `${cellIcon(cell)}Done (${cell.completed}/${cell.total})`;
    case 'running': return `${cellIcon(cell)}WIP (${cell.running}/${cell.total})`;
    case 'yet_to_start': return `${cellIcon(cell)}Pending (0/${cell.total})`;
  }
}

function readinessStyle(r: string): string {
  switch (r) {
    case 'completed': return 'bg-green-100 text-green-800 font-medium';
    case 'running': return 'bg-yellow-100 text-yellow-800 font-medium';
    default: return 'bg-gray-100 text-gray-600 font-medium';
  }
}

function readinessText(r: string): string {
  switch (r) {
    case 'completed': return 'Ready';
    case 'running': return 'Running';
    default: return 'Not Ready';
  }
}

function FloorHeatmap({ data, projectName }: FloorHeatmapProps) {
  if (data.stages.length === 0) return null;

  // Split stages into milestones
  const m1Stages = data.stages.filter(s => isMilestone1(s));
  const m2Stages = data.stages.filter(s => !isMilestone1(s));
  const m2Boundary = m2Stages.length > 0 ? m2Stages[0] : null;

  // Extra left border on the first M2 stage column to visually separate milestones
  const mBorder = (stage: string) =>
    stage === m2Boundary ? ' border-l-[3px] border-l-gray-900' : '';

  return (
    <div className="space-y-5">
      {/* Title Bar */}
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl">
        <h2 className="text-lg font-bold tracking-wide text-center">
          {projectName.toUpperCase()} — FLOOR HEATMAP — Stage Progress
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 px-1">
        <div className="hidden md:flex items-center bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Floor Readiness</span>
        </div>

        {/* Equal-width tiles */}
        <div className="flex gap-3 md:gap-4 flex-1 max-w-xl">
          <div className="flex-1 bg-white border border-gray-200 rounded-lg py-3 shadow-sm text-center">
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{data.floorsFirstCoatDone}</div>
            <div className="text-[11px] md:text-xs text-gray-500 mt-0.5">Fully Ready</div>
            <div className="text-[11px] text-gray-400">Upto First Coat Paint</div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg py-3 shadow-sm text-center">
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{data.floorsInProgress}</div>
            <div className="text-[11px] md:text-xs text-gray-500 mt-0.5">In Progress</div>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-lg py-3 shadow-sm text-center">
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{data.floorsLobbyDone}</div>
            <div className="text-[11px] md:text-xs text-gray-500 mt-0.5">Lobby Readiness</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:ml-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> Running
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Yet to Start
          </span>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="md:hidden flex items-center gap-1.5 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
          Scroll horizontally to see all stages
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Milestone Header Row */}
              <tr>
                <th rowSpan={2} className="bg-gray-100 border border-gray-200 px-3 py-2 text-left text-gray-600 font-semibold min-w-[80px]" />
                {m1Stages.length > 0 && (
                  <th
                    colSpan={m1Stages.length}
                    className="bg-[#162032] text-white border border-gray-200 px-3 py-2 text-center font-bold text-sm tracking-wider"
                  >
                    MILESTONE 1
                  </th>
                )}
                {m2Stages.length > 0 && (
                  <th
                    colSpan={m2Stages.length}
                    className="bg-[#1e3a5f] text-white border border-gray-200 border-l-[3px] border-l-gray-900 px-3 py-2 text-center font-bold text-sm tracking-wider"
                  >
                    MILESTONE 2
                  </th>
                )}
                <th rowSpan={2} className="bg-gray-700 text-white border border-gray-200 px-3 py-2 text-center font-semibold min-w-[100px]">
                  Floor<br />Readiness
                </th>
              </tr>

              {/* Stage Header Row */}
              <tr>
                {data.stages.map(stage => (
                  <th
                    key={stage}
                    className={`${getStageColor(stage)} text-white border border-gray-200 px-3 py-2 text-center font-semibold min-w-[130px]${mBorder(stage)}`}
                  >
                    {stage}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Stage Wise Completion (Floors) */}
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                  Completion<br />(Floors)
                </td>
                {data.stages.map(stage => {
                  const cell = data.stageCompletionFloors[stage];
                  return (
                    <td key={stage} className={`border border-gray-200 px-3 py-2 text-center${mBorder(stage)} ${cell ? cellStyle(cell) : 'bg-gray-100'}`}>
                      {cell ? `${cell.completed}/${cell.total}` : '-'}
                    </td>
                  );
                })}
                <td className="border border-gray-200 bg-gray-50" />
              </tr>

              {/* Stage Wise Completion (Units) */}
              <tr className="bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                  Completion<br />(Units)
                </td>
                {data.stages.map(stage => {
                  const cell = data.stageCompletionUnits[stage];
                  return (
                    <td key={stage} className={`border border-gray-200 px-3 py-2 text-center${mBorder(stage)} ${cell ? cellStyle(cell) : 'bg-gray-100'}`}>
                      {cell ? `${cell.completed}/${cell.total}` : '-'}
                    </td>
                  );
                })}
                <td className="border border-gray-200 bg-gray-50" />
              </tr>

              {/* Spacer */}
              <tr>
                <td colSpan={data.stages.length + 2} className="h-1 bg-gray-300" />
              </tr>

              {/* Milestone + Stage Header Row (repeated for clarity) */}
              <tr>
                <td className="bg-gray-100 border border-gray-200 px-3 py-1 font-semibold text-gray-600" />
                {m1Stages.length > 0 && (
                  <td
                    colSpan={m1Stages.length}
                    className="bg-[#162032] text-white border border-gray-200 px-3 py-1 text-center font-bold text-[11px] tracking-wider"
                  >
                    MILESTONE 1
                  </td>
                )}
                {m2Stages.length > 0 && (
                  <td
                    colSpan={m2Stages.length}
                    className="bg-[#1e3a5f] text-white border border-gray-200 border-l-[3px] border-l-gray-900 px-3 py-1 text-center font-bold text-[11px] tracking-wider"
                  >
                    MILESTONE 2
                  </td>
                )}
                <td className="bg-gray-700 border border-gray-200" />
              </tr>
              <tr>
                <td className="bg-gray-100 border border-gray-200 px-3 py-2 font-semibold text-gray-600">Floor</td>
                {data.stages.map(stage => (
                  <td key={stage} className={`${getStageColor(stage)} text-white border border-gray-200 px-3 py-2 text-center font-semibold${mBorder(stage)}`}>
                    {stage}
                  </td>
                ))}
                <td className="bg-gray-700 text-white border border-gray-200 px-3 py-2 text-center font-semibold">
                  Floor Readiness
                </td>
              </tr>

              {/* Floor Rows */}
              {data.floors.map(row => (
                <tr key={row.floor} className="hover:bg-gray-50/50 transition-colors">
                  <td className="border border-gray-200 px-3 py-2.5 font-bold text-gray-900 text-center bg-gray-50">
                    {row.floor}
                  </td>
                  {data.stages.map(stage => {
                    const cell = row.stages[stage];
                    return (
                      <td key={stage} className={`border border-gray-200 px-2 py-2.5 text-center${mBorder(stage)} ${cellStyle(cell)}`}>
                        {cellText(cell)}
                      </td>
                    );
                  })}
                  <td className={`border border-gray-200 px-3 py-2.5 text-center ${readinessStyle(row.readiness)}`}>
                    {readinessText(row.readiness)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default memo(FloorHeatmap);
