'use client';

import { STATUS_OPTIONS } from './supervisor-utils';

interface SupervisorFiltersProps {
  stageFilter: string;
  subStageOptions: string[];
  activityOptions: string[];
  subStageFilter: string;
  activityFilter: string;
  statusDropdown: string;
  onSubStageChange: (value: string) => void;
  onActivityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export default function SupervisorFilters({
  stageFilter,
  subStageOptions,
  activityOptions,
  subStageFilter,
  activityFilter,
  statusDropdown,
  onSubStageChange,
  onActivityChange,
  onStatusChange,
}: SupervisorFiltersProps) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      <select
        value={subStageFilter}
        onChange={(e) => onSubStageChange(e.target.value)}
        disabled={!stageFilter}
        className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50 disabled:bg-gray-100"
      >
        <option value="">Sub Stage</option>
        {subStageOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <select
        value={activityFilter}
        onChange={(e) => onActivityChange(e.target.value)}
        disabled={!subStageFilter}
        className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50 disabled:bg-gray-100"
      >
        <option value="">Activities</option>
        {activityOptions.map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      <select
        value={statusDropdown}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
      >
        {STATUS_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
