'use client';

import { useState, useRef, useEffect } from 'react';
import { parseExcelFile, saveProjectData, getProjectData, clearProjectData, ProjectData } from '@/lib/project-data-store';

export default function UploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    const existing = getProjectData();
    if (existing) setProjectData(existing);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const data = parseExcelFile(buffer);
        data.fileName = file.name;
        saveProjectData(data);
        setProjectData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleClear() {
    if (!confirm('This will remove all uploaded data. Are you sure?')) return;
    clearProjectData();
    setProjectData(null);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const statusBreakdown = projectData ? (() => {
    const counts: Record<string, number> = {};
    for (const a of projectData.activities) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return counts;
  })() : {};

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    not_started: { label: 'Yet to Start', color: 'bg-gray-100 text-gray-700' },
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    in_progress_delayed: { label: 'In Progress (Delayed)', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
    completed_delayed: { label: 'Completed (Delayed)', color: 'bg-emerald-100 text-emerald-700' },
    on_hold: { label: 'On Hold', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Template</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload the Unitwise Finishing Excel template to import project activities
          </p>
        </div>
        {projectData && (
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Clear &amp; Re-upload
          </button>
        )}
      </div>

      {/* Upload area */}
      {!projectData && (
        <label className="block cursor-pointer mb-6">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="hidden"
          />
          <div className={`flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl transition-colors ${
            uploading ? 'border-primary bg-orange-50' : 'border-gray-300 hover:border-primary hover:bg-orange-50/30'
          }`}>
            {uploading ? (
              <>
                <svg className="w-12 h-12 text-primary animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-base font-semibold text-gray-700">Parsing {fileName}...</span>
                <span className="text-sm text-gray-400 mt-1">Reading &quot;Sale Unit wise status&quot; sheet</span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <span className="text-base font-semibold text-gray-700">Upload Unitwise Finishing Template</span>
                <span className="text-sm text-gray-400 mt-1">Click to select .xlsx file</span>
                <span className="text-xs text-gray-400 mt-3">
                  Required sheet: &quot;Sale Unit wise status&quot;
                </span>
              </>
            )}
          </div>
        </label>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.007v.008H12v-.008Z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Data summary */}
      {projectData && (
        <div className="space-y-6">
          {/* Upload info */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div>
              <span className="text-sm font-semibold text-green-800">Template loaded successfully</span>
              <span className="text-xs text-green-600 block">
                {projectData.fileName} &bull; Uploaded {new Date(projectData.uploadedAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Activities" value={projectData.totalRows.toLocaleString()} icon="📋" />
            <MetricCard label="Floors" value={`${projectData.floors[0]} - ${projectData.floors[projectData.floors.length - 1]}`} icon="🏢" />
            <MetricCard label="Stages" value={String(projectData.stages.length)} icon="📊" />
            <MetricCard label="Vendors" value={String(projectData.vendors.length)} icon="👷" />
          </div>

          {/* Status breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(statusBreakdown).map(([status, count]) => {
                const cfg = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
                const pct = ((count / projectData.totalRows) * 100).toFixed(1);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color} min-w-[160px]`}>
                      {cfg.label}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 min-w-[80px] text-right">
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stages & Activities */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Stages &amp; Sub-Stages</h3>
            <div className="space-y-3">
              {projectData.stages.map(stage => {
                const gates = projectData.stageGates[stage] || [];
                const stageCount = projectData.activities.filter(a => a.stage === stage).length;
                return (
                  <div key={stage} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">{stage}</span>
                      <span className="text-xs text-gray-500">{stageCount.toLocaleString()} activities</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {gates.map(g => (
                        <span key={g} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floor breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Floor Breakdown</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {projectData.floors.map(floor => {
                const count = projectData.activities.filter(a => a.floor === floor).length;
                return (
                  <div key={floor} className="text-center border border-gray-100 rounded-lg p-2.5">
                    <div className="text-xs text-gray-500">Floor {floor}</div>
                    <div className="text-sm font-bold text-gray-900">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sample data */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Sample Data (first 10 rows)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Floor</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Flat</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Config</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Stage</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Stage Gate</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Activity</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Vendor</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Exp Start</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Exp End</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projectData.activities.slice(0, 10).map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700">{a.floor}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{a.flat_number}</td>
                      <td className="px-3 py-2 text-gray-600">{a.configuration}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.stage}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.stage_gate}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.activity}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.vendor}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{a.expected_start}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{a.expected_end}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          (STATUS_LABELS[a.status] || {}).color || 'bg-gray-100 text-gray-700'
                        }`}>
                          {(STATUS_LABELS[a.status] || {}).label || a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
