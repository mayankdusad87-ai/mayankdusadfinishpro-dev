'use client';

import { memo } from 'react';
import { HeatmapData, RollupCell } from '@/lib/floor-rollup';

interface FloorHeatmapProps {
  data: HeatmapData;
  projectName: string;
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

/* ── Cell rendering helpers ─────────────────────────────────── */

function cellBg(cell: RollupCell): string {
  if (cell.total === 0) return 'bg-gray-50';
  switch (cell.label) {
    case 'completed': return 'bg-emerald-50';
    case 'running': return 'bg-amber-50';
    case 'yet_to_start': return 'bg-red-50';
  }
}

function pillClass(cell: RollupCell): string {
  if (cell.total === 0) return 'bg-gray-100 text-gray-400';
  switch (cell.label) {
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'running': return 'bg-amber-100 text-amber-700';
    case 'yet_to_start': return 'bg-red-100 text-red-700';
  }
}

function cellIcon(label: RollupCell['label']): string {
  switch (label) {
    case 'completed': return '✓';
    case 'running': return '▶';
    case 'yet_to_start': return '○';
  }
}

function cellContent(cell: RollupCell): string {
  if (cell.total === 0) return '–';
  switch (cell.label) {
    case 'completed': return `${cellIcon(cell.label)} Completed (${cell.completed}/${cell.total})`;
    case 'running': return `${cellIcon(cell.label)} Running (${cell.running}/${cell.total})`;
    case 'yet_to_start': return `${cellIcon(cell.label)} Yet to Start (0/${cell.total})`;
  }
}

function readinessStyle(r: string): string {
  switch (r) {
    case 'completed': return 'bg-emerald-50 text-emerald-700';
    case 'running': return 'bg-amber-50 text-amber-700';
    default: return 'bg-gray-50 text-gray-500';
  }
}

function readinessText(r: string): string {
  switch (r) {
    case 'completed': return '✓ Ready';
    case 'running': return '▶ Running';
    default: return 'Not Ready';
  }
}

/* ── Component ──────────────────────────────────────────────── */

function FloorHeatmap({ data, projectName }: FloorHeatmapProps) {
  if (data.stages.length === 0) return null;

  const m1Stages = data.stages.filter(s => isMilestone1(s));
  const m2Stages = data.stages.filter(s => !isMilestone1(s));
  const m2Boundary = m2Stages.length > 0 ? m2Stages[0] : null;
  const goldBorder = (stage: string) =>
    stage === m2Boundary ? ' border-l-2 border-l-primary' : '';

  return (
    <div className="space-y-4">
      {/* ── Title Bar ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-navy to-navy-light text-white px-6 py-4 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-lg font-bold tracking-widest font-heading">
            {projectName.toUpperCase()} — <span className="text-primary">FLOOR HEATMAP</span>
          </h2>
          <p className="text-[11px] text-gray-400 tracking-wide mt-0.5">Stage Progress Overview</p>
        </div>
        <div className="hidden md:flex items-center gap-1 text-[11px] text-gray-400">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
          </svg>
          {data.stages.length} Stages
        </div>
      </div>

      {/* ── Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="text-2xl md:text-3xl font-bold text-navy tabular-nums">{data.floorsFirstCoatDone}</div>
          <div className="text-[11px] md:text-xs text-gray-500 font-medium mt-1 uppercase tracking-wider">Fully Ready</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Upto First Coat Paint</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="text-2xl md:text-3xl font-bold text-navy tabular-nums">{data.floorsInProgress}</div>
          <div className="text-[11px] md:text-xs text-gray-500 font-medium mt-1 uppercase tracking-wider">In Progress</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="text-2xl md:text-3xl font-bold text-navy tabular-nums">{data.floorsLobbyDone}</div>
          <div className="text-[11px] md:text-xs text-gray-500 font-medium mt-1 uppercase tracking-wider">Lobby Done</div>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Running</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Yet to Start</span>
      </div>

      {/* ── Heatmap Table ──────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Mobile scroll hint */}
        <div className="md:hidden flex items-center gap-1.5 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-400">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
          Scroll to see all stages
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Milestone row */}
              <tr>
                <th rowSpan={2} className="bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left text-gray-500 font-semibold min-w-[72px]" />
                {m1Stages.length > 0 && (
                  <th colSpan={m1Stages.length} className="bg-navy text-white border-b border-gray-200 px-3 py-2.5 text-center font-bold text-[11px] tracking-[0.12em]">
                    MILESTONE 1
                  </th>
                )}
                {m2Stages.length > 0 && (
                  <th colSpan={m2Stages.length} className="bg-navy-light text-white border-b border-l-2 border-l-primary border-gray-200 px-3 py-2.5 text-center font-bold text-[11px] tracking-[0.12em]">
                    MILESTONE 2
                  </th>
                )}
                <th rowSpan={2} className="bg-gray-700 text-white border-b border-gray-200 px-3 py-2 text-center font-semibold min-w-[90px] text-[11px]">
                  Floor<br />Readiness
                </th>
              </tr>

              {/* Stage names row */}
              <tr>
                {data.stages.map(stage => (
                  <th key={stage} className={`bg-gray-100 text-gray-700 border-b-2 border-b-gray-200 border-r border-gray-100 px-3 py-2 text-center font-semibold min-w-[130px] text-[10px] uppercase tracking-wider${goldBorder(stage)}`}>
                    {stage}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Completion (Floors) */}
              <tr>
                <td className="border-b border-r border-gray-200 px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap bg-gray-50 text-[10px] uppercase tracking-wide">
                  Floors ✓
                </td>
                {data.stages.map(stage => {
                  const cell = data.stageCompletionFloors[stage];
                  return (
                    <td key={stage} className={`border-b border-r border-gray-100 px-2 py-2 text-center${goldBorder(stage)} ${cell ? cellBg(cell) : 'bg-gray-50'}`}>
                      {cell ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${pillClass(cell)}`}>
                          {cell.completed}/{cell.total}
                        </span>
                      ) : '–'}
                    </td>
                  );
                })}
                <td className="border-b border-gray-200 bg-gray-50" />
              </tr>

              {/* Completion (Units) */}
              <tr>
                <td className="border-b border-r border-gray-200 px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap bg-gray-50 text-[10px] uppercase tracking-wide">
                  Units ✓
                </td>
                {data.stages.map(stage => {
                  const cell = data.stageCompletionUnits[stage];
                  return (
                    <td key={stage} className={`border-b border-r border-gray-100 px-2 py-2 text-center${goldBorder(stage)} ${cell ? cellBg(cell) : 'bg-gray-50'}`}>
                      {cell ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tabular-nums ${pillClass(cell)}`}>
                          {cell.completed}/{cell.total}
                        </span>
                      ) : '–'}
                    </td>
                  );
                })}
                <td className="border-b border-gray-200 bg-gray-50" />
              </tr>

              {/* Gold divider */}
              <tr>
                <td colSpan={data.stages.length + 2} className="h-[3px] bg-gradient-to-r from-primary via-primary/60 to-primary" />
              </tr>

              {/* Repeated milestone + stage header for floor section */}
              <tr>
                <td className="bg-gray-50 border-b border-r border-gray-200 px-3 py-1.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wide" />
                {m1Stages.length > 0 && (
                  <td colSpan={m1Stages.length} className="bg-navy text-white border-b border-gray-200 px-3 py-1.5 text-center font-bold text-[10px] tracking-[0.12em]">
                    MILESTONE 1
                  </td>
                )}
                {m2Stages.length > 0 && (
                  <td colSpan={m2Stages.length} className="bg-navy-light text-white border-b border-l-2 border-l-primary border-gray-200 px-3 py-1.5 text-center font-bold text-[10px] tracking-[0.12em]">
                    MILESTONE 2
                  </td>
                )}
                <td className="bg-gray-700 border-b border-gray-200" />
              </tr>
              <tr>
                <td className="bg-gray-50 border-b-2 border-b-gray-200 border-r border-gray-200 px-3 py-2 font-semibold text-gray-600 text-[10px] uppercase tracking-wide">Floor</td>
                {data.stages.map(stage => (
                  <td key={stage} className={`bg-gray-100 text-gray-700 border-b-2 border-b-gray-200 border-r border-gray-100 px-3 py-2 text-center font-semibold text-[10px] uppercase tracking-wider${goldBorder(stage)}`}>
                    {stage}
                  </td>
                ))}
                <td className="bg-gray-700 text-white border-b-2 border-b-gray-200 px-3 py-2 text-center font-semibold text-[10px] uppercase tracking-wide">
                  Readiness
                </td>
              </tr>

              {/* ── Floor data rows ──────────────────── */}
              {data.floors.map(row => (
                <tr key={row.floor} className="group hover:bg-primary/[0.03] transition-colors duration-150">
                  <td className="border-b border-r border-gray-200 px-3 py-3 font-bold text-navy text-center bg-gray-50 text-sm tabular-nums">
                    {row.floor}
                  </td>
                  {data.stages.map(stage => {
                    const cell = row.stages[stage];
                    return (
                      <td key={stage} className={`border-b border-r border-gray-100 px-1.5 py-2.5 text-center transition-all duration-150${goldBorder(stage)} ${cellBg(cell)} group-hover:brightness-[0.97]`}>
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${pillClass(cell)}`}>
                          {cellContent(cell)}
                        </span>
                      </td>
                    );
                  })}
                  <td className={`border-b border-gray-200 px-3 py-2.5 text-center font-semibold text-[11px] uppercase tracking-wide ${readinessStyle(row.readiness)}`}>
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
