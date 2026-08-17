'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import HealthScore from '@/components/admin/HealthScore';
import FilterBar, { Filters } from '@/components/admin/FilterBar';
import FloorHeatmap from '@/components/admin/FloorHeatmap';
import ActivityTable from '@/components/admin/ActivityTable';
import StoreToggleButton from '@/components/admin/StoreToggleButton';
import { useProject } from '@/lib/project-context';
import { getDashboardData, DashboardData, getRefugeConfig } from '@/lib/supabase-data';
import { computeHeatmapFromRollup, HeatmapData } from '@/lib/floor-rollup';
import { ActivityStatus } from '@/lib/types';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { useCanAccess } from '@/hooks';
import { useManagementAccess } from '@/lib/management-access-context';
import { useRouter } from 'next/navigation';

type DashboardView = 'heatmap' | 'table';

export default function DashboardPage() {
  const { loading: accessLoading } = useManagementAccess();
  const hasDashboardAccess = useCanAccess('dashboard');
  const router = useRouter();

  useEffect(() => {
    if (!accessLoading && !hasDashboardAccess) router.replace('/admin/manage');
  }, [accessLoading, hasDashboardAccess, router]);

  const { projects, currentProject } = useProject();
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DashboardView>('heatmap');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | null>(null);
  const [refugeFloors, setRefugeFloors] = useState<number[]>([]);
  const [refugeUnits, setRefugeUnits] = useState<number[]>([]);
  const [filters, setFilters] = useState<Filters>({
    project: '', floor: '', flat: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '',
  });
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  const refreshDashboard = useCallback(async () => {
    if (!currentProject) return;
    try {
      const [data, refuge] = await Promise.all([
        getDashboardData(currentProject.id),
        getRefugeConfig(currentProject.id),
      ]);
      setDashData(data);
      setRefugeFloors(refuge.floors);
      setRefugeUnits(refuge.units);
    } catch {
      setDashData(null);
    }
  }, [currentProject]);

  // Reset all state when project changes
  useEffect(() => {
    setDashData(null);
    setRefugeFloors([]);
    setRefugeUnits([]);
    setFilters({ project: '', floor: '', flat: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '' });
    setStatusFilter(null);

    if (!currentProject) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshDashboard().then(() => setLoading(false));
  }, [currentProject, refreshDashboard]);

  // Auto-refresh every 60 seconds
  const autoRefreshCb = useCallback(() => {
    refreshDashboard();
    setTableRefreshKey(k => k + 1);
  }, [refreshDashboard]);
  useAutoRefresh(autoRefreshCb, 60000, !!currentProject);

  // Build active filters for table query
  const activeFilters = useMemo(() => {
    const f: { floor?: string; flat?: string; stage?: string; stageGate?: string; vendor?: string; status?: string } = {};
    if (filters.floor) f.floor = filters.floor;
    if (filters.flat) f.flat = filters.flat;
    if (filters.stage) f.stage = filters.stage;
    if (filters.stageGate) f.stageGate = filters.stageGate;
    if (filters.vendor) f.vendor = filters.vendor;
    if (filters.status) f.status = filters.status;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [filters, statusFilter]);

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

  const flats = useMemo(() => {
    if (!dashData) return [];
    const set = new Set(dashData.heatmap.map(r => r.flat_number));
    return [...set].sort((a, b) => a - b).map(f => `Flat ${f}`);
  }, [dashData]);

  const stages = useMemo(() => dashData?.stages || [], [dashData]);
  const stageGates = useMemo(() => {
    if (!dashData) return [];
    const set = new Set(dashData.heatmap.map(r => r.stage_gate).filter(Boolean));
    return [...set].sort();
  }, [dashData]);
  const vendors = useMemo(() => dashData?.vendors || [], [dashData]);

  function clearFilters() {
    setFilters({ project: '', floor: '', flat: '', stage: '', stageGate: '', vendor: '', status: '', dateFrom: '', dateTo: '' });
    setStatusFilter(null);
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
      <HealthScore {...healthCounts} activeFilter={statusFilter} onFilterChange={(s) => { setStatusFilter(s); }} />

      {/* View Toggle + Store Button */}
      <div className="flex items-center gap-3 flex-wrap">
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
      <StoreToggleButton
        projectId={currentProject.id}
        floors={floors.map(f => parseInt(f.replace('Floor ', ''), 10))}
        flats={flats.map(f => parseInt(f.replace('Flat ', ''), 10))}
        onStoreChanged={() => { setTableRefreshKey(k => k + 1); }}
      />
      </div>

      {/* Heatmap View */}
      {view === 'heatmap' && (
        <FloorHeatmap data={heatmapData} projectName={currentProject.name} />
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="space-y-5">
          <FilterBar
            filters={filters}
            onFiltersChange={(f) => { setFilters(f); }}
            onClear={clearFilters}
            projects={projects.filter(p => p.hasTemplate).map(p => p.name)}
            floors={floors}
            flats={flats}
            stages={stages}
            stageGates={stageGates}
            vendors={vendors}
            hideProject={!!currentProject}
          />

          <ActivityTable
            projectId={currentProject.id}
            filters={activeFilters}
            statusFilter={statusFilter}
            projectName={currentProject.name}
            refugeFloors={refugeFloors}
            refugeUnits={refugeUnits}
            refreshKey={tableRefreshKey}
          />
        </div>
      )}
    </div>
  );
}
