'use client';

import { STATUS_OPTIONS } from './supervisor-utils';

interface SupervisorFiltersProps {
  stages: string[];
  subStageOptions: string[];
  activityOptions: string[];
  stageFilter: string;
  subStageFilter: string;
  activityFilter: string;
  statusDropdown: string;
  onStageChange: (value: string) => void;
  onSubStageChange: (value: string) => void;
  onActivityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export default function SupervisorFilters({
  stages,
  subStageOptions,
  activityOptions,
  stageFilter,
  subStageFilter,
  activityFilter,
  statusDropdown,
  onStageChange,
  onSubStageChange,
  onActivityChange,
  onStatusChange,
}: SupervisorFiltersProps) {
  const selectClass = 'h-12 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 w-full focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Stage</label>
        <select
          value={stageFilter}
          onChange={(e) => onStageChange(e.target.value)}
          className={selectClass}
        >
          <option value="">All Stages</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Sub Stage</label>
        <select
          value={subStageFilter}
          onChange={(e) => onSubStageChange(e.target.value)}
          disabled={!stageFilter}
          className={`${selectClass} disabled:opacity-50 disabled:bg-gray-100`}
        >
          <option value="">All Sub Stages</option>
          {subStageOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Activity</label>
        <select
          value={activityFilter}
          onChange={(e) => onActivityChange(e.target.value)}
          disabled={!subStageFilter}
          className={`${selectClass} disabled:opacity-50 disabled:bg-gray-100`}
        >
          <option value="">All Activities</option>
          {activityOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Status</label>
        <select
          value={statusDropdown}
          onChange={(e) => onStatusChange(e.target.value)}
          className={selectClass}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
