'use client';

import { useState, useMemo, useEffect } from 'react';
import { activityRows } from '@/lib/mock-data';
import { ActivityRow, ActivityStatus } from '@/lib/types';
import { getActivityConfig, ActivityConfig } from '@/lib/activity-config-store';

const ASSIGNED_FLOORS = [3, 4, 5];
const supervisorRows = activityRows.filter(r => ASSIGNED_FLOORS.includes(r.floor_number || 0));

const STATUS_CONFIG: Record<ActivityStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'NOT STARTED', bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'COMPLETED', bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { label: 'DELAYED', bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { label: 'ON HOLD', bg: 'bg-orange-100', text: 'text-orange-700' },
};

const STATUS_OPTIONS: { value: ActivityStatus | ''; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On Hold' },
];

export default function SupervisorHomePage() {
  const [activeFloor, setActiveFloor] = useState<number>(ASSIGNED_FLOORS[0]);
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | null>(null);
  const [stageFilter, setStageFilter] = useState('');
  const [subStageFilter, setSubStageFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [statusDropdown, setStatusDropdown] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<ActivityRow | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<ActivityConfig>({ stages: [], subStages: {}, activities: {} });

  useEffect(() => {
    setConfig(getActivityConfig());
  }, []);

  const subStageOptions = useMemo(() => {
    if (!stageFilter || !config.subStages[stageFilter]) return [];
    return config.subStages[stageFilter];
  }, [stageFilter, config]);

  const activityOptions = useMemo(() => {
    if (!stageFilter || !subStageFilter) return [];
    const key = `${stageFilter}||${subStageFilter}`;
    return config.activities[key] || [];
  }, [stageFilter, subStageFilter, config]);

  const floorRows = useMemo(() => {
    let rows = supervisorRows.filter(r => r.floor_number === activeFloor);
    if (statusFilter) rows = rows.filter(r => r.status === statusFilter);
    if (statusDropdown) rows = rows.filter(r => r.status === statusDropdown);
    if (stageFilter) rows = rows.filter(r => r.stage_name === stageFilter);
    if (subStageFilter) rows = rows.filter(r => r.stage_gate_name === subStageFilter);
    if (activityFilter) rows = rows.filter(r => r.activity_name === activityFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.flat_number?.toLowerCase().includes(q) ||
        r.activity_name?.toLowerCase().includes(q) ||
        r.vendor_name?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [activeFloor, statusFilter, statusDropdown, stageFilter, subStageFilter, activityFilter, search]);

  const statusCounts = useMemo(() => {
    const rows = supervisorRows.filter(r => r.floor_number === activeFloor);
    return {
      total: rows.length,
      in_progress: rows.filter(r => r.status === 'in_progress').length,
      delayed: rows.filter(r => r.status === 'delayed').length,
      on_hold: rows.filter(r => r.status === 'on_hold').length,
    };
  }, [activeFloor]);

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setStageFilter('');
    setSubStageFilter('');
    setActivityFilter('');
    setStatusDropdown('');
    setStatusFilter(null);
    setSearch('');
  }

  const hasFilters = stageFilter || subStageFilter || activityFilter || statusDropdown || statusFilter;

  return (
    <div className="min-h-screen bg-navy-dark flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
              <ellipse cx="20" cy="14" rx="16" ry="10" fill="#E67E22" />
              <rect x="6" y="14" width="28" height="4" rx="1" fill="#D35400" />
              <rect x="17" y="4" width="6" height="4" rx="2" fill="#E67E22" />
            </svg>
            <span className="text-lg font-bold text-white">Finishing <span className="text-primary">Pro</span></span>
          </div>
          <button className="relative p-2">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</span>
          </button>
        </div>

        {/* Project info */}
        <div className="flex items-center gap-3 bg-navy-light/50 rounded-xl px-3 py-2.5 mb-3">
          <div className="w-9 h-9 bg-navy rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm">Raghav Reserve</div>
            <div className="text-gray-400 text-xs">Residential Project</div>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        {/* Floor Tabs */}
        <div className="flex gap-2">
          {ASSIGNED_FLOORS.map(f => (
            <button
              key={f}
              onClick={() => { setActiveFloor(f); clearFilters(); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeFloor === f
                  ? 'bg-primary text-white'
                  : 'bg-navy-light text-gray-300 hover:bg-navy-light/80'
              }`}
            >
              Floor {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stats + Content area (white bg) */}
      <div className="flex-1 bg-gray-50 rounded-t-3xl px-4 pt-4 pb-24">
        {/* Summary strip */}
        <div className="flex gap-2 mb-4">
          {[
            { label: 'Total', count: statusCounts.total, filter: null as ActivityStatus | null },
            { label: 'In Progress', count: statusCounts.in_progress, filter: 'in_progress' as ActivityStatus },
            { label: 'Delayed', count: statusCounts.delayed, filter: 'delayed' as ActivityStatus },
            { label: 'On Hold', count: statusCounts.on_hold, filter: 'on_hold' as ActivityStatus },
          ].map(stat => (
            <button
              key={stat.label}
              onClick={() => setStatusFilter(statusFilter === stat.filter ? null : stat.filter)}
              className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                statusFilter === stat.filter
                  ? 'border-primary bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="text-xl font-bold text-gray-900">{stat.count}</div>
              <div className="text-[11px] text-gray-500">{stat.label}</div>
            </button>
          ))}
        </div>

        {/* Filters - Stage, Sub Stage, Activities, Status */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value); setSubStageFilter(''); setActivityFilter(''); }}
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
          >
            <option value="">Stage</option>
            {config.stages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={subStageFilter}
            onChange={(e) => { setSubStageFilter(e.target.value); setActivityFilter(''); }}
            disabled={!stageFilter}
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50 disabled:bg-gray-100"
          >
            <option value="">Sub Stage</option>
            {subStageOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            disabled={!subStageFilter}
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50 disabled:bg-gray-100"
          >
            <option value="">Activities</option>
            {activityOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select
            value={statusDropdown}
            onChange={(e) => setStatusDropdown(e.target.value)}
            className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-primary font-medium mb-3 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            Clear all filters
          </button>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Flat No., Activity or Vendor"
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Activity Cards */}
        <div className="space-y-3">
          {floorRows.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏗️</div>
              <h3 className="text-lg font-semibold text-gray-900">No activities found</h3>
              <p className="text-sm text-gray-500 mt-1">Try changing the filters or search keyword.</p>
            </div>
          ) : (
            floorRows.slice(0, 20).map(row => {
              const sc = STATUS_CONFIG[row.status];
              return (
                <div
                  key={row.id}
                  onClick={() => !bulkMode && setSelectedDetail(row)}
                  className="bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-start gap-3">
                      {bulkMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelection(row.id)}
                          className="accent-[#E67E22] w-5 h-5 mt-0.5"
                        />
                      )}
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          Flat {row.flat_number} &bull; {row.configuration}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {row.stage_name}
                        </div>
                        <div className="text-xs font-semibold text-primary mt-0.5">
                          Sub Stage: {row.stage_gate_name}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mt-1">{row.activity_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{row.vendor_name}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      {row.expected_start_date} → {row.expected_end_date}
                    </span>
                    {!bulkMode && (
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bulk Update Toggle Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-navy-dark border-t border-white/10 px-4 py-3 max-w-md mx-auto">
        {bulkMode && selectedIds.size > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-medium">{selectedIds.size} selected</span>
            <button
              onClick={() => { alert(`Bulk update ${selectedIds.size} rows (demo)`); setBulkMode(false); setSelectedIds(new Set()); }}
              className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg"
            >
              Update Selected
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-semibold">Bulk Update</div>
              <div className="text-gray-400 text-xs">Select multiple activities to update status.</div>
            </div>
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              className={`relative w-12 h-7 rounded-full transition-colors ${bulkMode ? 'bg-primary' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${bulkMode ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        )}
      </div>

      {/* Activity Detail Bottom Sheet */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedDetail(null)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-24">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedDetail.activity_name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Floor {selectedDetail.floor_number} &bull; Flat {selectedDetail.flat_number} &bull; {selectedDetail.stage_name}
                  </p>
                  <p className="text-xs text-primary font-medium mt-0.5">
                    Sub Stage: {selectedDetail.stage_gate_name}
                  </p>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Expected Start</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{selectedDetail.expected_start_date}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Expected End</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{selectedDetail.expected_end_date}</div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual Start</label>
                    <input type="date" defaultValue={selectedDetail.actual_start_date || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual End</label>
                    <input type="date" defaultValue={selectedDetail.actual_end_date || ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select defaultValue={selectedDetail.status} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary">
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vendor</label>
                  <input type="text" defaultValue={selectedDetail.vendor_name} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" readOnly />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Delay / Hold Reason</label>
                  <textarea
                    rows={2}
                    defaultValue={selectedDetail.delay_reason_notes || selectedDetail.hold_reason_notes || ''}
                    placeholder="Add reason if delayed or on hold..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>

                {/* Photo upload */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Photo Evidence</label>
                  <button className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                    Tap to take photo or upload
                  </button>
                </div>
              </div>
            </div>

            {/* Sticky save button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3">
              <button
                onClick={() => { alert('Saved (demo)'); setSelectedDetail(null); }}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
