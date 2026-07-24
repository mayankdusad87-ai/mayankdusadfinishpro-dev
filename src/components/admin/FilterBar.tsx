'use client';

import { ActivityStatus } from '@/lib/types';

export interface Filters {
  project: string;
  floor: string;
  stage: string;
  stageGate: string;
  vendor: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface FilterBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onApply: () => void;
  onClear: () => void;
  projects: string[];
  floors: string[];
  stages: string[];
  stageGates: string[];
  vendors: string[];
}

const STATUS_OPTIONS: { value: ActivityStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On Hold' },
];

export default function FilterBar({
  filters,
  onFiltersChange,
  onApply,
  onClear,
  projects,
  floors,
  stages,
  stageGates,
  vendors,
}: FilterBarProps) {
  function update(key: keyof Filters, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const selectClass =
    'h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Project */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Project</label>
          <select
            className={selectClass}
            value={filters.project}
            onChange={(e) => update('project', e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Floor */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Floor</label>
          <select
            className={selectClass}
            value={filters.floor}
            onChange={(e) => update('floor', e.target.value)}
          >
            <option value="">All Floors</option>
            {floors.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Stage */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Stage</label>
          <select
            className={selectClass}
            value={filters.stage}
            onChange={(e) => update('stage', e.target.value)}
          >
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Stage Gate */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Stage Gate</label>
          <select
            className={selectClass}
            value={filters.stageGate}
            onChange={(e) => update('stageGate', e.target.value)}
          >
            <option value="">All Stage Gates</option>
            {stageGates.map((sg) => (
              <option key={sg} value={sg}>{sg}</option>
            ))}
          </select>
        </div>

        {/* Vendor */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Vendor</label>
          <select
            className={selectClass}
            value={filters.vendor}
            onChange={(e) => update('vendor', e.target.value)}
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => update('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Date Range</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className={selectClass}
              value={filters.dateFrom}
              onChange={(e) => update('dateFrom', e.target.value)}
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              className={selectClass}
              value={filters.dateTo}
              onChange={(e) => update('dateTo', e.target.value)}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={onClear}
            className="h-9 px-4 rounded-md border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Clear
          </button>
          <button
            onClick={onApply}
            className="h-9 px-4 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
