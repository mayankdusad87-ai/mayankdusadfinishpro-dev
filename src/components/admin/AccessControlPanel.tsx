'use client';

import { useState, useEffect, useCallback } from 'react';
import { getManagementAccess, setManagementAccess, type ManagementAccess } from '@/repositories/settings-repo';
import { useManagementAccess } from '@/lib/management-access-context';

interface ScreenToggle {
  key: keyof ManagementAccess;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TOGGLEABLE_SCREENS: ScreenToggle[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Floor heatmap, activity table, health score, and store management',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'insights',
    label: 'Insights',
    description: 'Management & Operations views with KPIs, pipeline funnel, and site pulse',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 20h16" />
        <rect x="4" y="10" width="4" height="10" rx="1" />
        <rect x="10" y="6" width="4" height="14" rx="1" />
        <rect x="16" y="2" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    key: 'photos',
    label: 'Photo Review',
    description: 'Review and approve site photos uploaded by supervisors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <circle cx="12" cy="13.5" r="3" />
      </svg>
    ),
  },
];

const ALWAYS_HIDDEN_SCREENS = [
  { label: 'Settings', description: 'App configuration and stage weights' },
  { label: 'Admin Panel', description: 'Project/supervisor/user management' },
  { label: 'Upload Template', description: 'Excel template upload' },
];

export default function AccessControlPanel() {
  const [access, setAccess] = useState<ManagementAccess>({ dashboard: true, insights: true, photos: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const { refresh: refreshContext } = useManagementAccess();

  const loadAccess = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getManagementAccess();
      setAccess(data);
    } catch {
      setError('Failed to load access settings');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const handleToggle = (key: keyof ManagementAccess) => {
    setAccess(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await setManagementAccess(access);
      await refreshContext(); // Update the global context so sidebar/pages react immediately
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save access settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const enabledCount = Object.values(access).filter(Boolean).length;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Management Role Access</h3>
            <p className="text-xs text-gray-500">
              Control which screens management users can see. Changes apply to all management users.
            </p>
          </div>
        </div>
      </div>

      {/* Toggleable screens */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Configurable Screens</h4>
            <span className="text-xs text-gray-400">{enabledCount} of {TOGGLEABLE_SCREENS.length} enabled</span>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {TOGGLEABLE_SCREENS.map(screen => {
            const isOn = access[screen.key];
            return (
              <div key={screen.key} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isOn ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {screen.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{screen.label}</div>
                    <div className="text-xs text-gray-500">{screen.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(screen.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isOn ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                  role="switch"
                  aria-checked={isOn}
                  aria-label={`${screen.label} access`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isOn ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Always-hidden screens info */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-700">Always Hidden from Management</h4>
        </div>
        <div className="divide-y divide-gray-100">
          {ALWAYS_HIDDEN_SCREENS.map(screen => (
            <div key={screen.label} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm font-medium text-gray-500">{screen.label}</div>
                <div className="text-xs text-gray-400">{screen.description}</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Admin only
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : 'Save Changes'}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Saved — changes are live
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
      </div>
    </div>
  );
}
