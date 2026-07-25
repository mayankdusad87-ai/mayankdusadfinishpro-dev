'use client';

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

function cellStyle(cell: RollupCell): string {
  if (cell.total === 0) return 'bg-gray-100 text-gray-400';
  switch (cell.label) {
    case 'completed': return 'bg-green-100 text-green-800 font-medium';
    case 'running': return 'bg-yellow-100 text-yellow-800 font-medium';
    case 'yet_to_start': return 'bg-red-100 text-red-800 font-medium';
  }
}

function cellText(cell: RollupCell): string {
  if (cell.total === 0) return '-';
  switch (cell.label) {
    case 'completed': return `Completed (${cell.completed}/${cell.total})`;
    case 'running': return `Running (${cell.running}/${cell.total})`;
    case 'yet_to_start': return `Yet to Start (0/${cell.total})`;
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

export default function FloorHeatmap({ data, projectName }: FloorHeatmapProps) {
  if (data.stages.length === 0) return null;

  return (
    <div className="space-y-5">
      {/* Title Bar */}
      <div className="bg-gray-900 text-white px-5 py-3 rounded-t-xl">
        <h2 className="text-lg font-bold tracking-wide text-center">
          {projectName.toUpperCase()} — FLOOR HEATMAP — Stage Progress
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Floor Readiness</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm text-center min-w-[100px]">
          <div className="text-3xl font-bold text-gray-900">{data.floorsFullyReady}</div>
          <div className="text-xs text-gray-500 mt-0.5">Floors Fully Ready</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-5 py-3 shadow-sm text-center min-w-[100px]">
          <div className="text-3xl font-bold text-gray-900">{data.floorsInProgress}</div>
          <div className="text-xs text-gray-500 mt-0.5">Floors In Progress</div>
        </div>

        {/* Legend */}
        <div className="ml-auto flex flex-wrap gap-x-4 gap-y-1 text-xs">
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* Stage Header */}
            <thead>
              <tr>
                <th className="bg-gray-100 border border-gray-200 px-3 py-2 text-left text-gray-600 font-semibold min-w-[80px]" />
                {data.stages.map(stage => (
                  <th
                    key={stage}
                    className={`${getStageColor(stage)} text-white border border-gray-200 px-3 py-2 text-center font-semibold min-w-[130px]`}
                  >
                    {stage}
                  </th>
                ))}
                <th className="bg-gray-700 text-white border border-gray-200 px-3 py-2 text-center font-semibold min-w-[100px]">
                  Floor Readiness
                </th>
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
                    <td key={stage} className={`border border-gray-200 px-3 py-2 text-center ${cell ? cellStyle(cell) : 'bg-gray-100'}`}>
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
                    <td key={stage} className={`border border-gray-200 px-3 py-2 text-center ${cell ? cellStyle(cell) : 'bg-gray-100'}`}>
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

              {/* Stage Header Row (repeated for clarity) */}
              <tr>
                <td className="bg-gray-100 border border-gray-200 px-3 py-2 font-semibold text-gray-600">Floor</td>
                {data.stages.map(stage => (
                  <td key={stage} className={`${getStageColor(stage)} text-white border border-gray-200 px-3 py-2 text-center font-semibold`}>
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
                      <td key={stage} className={`border border-gray-200 px-2 py-2.5 text-center ${cellStyle(cell)}`}>
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
