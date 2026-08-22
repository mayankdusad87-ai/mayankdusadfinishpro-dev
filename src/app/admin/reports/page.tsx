'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useProject } from '@/lib/project-context';
import { getDashboardData } from '@/lib/supabase-data';
import { getInsightActivities } from '@/repositories/activity-repo';
import type { InsightRow } from '@/repositories/activity-repo';
import { computeHeatmapFromRollup } from '@/lib/floor-rollup';
import type { HeatmapData } from '@/lib/floor-rollup';
import { computeManagement, computeOperations } from '@/lib/insights-data';
import { getInsightsSettings } from '@/repositories/settings-repo';
import { getSupervisorActivity, getRecentReversals, getSiteActivity } from '@/repositories/audit-repo';
import type { SupervisorPulse, RecentReversal, SiteActivityEntry } from '@/repositories/audit-repo';
import { getUnitStores } from '@/repositories/store-repo';
import type { UnitStore } from '@/repositories/store-repo';
import type { ManagementData, OperationsData } from '@/lib/insights-data';
import ManagementView from '@/components/admin/ManagementView';
import OperationsView from '@/components/admin/OperationsView';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { useCanAccess } from '@/hooks';
import { useManagementAccess } from '@/lib/management-access-context';
import { useRouter } from 'next/navigation';

type Tab = 'management' | 'operations';

export default function InsightsPage() {
  const { loading: accessLoading } = useManagementAccess();
  const hasInsightsAccess = useCanAccess('insights-view');
  const router = useRouter();

  useEffect(() => {
    if (!accessLoading && !hasInsightsAccess) router.replace('/admin/manage');
  }, [accessLoading, hasInsightsAccess, router]);

  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>('management');
  const [loading, setLoading] = useState(true);
  const [mgmt, setMgmt] = useState<ManagementData | null>(null);
  const [ops, setOps] = useState<OperationsData | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorPulse[]>([]);
  const [reversals, setReversals] = useState<RecentReversal[]>([]);
  const [siteActivity, setSiteActivity] = useState<SiteActivityEntry[]>([]);
  const [unitStores, setUnitStores] = useState<UnitStore[]>([]);
  const [activityRows, setActivityRows] = useState<InsightRow[]>([]);
  const [stageList, setStageList] = useState<string[]>([]);
  // Track whether ops data has been loaded for current project
  const opsLoadedForProject = useRef<string | null>(null);

  // ---- Session cache helpers (stale-while-revalidate) ----
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  const cacheKey = useCallback((pid: string) => `insights_cache_${pid}`, []);

  const readCache = useCallback((pid: string) => {
    try {
      const raw = sessionStorage.getItem(cacheKey(pid));
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > CACHE_TTL) {
        sessionStorage.removeItem(cacheKey(pid));
        return null;
      }
      return cached as {
        ts: number;
        mgmt: ManagementData;
        activityRows: InsightRow[];
        stageList: string[];
        stores: UnitStore[];
      };
    } catch { return null; }
  }, [cacheKey]);

  const writeCache = useCallback((pid: string, data: {
    mgmt: ManagementData;
    activityRows: InsightRow[];
    stageList: string[];
    stores: UnitStore[];
  }) => {
    try {
      sessionStorage.setItem(cacheKey(pid), JSON.stringify({ ...data, ts: Date.now() }));
    } catch { /* storage full — ignore */ }
  }, [cacheKey]);

  // ---- Load core data (Management tab — the default) ----
  const loadData = useCallback(async () => {
    if (!currentProject) {
      setMgmt(null); setOps(null); setHeatmapData(null);
      setSupervisors([]); setReversals([]); setSiteActivity([]);
      setActivityRows([]); setStageList([]);
      setLoading(false);
      opsLoadedForProject.current = null;
      return;
    }

    const pid = currentProject.id;
    opsLoadedForProject.current = null;

    // Stale-while-revalidate: show cached data instantly, fetch fresh in background
    const cached = readCache(pid);
    if (cached) {
      setMgmt(cached.mgmt);
      setActivityRows(cached.activityRows);
      setStageList(cached.stageList);
      setUnitStores(cached.stores);
      setLoading(false);
      // Don't return — fall through to fetch fresh data in background
    } else {
      setLoading(true);
    }

    try {
      const [dashData, rows, settings, stores] = await Promise.all([
        getDashboardData(pid),
        getInsightActivities(pid),
        getInsightsSettings(),
        getUnitStores(pid),
      ]);

      setUnitStores(stores);
      setActivityRows(rows);

      if (!dashData) {
        console.warn('[Insights] getDashboardData returned null for', currentProject.name, pid);
        setMgmt(null); setOps(null); setHeatmapData(null); setLoading(false);
        return;
      }

      const heatmap = computeHeatmapFromRollup(dashData.heatmap, dashData.stages);
      setHeatmapData(heatmap);
      setStageList(dashData.stages || []);

      if (rows.length > 0) {
        const mgmtData = computeManagement(
          rows,
          heatmap,
          settings.stageWeights ?? undefined,
          settings.paintDaysPerFlat ?? undefined,
        );
        setMgmt(mgmtData);
        // Cache for instant load next time
        writeCache(pid, { mgmt: mgmtData, activityRows: rows, stageList: dashData.stages || [], stores });
      } else {
        console.warn('[Insights]', currentProject.name, '— 0 activity rows');
        setMgmt(null);
      }
    } catch (err) {
      console.error('[Insights] Failed to load data:', err);
      // Only clear state if we don't have cached data showing
      if (!cached) {
        setMgmt(null); setOps(null); setHeatmapData(null);
        setSupervisors([]); setReversals([]); setSiteActivity([]); setUnitStores([]);
        setActivityRows([]); setStageList([]);
      }
    }
    setLoading(false);
  }, [currentProject, readCache, writeCache]);

  // ---- Lazy-load Operations data only when user switches to that tab ----
  const loadOpsData = useCallback(async () => {
    if (!currentProject || opsLoadedForProject.current === currentProject.id) return;
    setOpsLoading(true);
    try {
      const pid = currentProject.id;
      const [supActivity, recentReversals, siteAct] = await Promise.all([
        getSupervisorActivity(pid),
        getRecentReversals(pid),
        getSiteActivity(pid),
      ]);

      setSupervisors(supActivity);
      setReversals(recentReversals);
      setSiteActivity(siteAct);

      // Compute operations insights from the already-loaded activity rows
      if (activityRows.length > 0) {
        const opsData = computeOperations(activityRows);
        // Inject reversal-based action items
        if (recentReversals.length > 0) {
          opsData.actionItems.push({
            severity: recentReversals.length >= 5 ? 'critical' : 'warning',
            text: `${recentReversals.length} status reversal${recentReversals.length > 1 ? 's' : ''} in the last 7 days`,
            meta: `Latest: F${recentReversals[0].floor}-${recentReversals[0].flatNumber} ${recentReversals[0].oldStatus} → ${recentReversals[0].newStatus}`,
            type: 'reversal',
          });
        }
        setOps(opsData);
      }
      opsLoadedForProject.current = pid;
    } catch (err) {
      console.error('[Insights] Failed to load ops data:', err);
    }
    setOpsLoading(false);
  }, [currentProject, activityRows]);

  useEffect(() => {
    // Reset ops-only state; mgmt state is handled by loadData (cache-aware)
    setOps(null);
    setHeatmapData(null);
    setSupervisors([]);
    setReversals([]);
    setSiteActivity([]);
    loadData();
  }, [loadData]);

  // Load ops data when user switches to operations tab
  useEffect(() => {
    if (tab === 'operations' && !loading) {
      loadOpsData();
    }
  }, [tab, loading, loadOpsData]);

  useAutoRefresh(loadData, 90000, !!currentProject);

  const uniqueFloors = useMemo(() => {
    const set = new Set(activityRows.map(a => a.floor));
    return [...set].sort((a, b) => a - b);
  }, [activityRows]);

  return (
    <div className="space-y-4 md:space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Insights</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5">
            {currentProject ? currentProject.name : 'Select a project'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 self-start md:self-auto">
          <button
            onClick={() => setTab('management')}
            className={`px-4 py-2 rounded-md text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              tab === 'management'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="hidden md:inline">Management</span>
            <span className="md:hidden">Promoter</span>
          </button>
          <button
            onClick={() => setTab('operations')}
            className={`px-4 py-2 rounded-md text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              tab === 'operations'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="hidden md:inline">Operations</span>
            <span className="md:hidden">Ops Head</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-5 animate-pulse">
          {/* KPI tiles skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
                <div className="h-2 w-full bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
            <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
            <div className="flex items-end gap-3 h-40">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-1 bg-gray-200 rounded-t" style={{ height: `${30 + Math.random() * 70}%` }} />
              ))}
            </div>
          </div>
          {/* Table skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
            <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-4 flex-1 bg-gray-200 rounded" />
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !currentProject ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-500">Select a project from the top bar to view insights.</p>
        </div>
      ) : !mgmt && !ops ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No activity data found. Upload a template first.</p>
        </div>
      ) : (
        <>
          {tab === 'management' && mgmt && (
            <ManagementView
              data={mgmt}
              projectName={currentProject.name}
              projectId={currentProject.id}
              stores={unitStores}
            />
          )}
          {tab === 'operations' && (opsLoading ? (
            <div className="space-y-5 animate-pulse">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                    <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
                    <div className="h-2 w-full bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
                <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                      <div className="h-4 flex-1 bg-gray-200 rounded" />
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : ops ? (
            <OperationsView data={ops} supervisors={supervisors} reversals={reversals} siteActivity={siteActivity} />
          ) : null)}
        </>
      )}
    </div>
  );
}
