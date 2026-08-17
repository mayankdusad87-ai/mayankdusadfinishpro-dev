'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import { getDashboardData } from '@/lib/supabase-data';
import { getInsightActivities } from '@/repositories/activity-repo';
import { computeHeatmapFromRollup } from '@/lib/floor-rollup';
import type { HeatmapData } from '@/lib/floor-rollup';
import { computeInsights } from '@/lib/insights-data';
import { getStageWeights, getPaintDaysPerFlat } from '@/repositories/settings-repo';
import { getSupervisorActivity, getRecentReversals, getSiteActivity } from '@/repositories/audit-repo';
import type { SupervisorPulse, RecentReversal, SiteActivityEntry } from '@/repositories/audit-repo';
import { getUnitStores } from '@/repositories/store-repo';
import type { UnitStore } from '@/repositories/store-repo';
import type { ManagementData, OperationsData } from '@/lib/insights-data';
import ManagementView from '@/components/admin/ManagementView';
import OperationsView from '@/components/admin/OperationsView';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';

type Tab = 'management' | 'operations';

export default function InsightsPage() {
  const { currentProject } = useProject();
  const [tab, setTab] = useState<Tab>('management');
  const [loading, setLoading] = useState(true);
  const [mgmt, setMgmt] = useState<ManagementData | null>(null);
  const [ops, setOps] = useState<OperationsData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorPulse[]>([]);
  const [reversals, setReversals] = useState<RecentReversal[]>([]);
  const [siteActivity, setSiteActivity] = useState<SiteActivityEntry[]>([]);
  const [unitStores, setUnitStores] = useState<UnitStore[]>([]);

  const loadData = useCallback(async () => {
    if (!currentProject) {
      setMgmt(null); setOps(null); setHeatmapData(null);
      setSupervisors([]); setReversals([]); setSiteActivity([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Run ALL queries in parallel — flattened waterfall
      const pid = currentProject.id;
      const [dashData, activityRows, dbWeights, dbPaintDays, supActivity, recentReversals, siteAct, stores] = await Promise.all([
        getDashboardData(pid),
        getInsightActivities(pid),
        getStageWeights(),
        getPaintDaysPerFlat(),
        getSupervisorActivity(pid),
        getRecentReversals(pid),
        getSiteActivity(pid),
        getUnitStores(pid),
      ]);

      setSupervisors(supActivity);
      setReversals(recentReversals);
      setSiteActivity(siteAct);
      setUnitStores(stores);

      if (!dashData) {
        console.warn('[Insights] getDashboardData returned null for', currentProject.name, pid);
        setMgmt(null); setOps(null); setHeatmapData(null); setLoading(false);
        return;
      }

      const heatmap = computeHeatmapFromRollup(dashData.heatmap, dashData.stages);
      setHeatmapData(heatmap);

      // Compute insights from pre-fetched rows (no additional DB call)
      const insights = computeInsights(
        activityRows,
        heatmap,
        dbWeights ?? undefined,
        dbPaintDays ?? undefined,
      );

      if (insights) {
        setMgmt(insights.management);
        // Inject reversal-based action items into operations data
        if (recentReversals.length > 0 && insights.operations) {
          insights.operations.actionItems.push({
            severity: recentReversals.length >= 5 ? 'critical' : 'warning',
            text: `${recentReversals.length} status reversal${recentReversals.length > 1 ? 's' : ''} in the last 7 days`,
            meta: `Latest: F${recentReversals[0].floor}-${recentReversals[0].flatNumber} ${recentReversals[0].oldStatus} → ${recentReversals[0].newStatus}`,
            type: 'reversal',
          });
        }
        setOps(insights.operations);
      } else {
        console.warn('[Insights]', currentProject.name, '— computeInsights returned null (0 activity rows)');
        setMgmt(null);
        setOps(null);
      }
    } catch (err) {
      console.error('[Insights] Failed to load data:', err);
      setMgmt(null); setOps(null); setHeatmapData(null);
      setSupervisors([]); setReversals([]); setSiteActivity([]); setUnitStores([]);
    }
    setLoading(false);
  }, [currentProject]);

  useEffect(() => {
    setMgmt(null);
    setOps(null);
    setHeatmapData(null);
    setSupervisors([]);
    setReversals([]);
    setSiteActivity([]);
    setUnitStores([]);
    loadData();
  }, [loadData]);

  useAutoRefresh(loadData, 90000, !!currentProject);

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
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Loading insights...</span>
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
          {tab === 'management' && mgmt && heatmapData && (
            <ManagementView data={mgmt} projectName={currentProject.name} heatmap={heatmapData} stores={unitStores} />
          )}
          {tab === 'operations' && ops && (
            <OperationsView data={ops} supervisors={supervisors} reversals={reversals} siteActivity={siteActivity} />
          )}
        </>
      )}
    </div>
  );
}
