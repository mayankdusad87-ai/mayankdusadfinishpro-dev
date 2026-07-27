'use client';

import { useState, useEffect, useMemo } from 'react';
import HealthScore from '@/components/admin/HealthScore';
import FilterBar, { Filters } from '@/components/admin/FilterBar';
import StatusPill from '@/components/shared/StatusPill';
import FloorHeatmap from '@/components/admin/FloorHeatmap';
import { useProject } from '@/lib/project-context';
import { getDashboardData, getActivitiesPage, getCriticalDelays, DashboardData } from '@/lib/supabase-data';
import { computeHeatmapFromRollup, HeatmapData } from '@/lib/floor-rollup';
import { ActivityStatus } from '@/lib/types';

const PER_PAGE = 25;

function normalizeStatus(s: string): ActivityStatus {
  if (s === 'in_progress' || s === 'in_progress_delayed') return 'in_progress';
  if (s === 'completed' || s === 'completed_delayed') return 'completed';
  if (s === 'delayed') return 'delayed';
  if (s === 'on_hold') return 'on_hold';
  return 'not_started';
}

type DashboardView = 'heatmap' | 'table';

export default function DashboardPage() {
  const { projects, currentProject } = useProject();
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DashboardView>('heatmap');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | null>(null);
  const [filters, setFilters] = useState<Filters>({
    project: '', floor: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '',
  });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Table data (loaded on demand)
  const [tableRows, setTableRows] = useState<Array<Record<string, unknown>>>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [criticalDelays, setCriticalDelays] = useState<Array<Record<string, unknown>>>([]);

  // Reset all state when project changes
  useEffect(() => {
    setDashData(null);
    setTableRows([]);
    setTableTotal(0);
    setCriticalDelays([]);
    setCurrentPage(1);
    setSelectedRows(new Set());
    setFilters({ project: '', floor: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '' });
    setStatusFilter(null);

    async function load() {
      if (!currentProject) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getDashboardData(currentProject.id);
        setDashData(data);
      } catch {
        setDashData(null);
      }
      setLoading(false);
    }
    load();
  }, [currentProject]);

  // Build active filters for table query
  const activeFilters = useMemo(() => {
    const f: { floor?: string; stage?: string; stageGate?: string; vendor?: string; status?: string } = {};
    if (filters.floor) f.floor = filters.floor;
    if (filters.stage) f.stage = filters.stage;
    if (filters.stageGate) f.stageGate = filters.stageGate;
    if (filters.vendor) f.vendor = filters.vendor;
    if (filters.status) f.status = filters.status;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [filters, statusFilter]);

  // Load table data only when table view is active
  useEffect(() => {
    if (!currentProject || view !== 'table') return;
    let cancelled = false;
    async function load() {
      setTableLoading(true);
      const [pageResult, delays] = await Promise.all([
        getActivitiesPage(currentProject!.id, activeFilters, currentPage, PER_PAGE),
        getCriticalDelays(currentProject!.id),
      ]);
      if (cancelled) return;
      setTableRows(pageResult.rows);
      setTableTotal(pageResult.totalCount);
      setCriticalDelays(delays);
      setTableLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [currentProject, view, activeFilters, currentPage]);

  // Compute heatmap from rollup data
  const heatmapData: HeatmapData = useMemo(() => {
    if (!dashData) return { stages: [], floors: [], stageCompletionFloors: {}, stageCompletionUnits: {}, floorsFullyReady: 0, floorsInProgress: 0 };
    return computeHeatmapFromRollup(dashData.heatmap, dashData.stages);
  }, [dashData]);

  // Health counts from stats — exclude not_applicable from total
  const healthCounts = useMemo(() => {
    const s = dashData?.stats || {};
    const notApplicable = s['not_applicable'] || 0;
    return {
      total: Object.values(s).reduce((a, b) => a + b, 0) - notApplicable,
      completed: (s['completed'] || 0),
      completedDelayed: (s['completed_delayed'] || 0),
      inProgress: (s['in_progress'] || 0),
      inProgressDelayed: (s['in_progress_delayed'] || 0),
      onHold: (s['on_hold'] || 0),
      notStarted: (s['not_started'] || 0),
    };
  }, [dashData]);

  // Filter options from dashboard data
  const floors = useMemo(() => {
    if (!dashData) return [];
    const set = new Set(dashData.heatmap.map(r => r.floor));
    return [...set].sort((a, b) => a - b).map(f => `Floor ${f}`);
  }, [dashData]);

  const stages = useMemo(() => dashData?.stages || [], [dashData]);
  const stageGates = useMemo(() => {
    if (!dashData) return [];
    const set = new Set(dashData.heatmap.map(r => r.stage_gate).filter(Boolean));
    return [...set].sort();
  }, [dashData]);
  const vendors = useMemo(() => dashData?.vendors || [], [dashData]);

  // Table pagination
  const totalPages = Math.max(1, Math.ceil(tableTotal / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  function toggleRow(id: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedRows.size === tableRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableRows.map(r => r.id as string)));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Project Selected</h3>
          <p className="text-sm text-gray-500">Select a project from the dropdown above, or create one in Manage Projects.</p>
        </div>
      </div>
    );
  }

  if (!currentProject.hasTemplate || !dashData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Template Uploaded</h3>
          <p className="text-sm text-gray-500">
            Upload an Excel template for <span className="font-medium">{currentProject.name}</span> in the Upload Template section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Health Score + Status Chips */}
      <HealthScore {...healthCounts} activeFilter={statusFilter} onFilterChange={(s) => { setStatusFilter(s); setCurrentPage(1); }} />

      {/* View Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('heatmap')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'heatmap' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
            Floor Heatmap
          </span>
        </button>
        <button
          onClick={() => setView('table')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
            </svg>
            Activity Table
          </span>
        </button>
      </div>

      {/* Heatmap View */}
      {view === 'heatmap' && (
        <FloorHeatmap data={heatmapData} projectName={currentProject.name} />
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 space-y-5">
            <FilterBar
              filters={filters}
              onFiltersChange={(f) => { setFilters(f); setCurrentPage(1); }}
              onApply={() => setCurrentPage(1)}
              onClear={clearFilters}
              projects={projects.filter(p => p.hasTemplate).map(p => p.name)}
              floors={floors}
              stages={stages}
              stageGates={stageGates}
              vendors={vendors}
            />

            {selectedRows.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
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

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {tableLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-3 w-10">
                            <input type="checkbox" checked={selectedRows.size === tableRows.length && tableRows.length > 0} onChange={toggleAll} className="accent-[#E67E22] w-4 h-4" />
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
                          <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Delay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tableRows.map(row => (
                          <tr key={row.id as string} className={`hover:bg-gray-50 transition-colors ${selectedRows.has(row.id as string) ? 'bg-orange-50/50' : ''}`}>
                            <td className="px-3 py-2.5">
                              <input type="checkbox" checked={selectedRows.has(row.id as string)} onChange={() => toggleRow(row.id as string)} className="accent-[#E67E22] w-4 h-4" />
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">{row.floor as number}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900">{row.flat_number as number}</td>
                            <td className="px-3 py-2.5 text-gray-600">{(row.configuration as string) || ''}</td>
                            <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{row.stage as string}</td>
                            <td className="px-3 py-2.5 text-gray-600 max-w-[90px] truncate">{(row.stage_gate as string) || ''}</td>
                            <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{row.activity as string}</td>
                            <td className="px-3 py-2.5 text-gray-600 max-w-[90px] truncate">{(row.vendor as string) || ''}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{(row.expected_start as string) || ''}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{(row.expected_end as string) || ''}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{(row.actual_start as string) || '-'}</td>
                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{(row.actual_end as string) || '-'}</td>
                            <td className="px-3 py-2.5"><StatusPill status={normalizeStatus((row.status as string) || 'not_started')} /></td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">
                              {(row.delay_days as number) > 0 ? `${row.delay_days}d` : (row.delay_reason as string) || '-'}
                            </td>
                          </tr>
                        ))}
                        {tableRows.length === 0 && !tableLoading && (
                          <tr>
                            <td colSpan={14} className="px-3 py-12 text-center text-sm text-gray-400">
                              No activities match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                    <span className="text-xs sm:text-sm text-gray-500">
                      Showing {tableTotal === 0 ? 0 : (safePage - 1) * PER_PAGE + 1}-{Math.min(safePage * PER_PAGE, tableTotal)} of {tableTotal.toLocaleString()}
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
                </>
              )}
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
              <p className="text-xs text-gray-500 mb-4">Top 5 overdue activities</p>

              {criticalDelays.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No delayed activities</p>
              ) : (
                <div className="space-y-3">
                  {criticalDelays.map((d) => (
                    <div key={d.id as string} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-bold text-gray-900">Flat {d.flat_number as number}</span>
                        <StatusPill status="delayed" />
                      </div>
                      <div className="text-xs text-gray-600 mb-0.5">{d.activity as string}</div>
                      <div className="text-[11px] text-gray-400">Floor {d.floor as number} &bull; {d.stage_gate as string}</div>
                      <div className="text-[11px] text-gray-400">Vendor: {d.vendor as string}</div>
                      <div className="text-xs font-semibold text-red-600 mt-1">Overdue by {d.delay_days as number} day{(d.delay_days as number) > 1 ? 's' : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
