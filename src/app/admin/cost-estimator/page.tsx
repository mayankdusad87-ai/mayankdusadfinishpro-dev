'use client';

import { useState, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import { useDataLoader } from '@/hooks';
import type { ProjectCostData } from '@/repositories/cost-repo';
import OverviewTab from '@/components/cost-estimator/OverviewTab';
import BreakdownTab from '@/components/cost-estimator/BreakdownTab';
import PaymentsTab from '@/components/cost-estimator/PaymentsTab';

type Tab = 'overview' | 'breakdown' | 'payments';

const emptyData: ProjectCostData = { packages: [], categories: [], lineItems: [], payments: [] };

export default function CostEstimatorPage() {
  const { currentProject } = useProject();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const fetchData = useCallback(async (): Promise<ProjectCostData> => {
    if (!currentProject) return emptyData;
    const res = await fetch(`/api/cost-estimator?projectId=${currentProject.id}`);
    if (!res.ok) return emptyData;
    return res.json();
  }, [currentProject]);

  const { data, loading, refresh } = useDataLoader(fetchData, emptyData, [currentProject?.id]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'breakdown', label: 'Detailed Breakdown' },
    { key: 'payments', label: 'Record Payment' },
  ];

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-gray-400 text-lg font-medium">No Project Selected</div>
          <div className="text-gray-400 text-sm mt-1">Select a project from the top bar to view cost estimates.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cost Estimator</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track project budget, payments, and cost to completion for {currentProject.name}.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors relative cursor-pointer ${
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab data={data} onRefresh={refresh} />}
          {activeTab === 'breakdown' && <BreakdownTab data={data} projectId={currentProject.id} onRefresh={refresh} />}
          {activeTab === 'payments' && <PaymentsTab data={data} onRefresh={refresh} />}
        </>
      )}
    </div>
  );
}
