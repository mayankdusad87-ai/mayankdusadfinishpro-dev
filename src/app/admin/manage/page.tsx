'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRoleDevice } from '@/hooks';
import { canAccess, type Feature } from '@/lib/permissions';

type Tab = 'projects' | 'supervisors' | 'management' | 'finishing-team' | 'access-control' | 'activity-log' | 'error-log';

const tabFeatureMap: Record<Tab, Feature> = {
  projects: 'manage-projects',
  supervisors: 'manage-supervisors',
  management: 'manage-management',
  'finishing-team': 'manage-finishing-team',
  'access-control': 'manage-management', // admin-only
  'activity-log': 'activity-log',
  'error-log': 'error-log',
};

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabDef[] = [
  {
    id: 'projects',
    label: 'Manage Projects',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M2 20h20" />
        <path d="M5 20V8l7-5 7 5v12" />
        <path d="M9 20v-4h6v4" />
        <rect x="9" y="10" width="6" height="3" />
      </svg>
    ),
  },
  {
    id: 'supervisors',
    label: 'Manage Supervisors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
        <path d="M19 8v6" />
        <path d="M16 11h6" />
      </svg>
    ),
  },
  {
    id: 'management',
    label: 'Management Users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'finishing-team',
    label: 'Finishing Team',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'access-control',
    label: 'Access Control',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
  {
    id: 'activity-log',
    label: 'Activity Log',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    id: 'error-log',
    label: 'Error Log',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M3.44 18.67 10.14 4.33a2 2 0 0 1 3.72 0l6.7 14.34A2 2 0 0 1 18.7 22H5.3a2 2 0 0 1-1.86-3.33Z" />
      </svg>
    ),
  },
];

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const ProjectsPanel = dynamic(() => import('@/components/admin/ProjectList'), {
  loading: () => <TabSkeleton />,
});

const SupervisorsPanel = dynamic(
  () => import('@/app/admin/supervisors/page'),
  { loading: () => <TabSkeleton /> },
);

const ManagementPanel = dynamic(
  () => import('@/app/admin/management/page'),
  { loading: () => <TabSkeleton /> },
);

const FinishingTeamPanel = dynamic(
  () => import('@/app/admin/finishing-team/page'),
  { loading: () => <TabSkeleton /> },
);

const AuditLogPanel = dynamic(
  () => import('@/app/admin/audit-log/page'),
  { loading: () => <TabSkeleton /> },
);

const ErrorLogPanel = dynamic(
  () => import('@/app/admin/error-log/page'),
  { loading: () => <TabSkeleton /> },
);

const AccessControlPanelLazy = dynamic(
  () => import('@/components/admin/AccessControlPanel'),
  { loading: () => <TabSkeleton /> },
);

const panelMap: Record<Tab, React.ComponentType> = {
  projects: ProjectsPanel,
  supervisors: SupervisorsPanel,
  management: ManagementPanel,
  'finishing-team': FinishingTeamPanel,
  'access-control': AccessControlPanelLazy,
  'activity-log': AuditLogPanel,
  'error-log': ErrorLogPanel,
};

export default function ManagePage() {
  const { role, device } = useRoleDevice();
  const visibleTabs = useMemo(
    () => tabs.filter(tab => canAccess(role, device, tabFeatureMap[tab.id])),
    [role, device],
  );
  const [activeTab, setActiveTab] = useState<Tab>('projects');

  const safeTab = visibleTabs.some(t => t.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id ?? 'projects';
  const ActivePanel = panelMap[safeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your projects, team, and monitor system activity.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <ActivePanel />
    </div>
  );
}
