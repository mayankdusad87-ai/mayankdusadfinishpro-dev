'use client';

import { useState, useMemo } from 'react';
import StatusCards from '@/components/admin/StatusCards';
import FilterBar, { Filters } from '@/components/admin/FilterBar';
import StatusPill from '@/components/shared/StatusPill';
import { activityRows, statusCounts, criticalDelays, projects } from '@/lib/mock-data';
import { ActivityStatus } from '@/lib/types';

const STAGES = [
  'Pre-Tiling', 'Tiling', 'Post Tiling', 'Pre Paint Activities',
  '1st Coat Paint', 'Post First Coat Paint', 'Second Coat Paint',
  'Post Second Coat Paint', 'Lobby Flooring',
];

const PER_PAGE = 10;

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | null>(null);
  const [filters, setFilters] = useState<Filters>({
    project: '', floor: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '',
  });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const floors = useMemo(() =>
    [...new Set(activityRows.map(r => r.floor_label).filter(Boolean))] as string[],
    []
  );
  const stageGates = useMemo(() =>
    [...new Set(activityRows.map(r => r.stage_gate_name).filter(Boolean))] as string[],
    []
  );
  const vendors = useMemo(() =>
    [...new Set(activityRows.map(r => r.vendor_name).filter(Boolean))] as string[],
    []
  );

  const filtered = useMemo(() => {
    return activityRows.filter(row => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (filters.floor && row.floor_label !== filters.floor) return false;
      if (filters.stage && row.stage_name !== filters.stage) return false;
      if (filters.stageGate && row.stage_gate_name !== filters.stageGate) return false;
      if (filters.vendor && row.vendor_name !== filters.vendor) return false;
      if (filters.status && row.status !== filters.status) return false;
      return true;
    });
  }, [statusFilter, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  function toggleRow(id: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedRows.size === paginated.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginated.map(r => r.id)));
    }
  }

  function clearFilters() {
    setFilters({ project: '', floor: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '' });
    setStatusFilter(null);
    setCurrentPage(1);
  }

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-5">
        <StatusCards counts={statusCounts} activeFilter={statusFilter} onFilterChange={(s) => { setStatusFilter(s); setCurrentPage(1); }} />

        <FilterBar
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); setCurrentPage(1); }}
          onApply={() => setCurrentPage(1)}
          onClear={clearFilters}
          projects={projects.map(p => p.name)}
          floors={floors}
          stages={STAGES}
          stageGates={stageGates}
          vendors={vendors}
        />

        {/* Bulk toolbar */}
        {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked readOnly className="accent-[#E67E22] w-4 h-4" />
              <span className="text-sm font-medium text-blue-800">{selectedRows.size} rows selected</span>
            </div>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600">Bulk Actions:</span>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
              Export
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
              Reassign Vendor
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
              Update Expected Dates
            </button>
          </div>
        )}

        {/* Activity Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={selectedRows.size === paginated.length && paginated.length > 0} onChange={toggleAll} className="accent-[#E67E22] w-4 h-4" />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Floor</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Flat No.</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Config</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Stage</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Stage Gate</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Activity</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Vendor</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Exp. Start</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Exp. End</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Act. Start</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Act. End</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Status</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Delay Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(row => (
                  <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${selectedRows.has(row.id) ? 'bg-orange-50/50' : ''}`}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} className="accent-[#E67E22] w-4 h-4" />
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{row.floor_number}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.flat_number}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.configuration}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{row.stage_name}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[90px] truncate">{row.stage_gate_name}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{row.activity_name}</td>
                    <td className="px-3 py-2.5 text-gray-600 max-w-[90px] truncate">{row.vendor_name}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{row.expected_start_date}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{row.expected_end_date}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{row.actual_start_date || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{row.actual_end_date || '-'}</td>
                    <td className="px-3 py-2.5"><StatusPill status={row.status} /></td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">
                      {row.delay_reason_notes || row.hold_reason_notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <span className="text-sm text-gray-500">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1} to {Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length.toLocaleString()} activities
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&laquo;</button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&lsaquo;</button>
              {getPageNumbers().map((p, i) =>
                p === '...' ? (
                  <span key={`d${i}`} className="px-2 py-1 text-xs text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[28px] px-2 py-1 rounded text-xs font-medium ${safePage === p ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {p}
                  </button>
                )
              )}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&rsaquo;</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&raquo;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Delays Panel */}
      <aside className="w-72 shrink-0 hidden xl:block">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Critical Delays</h3>
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mb-4">Top 5 late activities</p>

          <div className="space-y-3">
            {criticalDelays.map((d) => (
              <div key={d.id} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900">{d.flat}</span>
                  <StatusPill status="delayed" />
                </div>
                <div className="text-xs text-gray-600 mb-0.5">{d.activity}</div>
                <div className="text-[11px] text-gray-400">{d.floor} &bull; {d.stagegate}</div>
                <div className="text-[11px] text-gray-400">Vendor: {d.vendor}</div>
                <div className="text-xs font-semibold text-red-600 mt-1">Overdue by {d.overdue_days} day{d.overdue_days > 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-orange-50 transition-colors">
            View All Delays
          </button>
        </div>
      </aside>
    </div>
  );
}
