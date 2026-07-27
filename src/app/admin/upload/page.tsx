'use client';

import { useState, useRef, useEffect } from 'react';
import { parseExcelFile, ProjectData, UploadedActivity } from '@/lib/project-data-store';

function parseInWorker(buffer: ArrayBuffer, projectId: string): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
      self.onmessage = function(e) {
        try {
          var XLSX = self.XLSX;
          var buffer = e.data.buffer;
          var projectId = e.data.projectId;
          var wb = XLSX.read(buffer, { type: 'array' });
          var ws = wb.Sheets['Sale Unit wise status'];
          if (!ws) {
            self.postMessage({ error: 'Sheet "Sale Unit wise status" not found. Available: ' + wb.SheetNames.join(', ') });
            return;
          }
          var rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1, range: 0 });
          self.postMessage({ rows: rawRows });
        } catch (err) {
          self.postMessage({ error: err.message || 'Parse failed' });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) {
        reject(new Error(e.data.error));
        return;
      }
      try {
        const data = parseExcelRows(e.data.rows, projectId);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Worker failed'));
    };
    worker.postMessage({ buffer, projectId }, [buffer]);
  });
}

function parseExcelRows(rawRows: (string | number)[][], projectId: string): ProjectData {
  const dataRows = rawRows.slice(7);
  const activities: UploadedActivity[] = [];
  const stagesSet = new Set<string>();
  const vendorsSet = new Set<string>();
  const floorsSet = new Set<number>();
  const configsSet = new Set<string>();
  const statusesSet = new Set<string>();
  const stageGatesMap: Record<string, Set<string>> = {};
  const activityNamesMap: Record<string, Set<string>> = {};

  function excelDateToString(serial: number | string): string {
    if (!serial || serial === '') return '';
    const num = typeof serial === 'string' ? parseFloat(serial) : serial;
    if (isNaN(num) || num < 1000) return String(serial);
    const date = new Date((num - 25569) * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function mapStatus(raw: string): string {
    const s = (raw || '').trim().toLowerCase();
    if (s === 'yet to start' || s === '') return 'not_started';
    if (s === 'in progress') return 'in_progress';
    if (s === 'in progress with delay') return 'in_progress_delayed';
    if (s === 'completed') return 'completed';
    if (s === 'completed with delay') return 'completed_delayed';
    if (s === 'not applicable') return 'not_applicable';
    if (s === 'on hold') return 'on_hold';
    return 'not_started';
  }

  let rowId = 0;
  for (const row of dataRows) {
    const stage = String(row[5] || '').trim();
    const stageGate = String(row[6] || '').trim();
    const activity = String(row[7] || '').trim();
    const vendor = String(row[8] || '').trim();
    const config = String(row[4] || '').trim();
    const floorRaw = row[2];
    const flatRaw = row[3];
    const statusRaw = String(row[14] || '').trim();
    if (!stage || stage === 'X' || !activity || activity === 'X') continue;
    if (config === 'X') continue;
    const floor = typeof floorRaw === 'number' ? floorRaw : parseInt(String(floorRaw), 10);
    const flat = typeof flatRaw === 'number' ? flatRaw : parseInt(String(flatRaw), 10);
    if (isNaN(floor) || isNaN(flat)) continue;
    const mappedStatus = mapStatus(statusRaw);
    if (mappedStatus === 'not_applicable') continue;
    stagesSet.add(stage);
    vendorsSet.add(vendor);
    floorsSet.add(floor);
    configsSet.add(config);
    if (statusRaw) statusesSet.add(statusRaw);
    if (!stageGatesMap[stage]) stageGatesMap[stage] = new Set();
    stageGatesMap[stage].add(stageGate);
    const sgKey = stage + '||' + stageGate;
    if (!activityNamesMap[sgKey]) activityNamesMap[sgKey] = new Set();
    activityNamesMap[sgKey].add(activity);

    activities.push({
      id: 'act_' + rowId++,
      series: String(row[1] || ''),
      floor,
      flat_number: flat,
      configuration: config,
      stage,
      stage_gate: stageGate,
      activity,
      vendor,
      applicable: String(row[9] || '').trim().toLowerCase() !== 'no',
      expected_start: excelDateToString(row[10] as number),
      expected_end: excelDateToString(row[11] as number),
      actual_start: excelDateToString(row[12] as number),
      actual_end: excelDateToString(row[13] as number),
      status: mappedStatus,
      delay_days: typeof row[37] === 'number' ? row[37] : parseInt(String(row[37] || '0'), 10) || 0,
      delay_reason: String(row[16] || ''),
      remarks: String(row[25] || ''),
      rooms: {},
      sort_order: typeof row[26] === 'number' ? row[26] : 0,
      sub_stage_status: String(row[27] || ''),
      flat_status: String(row[36] || ''),
      floor_status: String(row[34] || ''),
      risk_status: String(row[38] || ''),
      revised_start: excelDateToString(row[28] as number),
      revised_end: excelDateToString(row[29] as number),
    });
  }

  return {
    projectId,
    name: 'Uploaded Project',
    uploadedAt: new Date().toISOString(),
    fileName: '',
    totalRows: activities.length,
    activities,
    stages: [...stagesSet],
    stageGates: Object.fromEntries(Object.entries(stageGatesMap).map(([k, v]) => [k, [...v]])),
    activityNames: Object.fromEntries(Object.entries(activityNamesMap).map(([k, v]) => [k, [...v]])),
    vendors: [...vendorsSet].filter(Boolean).sort(),
    floors: [...floorsSet].sort((a, b) => a - b),
    configurations: [...configsSet].filter(Boolean),
    statuses: [...statusesSet],
  };
}
import { useProject } from '@/lib/project-context';
import { saveProjectToSupabase, saveActivitiesToSupabase, getProjectDataFromSupabase, updateActivityInSupabase, recordUpload } from '@/lib/supabase-data';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type UploadStep = 'pick' | 'preview' | 'saved';

export default function UploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { currentProject, refreshProjects } = useProject();
  const { user } = useAuth();
  const [step, setStep] = useState<UploadStep>('pick');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [previewData, setPreviewData] = useState<ProjectData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<UploadedActivity>>({});
  const [searchRows, setSearchRows] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setProjectData(null);
    setPreviewData(null);
    setStep('pick');
    setError('');
    setFileName('');
    setPage(0);

    if (!currentProject) return;
    getProjectDataFromSupabase(currentProject.id).then(existing => {
      if (existing) {
        setProjectData(existing);
        setStep('saved');
      } else {
        setStep('pick');
        setProjectData(null);
      }
    }).catch(() => {
      setStep('pick');
      setProjectData(null);
    });
  }, [currentProject?.id]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setUploading(true);
    setError('');
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      let data: ProjectData;
      try {
        data = await parseInWorker(buffer, currentProject.id);
      } catch {
        data = parseExcelFile(buffer, currentProject.id);
      }
      data.fileName = file.name;
      data.name = currentProject.name;
      setPreviewData(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Excel file');
    } finally {
      setUploading(false);
    }
  }

  async function confirmSave() {
    if (!previewData || !currentProject) return;
    setUploading(true);
    setError('');
    try {
      await supabase.auth.refreshSession();
      await saveActivitiesToSupabase(currentProject.id, previewData.activities);
      await saveProjectToSupabase({ ...currentProject, hasTemplate: true });
      if (user) {
        await recordUpload(currentProject.id, previewData.fileName, previewData.totalRows, user.id);
      }
      await refreshProjects();
      setProjectData(previewData);
      setPreviewData(null);
      setStep('saved');
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; code?: string };
      setError(e?.message || e?.details || 'Failed to save data');
    } finally {
      setUploading(false);
    }
  }

  function cancelPreview() {
    setPreviewData(null);
    setStep(projectData ? 'saved' : 'pick');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleClear() {
    if (!currentProject || !projectData) return;

    const modified = projectData.activities.filter(
      a => a.status !== 'not_started' || a.actual_start || a.actual_end
    );

    let msg = `This will remove the uploaded template for "${currentProject.name}". Are you sure?`;
    if (modified.length > 0) {
      msg = `WARNING: ${modified.length} activities have been updated by supervisors (status changes, actual dates). Deleting will lose those changes.\n\nAre you sure you want to delete?`;
    }
    if (!confirm(msg)) return;

    try {
      await saveActivitiesToSupabase(currentProject.id, []);
      await saveProjectToSupabase({ ...currentProject, hasTemplate: false });
      await refreshProjects();
      setProjectData(null);
      setStep('pick');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to clear template');
    }
  }

  function startReupload() {
    setStep('pick');
  }

  function startEdit(a: UploadedActivity) {
    setEditingRow(a.id);
    setEditValues({
      status: a.status,
      vendor: a.vendor,
      expected_start: a.expected_start,
      expected_end: a.expected_end,
      actual_start: a.actual_start,
      actual_end: a.actual_end,
      delay_reason: a.delay_reason,
    });
  }

  async function saveEdit() {
    if (!editingRow || !currentProject || !projectData) return;
    try {
      await updateActivityInSupabase(editingRow, editValues);
      const updated = await getProjectDataFromSupabase(currentProject.id);
      if (updated) setProjectData(updated);
      setEditingRow(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to save edit');
    }
  }

  const displayData = step === 'preview' ? previewData : projectData;

  const filteredActivities = displayData ? displayData.activities.filter(a => {
    if (filterStage && a.stage !== filterStage) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (searchRows) {
      const q = searchRows.toLowerCase();
      if (!String(a.flat_number).includes(q) && !a.activity.toLowerCase().includes(q) && !a.vendor.toLowerCase().includes(q)) return false;
    }
    return true;
  }) : [];

  const totalPages = Math.ceil(filteredActivities.length / PAGE_SIZE);
  const pagedActivities = filteredActivities.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusBreakdown = displayData ? (() => {
    const counts: Record<string, number> = {};
    for (const a of displayData.activities) {
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

  if (!currentProject) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Template</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center mt-6">
          <svg className="w-12 h-12 text-yellow-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No project selected</h3>
          <p className="text-sm text-gray-600">
            Create a project in <strong>Manage Projects</strong> first, then select it from the dropdown in the top bar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Template</h1>
          <p className="text-sm text-gray-500 mt-1">
            Project: <strong>{currentProject.name}</strong> &bull; {currentProject.location}
          </p>
        </div>
        {step === 'saved' && (
          <div className="flex gap-2">
            <button
              onClick={startReupload}
              className="px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-orange-50 transition-colors"
            >
              Re-upload
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Remove Template
            </button>
          </div>
        )}
      </div>

      {/* Step 1: File picker */}
      {step === 'pick' && (
        <label className="block cursor-pointer mb-6">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
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
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <span className="text-base font-semibold text-gray-700">Upload Unitwise Finishing Template</span>
                <span className="text-sm text-gray-400 mt-1">Click to select .xlsx file for <strong>{currentProject.name}</strong></span>
                <span className="text-xs text-gray-400 mt-3">Required sheet: &quot;Sale Unit wise status&quot;</span>
                {projectData && (
                  <button
                    onClick={(e) => { e.preventDefault(); setStep('saved'); }}
                    className="mt-4 text-sm text-primary font-medium hover:underline"
                  >
                    Cancel, keep existing template
                  </button>
                )}
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

      {/* Step 2: Preview before save */}
      {step === 'preview' && previewData && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <div className="flex-1">
              <span className="text-sm font-semibold text-blue-800">Preview Mode</span>
              <span className="text-xs text-blue-600 block">
                Review the data below. Click <strong>Confirm &amp; Save</strong> to store it, or <strong>Cancel</strong> to discard.
              </span>
            </div>
          </div>

          {/* Confirm/Cancel bar */}
          <div className="flex gap-3 sticky top-0 z-10 bg-gray-50 py-3 -mx-3 px-3 md:-mx-6 md:px-6 border-b border-gray-200">
            <button
              onClick={confirmSave}
              disabled={uploading}
              className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {uploading ? 'Saving...' : 'Confirm & Save'}
            </button>
            <button
              onClick={cancelPreview}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <span className="text-sm text-gray-500 self-center ml-2">
              {previewData.fileName} &bull; {previewData.totalRows.toLocaleString()} activities parsed
            </span>
          </div>
        </div>
      )}

      {/* Data summary (shown in preview and saved) */}
      {displayData && (step === 'preview' || step === 'saved') && (
        <div className="space-y-6 mt-6">
          {/* Upload info - only in saved mode */}
          {step === 'saved' && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <div>
                <span className="text-sm font-semibold text-green-800">Template loaded for {currentProject.name}</span>
                <span className="text-xs text-green-600 block">
                  {displayData.fileName} &bull; Uploaded {new Date(displayData.uploadedAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Activities" value={displayData.totalRows.toLocaleString()} icon="📋" />
            <MetricCard label="Floors" value={displayData.floors.length > 0 ? `${displayData.floors[0]} - ${displayData.floors[displayData.floors.length - 1]}` : '-'} icon="🏢" />
            <MetricCard label="Stages" value={String(displayData.stages.length)} icon="📊" />
            <MetricCard label="Vendors" value={String(displayData.vendors.length)} icon="👷" />
          </div>

          {/* Status breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(statusBreakdown).map(([status, count]) => {
                const cfg = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
                const pct = ((count / displayData.totalRows) * 100).toFixed(1);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color} min-w-[160px]`}>{cfg.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 min-w-[80px] text-right">{count.toLocaleString()} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stages & Sub-Stages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Stages &amp; Sub-Stages</h3>
            <div className="space-y-3">
              {displayData.stages.map(stage => {
                const gates = displayData.stageGates[stage] || [];
                const stageCount = displayData.activities.filter(a => a.stage === stage).length;
                return (
                  <div key={stage} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-800">{stage}</span>
                      <span className="text-xs text-gray-500">{stageCount.toLocaleString()} activities</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {gates.map(g => (
                        <span key={g} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600">{g}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Data Table with search, filter, pagination, inline edit */}
          {step === 'saved' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">Activity Data</h3>
                  <div className="flex flex-1 gap-2 flex-wrap">
                    <input
                      type="text"
                      value={searchRows}
                      onChange={e => { setSearchRows(e.target.value); setPage(0); }}
                      placeholder="Search flat, activity, vendor..."
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm flex-1 min-w-[160px] focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                    <select
                      value={filterStage}
                      onChange={e => { setFilterStage(e.target.value); setPage(0); }}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">All Stages</option>
                      {displayData.stages.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select
                      value={filterStatus}
                      onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">All Status</option>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {filteredActivities.length.toLocaleString()} activities{searchRows || filterStage || filterStatus ? ' (filtered)' : ''} &bull; Click the edit icon on any row to make corrections
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Floor</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Flat</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Stage</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Sub Stage</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Activity</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Vendor</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Exp Start</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Exp End</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Status</th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedActivities.map(a => {
                      const isEditing = editingRow === a.id;
                      const sc = STATUS_LABELS[isEditing ? (editValues.status || a.status) : a.status] || { label: a.status, color: 'bg-gray-100 text-gray-700' };

                      if (isEditing) {
                        return (
                          <tr key={a.id} className="bg-orange-50/50">
                            <td className="px-3 py-2 text-gray-700">{a.floor}</td>
                            <td className="px-3 py-2 font-medium text-gray-900">{a.flat_number}</td>
                            <td className="px-3 py-2 text-gray-600">{a.stage}</td>
                            <td className="px-3 py-2 text-gray-600">{a.stage_gate}</td>
                            <td className="px-3 py-2 text-gray-600">{a.activity}</td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={editValues.vendor ?? a.vendor}
                                onChange={e => setEditValues({ ...editValues, vendor: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={editValues.expected_start ?? a.expected_start}
                                onChange={e => setEditValues({ ...editValues, expected_start: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={editValues.expected_end ?? a.expected_end}
                                onChange={e => setEditValues({ ...editValues, expected_end: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={editValues.status ?? a.status}
                                onChange={e => setEditValues({ ...editValues, status: e.target.value })}
                                className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                              >
                                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={saveEdit} className="p-1 bg-green-100 hover:bg-green-200 rounded text-green-700" title="Save">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                </button>
                                <button onClick={() => setEditingRow(null)} className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title="Cancel">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{a.floor}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{a.flat_number}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.stage}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.stage_gate}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.activity}</td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.vendor}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{a.expected_start}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{a.expected_end}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${sc.color}`}>{sc.label}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => startEdit(a)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-primary" title="Edit row">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 border border-gray-200 rounded text-xs disabled:opacity-40 hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 border border-gray-200 rounded text-xs disabled:opacity-40 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sample data in preview mode */}
          {step === 'preview' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Sample Data (first 10 rows)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Floor</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Flat</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Stage</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Activity</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Vendor</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Exp Start</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Exp End</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData!.activities.slice(0, 10).map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{a.floor}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{a.flat_number}</td>
                        <td className="px-3 py-2 text-gray-600">{a.stage}</td>
                        <td className="px-3 py-2 text-gray-600">{a.activity}</td>
                        <td className="px-3 py-2 text-gray-600">{a.vendor}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{a.expected_start}</td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{a.expected_end}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${(STATUS_LABELS[a.status] || {}).color || 'bg-gray-100 text-gray-700'}`}>
                            {(STATUS_LABELS[a.status] || {}).label || a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
