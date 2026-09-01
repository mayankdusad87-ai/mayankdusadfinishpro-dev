'use client';

import { useState, useRef, useEffect } from 'react';
import { parseExcelFile, ProjectData, UploadedActivity } from '@/lib/project-data-store';
import { useProject } from '@/lib/project-context';
import { getProjectDataFromSupabase, updateActivityInSupabase } from '@/lib/supabase-data';
import { useAuth } from '@/lib/auth-context';
import { uploadTemplate, clearTemplate, countModifiedActivities, getUploadMergeSummary } from '@/services/project-service';
import type { UploadMode, MergeSummary } from '@/services/project-service';
import BulkVendorAssign from '@/components/admin/BulkVendorAssign';
import { getVendorMappings } from '@/repositories/settings-repo';
import { bulkAssignVendorByFilter } from '@/lib/supabase-data';

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

  // Smart merge state
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>('smart_merge');
  const [showProtectedDetails, setShowProtectedDetails] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [autoApplyMsg, setAutoApplyMsg] = useState('');
  const isReupload = !!projectData; // true when existing data exists

  useEffect(() => {
    // Immediately clear ALL stale data so the old project never leaks through
    setProjectData(null);
    setPreviewData(null);
    setStep('pick');
    setError('');
    setFileName('');
    setPage(0);
    setMergeSummary(null);
    setUploadMode('smart_merge');
    setSummaryFailed(false);

    if (!currentProject) {
      setLoadingProject(false);
      return;
    }

    // Track which project we're loading — if user switches mid-fetch, ignore stale result
    const loadingId = currentProject.id;
    setLoadingProject(true);

    getProjectDataFromSupabase(currentProject.id).then(existing => {
      // Guard: ignore if user already switched to a different project
      if (loadingId !== currentProject.id) return;

      if (existing) {
        setProjectData(existing);
        setStep('saved');
      } else {
        setStep('pick');
        setProjectData(null);
      }
      setLoadingProject(false);
    }).catch(() => {
      if (loadingId !== currentProject.id) return;
      setStep('pick');
      setProjectData(null);
      setLoadingProject(false);
    });
  }, [currentProject?.id]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setUploading(true);
    setError('');
    setFileName(file.name);
    setMergeSummary(null);
    setUploadMode('smart_merge');
    setShowProtectedDetails(false);
    setSummaryFailed(false);

    try {
      const buffer = await file.arrayBuffer();
      const data = await parseExcelFile(buffer, currentProject.id);
      data.fileName = file.name;
      data.name = currentProject.name;
      setPreviewData(data);
      setStep('preview');

      // If re-uploading, compute merge summary
      if (projectData) {
        setLoadingSummary(true);
        try {
          const summary = await getUploadMergeSummary(currentProject.id, data.activities);
          setMergeSummary(summary);
          setSummaryFailed(false);
        } catch {
          // Summary failed — flag it so the UI shows a warning
          setMergeSummary(null);
          setSummaryFailed(true);
        } finally {
          setLoadingSummary(false);
        }
      }
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

    // Determine the mode:
    // - First upload (no existing data) → delete_all (simple insert)
    // - Re-upload with merge summary → user-chosen mode
    // - Re-upload without merge summary (failed) → delete_all with extra warning
    const mode: UploadMode = isReupload
      ? (summaryFailed ? 'delete_all' : uploadMode)
      : 'delete_all';

    // If merge summary failed during re-upload, warn the user before proceeding
    if (isReupload && summaryFailed) {
      const modifiedCount = projectData ? countModifiedActivities(projectData.activities) : 0;
      const msg = modifiedCount > 0
        ? `⚠️ IMPACT ANALYSIS UNAVAILABLE\n\nCould not compare with existing data. This will delete ALL ${projectData?.totalRows.toLocaleString()} existing activities (including ${modifiedCount} with supervisor updates) and replace with the new upload.\n\nAll supervisor work will be lost. Continue?`
        : `⚠️ IMPACT ANALYSIS UNAVAILABLE\n\nCould not compare with existing data. This will delete all existing activities and replace with the new upload.\n\nContinue?`;
      if (!confirm(msg)) {
        setUploading(false);
        return;
      }
    }

    // Extra confirmation for destructive modes during re-upload
    if (isReupload && !summaryFailed && mode === 'delete_all') {
      const modifiedCount = projectData ? countModifiedActivities(projectData.activities) : 0;
      const msg = modifiedCount > 0
        ? `⚠️ DELETE ALL & RE-UPLOAD\n\nThis will permanently delete ALL ${projectData?.totalRows.toLocaleString()} existing activities, including ${modifiedCount} that have been updated by supervisors (status changes, actual dates, photos).\n\nAll supervisor work will be lost. This cannot be undone.\n\nContinue?`
        : `This will delete all existing activities and replace with the new upload. Continue?`;
      if (!confirm(msg)) {
        setUploading(false);
        return;
      }
    }

    if (isReupload && !summaryFailed && mode === 'force_overwrite') {
      const protectedCount = mergeSummary?.protectedRows || 0;
      if (protectedCount > 0) {
        const msg = `⚠️ FORCE OVERWRITE\n\nThis will overwrite ${protectedCount} activities that have been updated by supervisors. Their status changes, actual dates, and remarks will be replaced with data from the Excel file.\n\nPhotos will NOT be deleted, but their associated activity data will be reset.\n\nContinue?`;
        if (!confirm(msg)) {
          setUploading(false);
          return;
        }
      }
    }

    try {
      await uploadTemplate(currentProject, previewData.activities, previewData.fileName, previewData.totalRows, user?.id || '', mode);
      await refreshProjects();

      // Auto-apply saved vendor mappings (if any exist for this project)
      try {
        const savedMappings = await getVendorMappings(currentProject.id);
        if (savedMappings.length > 0) {
          const assignments = savedMappings.map(m => ({
            stage: m.stage,
            activity: m.activity,
            vendor: m.vendor,
          }));
          const { errors } = await bulkAssignVendorByFilter(
            currentProject.id,
            assignments,
            { onlyEmpty: true }, // only fill where vendor is missing
          );
          if (errors.length === 0) {
            setAutoApplyMsg(`Auto-applied ${assignments.length} saved vendor mappings`);
          }
        }
      } catch {
        // best-effort — don't fail the upload if auto-apply fails
      }

      // Reload fresh data from DB (merge may have preserved/modified rows)
      const fresh = await getProjectDataFromSupabase(currentProject.id);
      setProjectData(fresh || previewData);
      setPreviewData(null);
      setMergeSummary(null);
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
    setMergeSummary(null);
    setUploadMode('smart_merge');
    setShowProtectedDetails(false);
    setStep(projectData ? 'saved' : 'pick');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleClear() {
    if (!currentProject || !projectData) return;

    const modifiedCount = countModifiedActivities(projectData.activities);

    let msg = `This will remove the uploaded template for "${currentProject.name}". Are you sure?`;
    if (modifiedCount > 0) {
      msg = `WARNING: ${modifiedCount} activities have been updated by supervisors (status changes, actual dates). Deleting will lose those changes.\n\nAre you sure you want to delete?`;
    }
    if (!confirm(msg)) return;

    try {
      await clearTemplate(currentProject);
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

  // Show loading state while fetching project data — prevents stale data flash
  if (loadingProject) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload Template</h1>
        <p className="text-sm text-gray-500 mt-1">
          Project: <strong>{currentProject.name}</strong> &bull; {currentProject.location}
        </p>
        <div className="flex items-center justify-center py-16 mt-6">
          <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="ml-3 text-sm text-gray-600">Loading template data...</span>
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
              onClick={() => setShowBulkAssign(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              Bulk Assign Vendor
            </button>
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
          {/* Re-upload merge summary panel */}
          {isReupload && (
            <div className="space-y-4">
              {loadingSummary ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-6 text-center">
                  <svg className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">Analyzing changes...</span>
                  <span className="text-xs text-blue-600 block mt-1">Comparing with existing data to protect supervisor work</span>
                </div>
              ) : mergeSummary ? (
                <>
                  {/* Merge impact summary */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-blue-50/50">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-900">Re-upload Impact Analysis</h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Comparing {previewData.totalRows.toLocaleString()} Excel rows against {mergeSummary.totalExistingRows.toLocaleString()} existing activities
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
                      <MergeStat
                        label="New Activities"
                        value={mergeSummary.newRows}
                        color="text-green-700"
                        bg="bg-green-50"
                        icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />}
                      />
                      <MergeStat
                        label="Will Update"
                        value={mergeSummary.updatedRows}
                        color="text-blue-700"
                        bg="bg-blue-50"
                        icon={<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />}
                      />
                      <MergeStat
                        label="Protected"
                        value={mergeSummary.protectedRows}
                        color="text-amber-700"
                        bg="bg-amber-50"
                        icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />}
                      />
                      <MergeStat
                        label="Orphaned"
                        value={mergeSummary.orphanedRows}
                        color="text-gray-600"
                        bg="bg-gray-50"
                        icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />}
                      />
                    </div>

                    {/* Protected rows explanation */}
                    {mergeSummary.protectedRows > 0 && (
                      <div className="px-5 py-3 bg-amber-50 border-t border-amber-200">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-800">
                              {mergeSummary.protectedRows} activities have supervisor updates
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              These rows have status changes, actual dates, remarks, or photos. Only template fields (vendor, expected dates) will be updated. Supervisor work is preserved.
                            </p>
                            {mergeSummary.protectedDetails.length > 0 && (
                              <button
                                onClick={() => setShowProtectedDetails(!showProtectedDetails)}
                                className="text-xs text-amber-800 font-medium mt-2 hover:underline flex items-center gap-1"
                              >
                                {showProtectedDetails ? 'Hide' : 'Show'} protected rows
                                <svg className={`w-3 h-3 transition-transform ${showProtectedDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {showProtectedDetails && (
                          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-white">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-amber-100/50">
                                  <th className="text-left px-3 py-1.5 font-medium text-amber-800">Floor</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-amber-800">Flat</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-amber-800">Activity</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-amber-800">Status</th>
                                  <th className="text-left px-3 py-1.5 font-medium text-amber-800">Why Protected</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100">
                                {mergeSummary.protectedDetails.map((d, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-1.5 text-gray-700">{d.floor}</td>
                                    <td className="px-3 py-1.5 text-gray-700">{d.flat_number}</td>
                                    <td className="px-3 py-1.5 text-gray-700">{d.activity}</td>
                                    <td className="px-3 py-1.5">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${(STATUS_LABELS[d.status] || {}).color || 'bg-gray-100 text-gray-700'}`}>
                                        {(STATUS_LABELS[d.status] || {}).label || d.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-gray-500">{d.reasons.join(', ')}</td>
                                  </tr>
                                ))}
                                {mergeSummary.protectedRows > mergeSummary.protectedDetails.length && (
                                  <tr>
                                    <td colSpan={5} className="px-3 py-1.5 text-center text-amber-600 font-medium">
                                      ... and {mergeSummary.protectedRows - mergeSummary.protectedDetails.length} more
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {mergeSummary.orphanedRows > 0 && (
                      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                          <strong>{mergeSummary.orphanedRows} orphaned rows</strong> exist in the database but not in the new Excel file. They will be kept to preserve any supervisor work.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upload mode selector */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Upload Mode</h4>
                    <div className="space-y-3">
                      {/* Smart Merge (default) */}
                      <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        uploadMode === 'smart_merge' ? 'border-primary bg-orange-50/30' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="uploadMode"
                          value="smart_merge"
                          checked={uploadMode === 'smart_merge'}
                          onChange={() => setUploadMode('smart_merge')}
                          className="mt-0.5 accent-[#C8922A]"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Smart Merge</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 ml-2">Recommended</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Add new activities, update untouched ones, <strong>protect supervisor work</strong> (status, dates, photos, remarks). Only template fields like vendor and expected dates are updated on protected rows.
                          </p>
                        </div>
                      </label>

                      {/* Force Overwrite */}
                      <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        uploadMode === 'force_overwrite' ? 'border-amber-400 bg-amber-50/30' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="uploadMode"
                          value="force_overwrite"
                          checked={uploadMode === 'force_overwrite'}
                          onChange={() => setUploadMode('force_overwrite')}
                          className="mt-0.5 accent-[#C8922A]"
                        />
                        <div>
                          <span className="text-sm font-medium text-amber-800">Force Overwrite</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Overwrite <strong>all</strong> matching activities with Excel data, including supervisor work. New rows are added. Photos are kept but their activity data resets.
                          </p>
                        </div>
                      </label>

                      {/* Delete All */}
                      <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        uploadMode === 'delete_all' ? 'border-red-400 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="radio"
                          name="uploadMode"
                          value="delete_all"
                          checked={uploadMode === 'delete_all'}
                          onChange={() => setUploadMode('delete_all')}
                          className="mt-0.5 accent-[#C8922A]"
                        />
                        <div>
                          <span className="text-sm font-medium text-red-700">Delete Everything &amp; Re-upload</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <strong>Permanently delete</strong> all existing activities and upload from scratch. All supervisor work, status updates, and remarks will be lost. Use only for a complete reset.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              ) : summaryFailed ? (
                /* Merge summary failed — warn the user */
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-red-800">Impact Analysis Failed</span>
                    <span className="text-xs text-red-700 block mt-0.5">
                      Could not compare with existing data. Smart Merge and Force Overwrite are unavailable. Saving will <strong>delete all existing activities</strong> and replace them with the new upload.
                    </span>
                    <span className="text-xs text-red-600 block mt-1">
                      ⚠️ Any supervisor work (status changes, actual dates, photos, remarks) will be lost.
                    </span>
                  </div>
                </div>
              ) : (
                /* Still loading or no summary yet */
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
              )}
            </div>
          )}

          {/* First upload — simple preview banner */}
          {!isReupload && (
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
          )}

          {/* Confirm/Cancel bar */}
          <div className="flex flex-wrap gap-3 sticky top-0 z-10 bg-gray-50 py-3 -mx-3 px-3 md:-mx-6 md:px-6 border-b border-gray-200">
            <button
              onClick={confirmSave}
              disabled={uploading || loadingSummary}
              className={`px-6 py-2.5 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 ${
                (summaryFailed || uploadMode === 'delete_all') && isReupload
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : uploadMode === 'force_overwrite' && isReupload
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-primary hover:bg-primary-dark text-white'
              }`}
            >
              {uploading ? 'Saving...' : (
                isReupload
                  ? summaryFailed
                    ? 'Delete All & Re-upload'
                    : uploadMode === 'delete_all'
                      ? 'Delete All & Re-upload'
                      : uploadMode === 'force_overwrite'
                        ? 'Force Overwrite & Save'
                        : 'Smart Merge & Save'
                  : 'Confirm & Save'
              )}
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

          {/* Auto-applied vendor mappings notification */}
          {autoApplyMsg && step === 'saved' && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              <div className="flex-1">
                <span className="text-sm font-semibold text-blue-800">{autoApplyMsg}</span>
                <span className="text-xs text-blue-600 block">Vendors were filled from your saved default mapping (empty cells only).</span>
              </div>
              <button onClick={() => setAutoApplyMsg('')} className="p-1 hover:bg-blue-100 rounded text-blue-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
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

          {/* Bulk Vendor Assign Modal */}
          {showBulkAssign && projectData && currentProject && (
            <BulkVendorAssign
              activities={projectData.activities}
              projectId={currentProject.id}
              existingVendors={projectData.vendors}
              floors={projectData.floors}
              onClose={() => setShowBulkAssign(false)}
              onComplete={async () => {
                // Refresh data after bulk assignment
                if (currentProject) {
                  const fresh = await getProjectDataFromSupabase(currentProject.id);
                  if (fresh) setProjectData(fresh);
                }
              }}
            />
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

function MergeStat({ label, value, color, bg, icon }: {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${bg} p-4 text-center`}>
      <div className="flex items-center justify-center mb-1">
        <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {icon}
        </svg>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
