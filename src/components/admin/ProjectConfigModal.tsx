'use client';

import { useState } from 'react';
import { Project } from '@/lib/types';
import { floorsConfig } from '@/lib/mock-data';
import ExcelUpload from '@/components/admin/ExcelUpload';

type ConfigTab = 'floors' | 'stages' | 'stage_gates' | 'activities' | 'rooms';

const tabs: { key: ConfigTab; label: string; disabled?: boolean; badge?: string }[] = [
  { key: 'floors', label: 'Floors & Flats' },
  { key: 'stages', label: 'Stages' },
  { key: 'stage_gates', label: 'Stage Gates' },
  { key: 'activities', label: 'Finishing Activities' },
  { key: 'rooms', label: 'Room / Location', disabled: true, badge: 'Coming in v2' },
];

interface ProjectConfigModalProps {
  project: Project;
  onClose: () => void;
}

export default function ProjectConfigModal({ project, onClose }: ProjectConfigModalProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('floors');

  const totalFlats = floorsConfig.reduce((sum, f) => sum + f.flats_count, 0);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
        <span className="text-primary font-medium">Project</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>Stage</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>Stage Gate</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>Activity</span>
      </nav>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && setActiveTab(tab.key)}
            disabled={tab.disabled}
            className={`
              relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
              ${activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : tab.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.badge && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'floors' && (
        <FloorsFlatsTab totalFlats={totalFlats} />
      )}
      {activeTab === 'stages' && (
        <PlaceholderTab title="Stages" description="Configure project stages and their sequence order." />
      )}
      {activeTab === 'stage_gates' && (
        <PlaceholderTab title="Stage Gates" description="Configure stage gates for quality checkpoints." />
      )}
      {activeTab === 'activities' && (
        <ExcelUpload />
      )}
      {activeTab === 'rooms' && (
        <RoomLocationTab onClose={onClose} />
      )}
    </div>
  );
}

/* ---- Floors & Flats Tab ---- */
function FloorsFlatsTab({ totalFlats }: { totalFlats: number }) {
  return (
    <div>
      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-4">
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          Start Fill Now
        </button>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Import from Excel
        </button>
      </div>

      {/* Floors Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Floor</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Start Flat No.</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">End Flat No.</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Flats Count</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Configuration</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {floorsConfig.map((floor, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{floor.floor}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{floor.start_flat}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{floor.end_flat}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{floor.flats_count}</td>
                  <td className="px-4 py-3 text-gray-600">{floor.configuration}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-primary"
                        aria-label={`Edit ${floor.floor}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                        aria-label={`Delete ${floor.floor}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">{totalFlats}</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Room / Location Tab (Disabled v2) ---- */
function RoomLocationTab({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center py-8">
      {/* Lock Icon */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-1">Room / Location Coming in v2</h3>
      <p className="text-sm text-gray-500 mb-8">Room-level tracking planned for a future release.</p>

      {/* Disabled Dropdowns */}
      <div className="max-w-md mx-auto space-y-4 mb-8">
        {['Building', 'Floor', 'Room Type', 'Area / Location'].map((label) => (
          <div key={label} className="text-left">
            <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
            <select
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm cursor-not-allowed appearance-none"
            >
              <option>Select {label}</option>
            </select>
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors text-sm"
      >
        Close
      </button>
    </div>
  );
}

/* ---- Placeholder Tab ---- */
function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
