'use client';

import { useState, useMemo, useEffect } from 'react';
import { UploadedActivity, ProjectData } from '@/lib/project-data-store';
import { ManagedProject } from '@/lib/project-store';
import { getProjectsFromSupabase, getProjectDataFromSupabase, updateActivityInSupabase, getActiveReasons, Reason, uploadActivityPhoto, getPhotosForActivity, ActivityPhoto, deleteActivityPhoto, updateActivityWithAudit, getAdminEmails } from '@/lib/supabase-data';
import { compressImage, generatePhotoPath } from '@/lib/image-compress';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

const TODAY = new Date().toISOString().slice(0, 10);

type SupervisorStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'on_hold';

const STATUS_CONFIG: Record<SupervisorStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'NOT STARTED', bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'COMPLETED', bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { label: 'DELAYED', bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { label: 'ON HOLD', bg: 'bg-orange-100', text: 'text-orange-700' },
};

const STATUS_OPTIONS: { value: SupervisorStatus | ''; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'on_hold', label: 'On Hold' },
];

function normalizeStatus(raw: string): SupervisorStatus {
  if (raw === 'in_progress_delayed') return 'delayed';
  if (raw === 'completed_delayed') return 'completed';
  if (raw === 'not_started' || raw === 'in_progress' || raw === 'completed' || raw === 'delayed' || raw === 'on_hold') return raw;
  return 'not_started';
}

function daysOverdue(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date(TODAY);
  return Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type PriorityView = 'floor' | 'overdue' | 'due_today' | 'starting_today';

export default function SupervisorHomePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [availableProjects, setAvailableProjects] = useState<ManagedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFloor, setActiveFloor] = useState<number>(0);
  const [activeView, setActiveView] = useState<PriorityView>('floor');
  const [statusFilter, setStatusFilter] = useState<SupervisorStatus | null>(null);
  const [stageFilter, setStageFilter] = useState('');
  const [subStageFilter, setSubStageFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [statusDropdown, setStatusDropdown] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<UploadedActivity | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPhotoPrompt, setShowPhotoPrompt] = useState<string | null>(null);
  const [detailStatus, setDetailStatus] = useState('');
  const [detailActualStart, setDetailActualStart] = useState('');
  const [detailActualEnd, setDetailActualEnd] = useState('');
  const [detailReason, setDetailReason] = useState('');
  const [detailRemarks, setDetailRemarks] = useState('');
  const [detailError, setDetailError] = useState('');
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [detailPhotos, setDetailPhotos] = useState<ActivityPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getProjectsFromSupabase().then(projects => {
      const withTemplate = projects.filter(p => p.hasTemplate);
      setAvailableProjects(withTemplate);
      const saved = typeof window !== 'undefined' ? localStorage.getItem('supervisor_selected_project') : null;
      if (saved && withTemplate.find(p => p.id === saved)) {
        setSelectedProjectId(saved);
      } else if (withTemplate.length > 0) {
        setSelectedProjectId(withTemplate[0].id);
      }
      setLoading(false);
    });
    getActiveReasons().then(setReasons).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setProjectData(null); return; }
    setLoading(true);
    getProjectDataFromSupabase(selectedProjectId).then(data => {
      setProjectData(data);
      if (data && data.floors.length > 0) {
        setActiveFloor(data.floors[0]);
      }
      setLoading(false);
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('supervisor_selected_project', selectedProjectId);
    }
  }, [selectedProjectId, refreshKey]);

  const allActivities = projectData?.activities || [];
  const floors = projectData?.floors || [];

  const priorities = useMemo(() => {
    const overdue: UploadedActivity[] = [];
    const dueToday: UploadedActivity[] = [];
    const startingToday: UploadedActivity[] = [];
    const completedToday: UploadedActivity[] = [];

    for (const row of allActivities) {
      const status = normalizeStatus(row.status);
      if (status === 'completed') {
        if (row.actual_end === TODAY) completedToday.push(row);
        continue;
      }
      if (row.expected_end === TODAY) {
        dueToday.push(row);
      }
      if (row.expected_start === TODAY && status === 'not_started') {
        startingToday.push(row);
      }
      if (row.expected_end && row.expected_end < TODAY) {
        overdue.push(row);
      }
    }

    overdue.sort((a, b) => daysOverdue(b.expected_end) - daysOverdue(a.expected_end));

    return { overdue, dueToday, startingToday, completedToday };
  }, [allActivities]);

  const subStageOptions = useMemo(() => {
    if (!stageFilter || !projectData) return [];
    return projectData.stageGates[stageFilter] || [];
  }, [stageFilter, projectData]);

  const activityOptions = useMemo(() => {
    if (!stageFilter || !subStageFilter || !projectData) return [];
    const key = `${stageFilter}||${subStageFilter}`;
    return projectData.activityNames[key] || [];
  }, [stageFilter, subStageFilter, projectData]);

  const floorRows = useMemo(() => {
    let rows = allActivities.filter(r => r.floor === activeFloor);
    if (statusFilter) rows = rows.filter(r => normalizeStatus(r.status) === statusFilter);
    if (statusDropdown) rows = rows.filter(r => normalizeStatus(r.status) === statusDropdown);
    if (stageFilter) rows = rows.filter(r => r.stage === stageFilter);
    if (subStageFilter) rows = rows.filter(r => r.stage_gate === subStageFilter);
    if (activityFilter) rows = rows.filter(r => r.activity === activityFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        String(r.flat_number).includes(q) ||
        r.activity.toLowerCase().includes(q) ||
        r.vendor.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allActivities, activeFloor, statusFilter, statusDropdown, stageFilter, subStageFilter, activityFilter, search]);

  const statusCounts = useMemo(() => {
    const rows = allActivities.filter(r => r.floor === activeFloor);
    return {
      total: rows.length,
      in_progress: rows.filter(r => normalizeStatus(r.status) === 'in_progress').length,
      delayed: rows.filter(r => normalizeStatus(r.status) === 'delayed').length,
      on_hold: rows.filter(r => normalizeStatus(r.status) === 'on_hold').length,
    };
  }, [allActivities, activeFloor]);

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setStageFilter('');
    setSubStageFilter('');
    setActivityFilter('');
    setStatusDropdown('');
    setStatusFilter(null);
    setSearch('');
  }

  async function handleQuickAction(row: UploadedActivity, action: 'start' | 'complete' | 'delay') {
    if (action === 'complete') {
      setShowPhotoPrompt(row.id);
      return;
    }
    const newStatus = action === 'start' ? 'in_progress' : 'delayed';
    const updates: Partial<UploadedActivity> = { status: newStatus };
    if (action === 'start') {
      updates.actual_start = TODAY;
    }
    await updateActivityInSupabase(row.id, updates);
    setRefreshKey(k => k + 1);
  }

  async function confirmComplete(withPhoto: boolean) {
    if (showPhotoPrompt) {
      await updateActivityInSupabase(showPhotoPrompt, { status: 'completed', actual_end: TODAY });
      setRefreshKey(k => k + 1);
      if (withPhoto) {
        const row = allActivities.find(r => r.id === showPhotoPrompt);
        if (row) openDetail({ ...row, status: 'completed', actual_end: TODAY });
      }
    }
    setShowPhotoPrompt(null);
  }

  function openDetail(row: UploadedActivity) {
    setSelectedDetail(row);
    setDetailStatus(normalizeStatus(row.status));
    setDetailActualStart(row.actual_start || '');
    setDetailActualEnd(row.actual_end || '');
    setDetailError('');
    setPhotoError('');
    setDetailPhotos([]);
    const existingReason = row.delay_reason || '';
    const isPresetReason = reasons.some(r => r.label === existingReason);
    if (existingReason && !isPresetReason) {
      setDetailReason('__other__');
      setDetailRemarks(existingReason);
    } else {
      setDetailReason(existingReason);
      setDetailRemarks(row.remarks || '');
    }
    getPhotosForActivity(row.id).then(setDetailPhotos);
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !selectedDetail || !user) return;
    const files = Array.from(e.target.files);
    if (detailPhotos.length + files.length > 3) {
      setPhotoError('Maximum 3 photos per activity.');
      e.target.value = '';
      return;
    }

    setPhotoUploading(true);
    setPhotoError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressImage(file);
        const path = generatePhotoPath(selectedProjectId, selectedDetail.id, detailPhotos.length + i);
        const result = await uploadActivityPhoto(compressed, path, {
          activityId: selectedDetail.id,
          projectId: selectedProjectId,
          fileName: file.name,
          floor: selectedDetail.floor,
          stage: selectedDetail.stage,
          stageGate: selectedDetail.stage_gate,
          activityName: selectedDetail.activity,
          flatNumber: selectedDetail.flat_number,
          uploadedBy: user.id,
        });
        if (result.error) {
          setPhotoError(result.error);
          break;
        }
      } catch {
        setPhotoError('Failed to upload photo. Please try again.');
        break;
      }
    }

    const updated = await getPhotosForActivity(selectedDetail.id);
    setDetailPhotos(updated);
    setPhotoUploading(false);
    e.target.value = '';
  }

  async function handleDeletePhoto(photo: ActivityPhoto) {
    if (!confirm('Delete this photo?')) return;
    const result = await deleteActivityPhoto(photo.id, photo.storage_path);
    if (result.error) {
      setPhotoError(result.error);
    } else if (selectedDetail) {
      const updated = await getPhotosForActivity(selectedDetail.id);
      setDetailPhotos(updated);
    }
  }

  async function saveDetail() {
    if (!selectedDetail) return;
    setDetailError('');

    if (detailActualStart && detailActualStart > TODAY) {
      setDetailError('Actual start date cannot be a future date.');
      return;
    }
    if (detailActualEnd && detailActualStart && detailActualEnd < detailActualStart) {
      setDetailError('Actual end date cannot be earlier than actual start date.');
      return;
    }
    if ((detailStatus === 'on_hold' || detailStatus === 'delayed') && !detailReason) {
      setDetailError(`Reason is mandatory when status is ${detailStatus === 'on_hold' ? 'On Hold' : 'Delayed'}.`);
      return;
    }
    if (detailReason === '__other__' && !detailRemarks.trim()) {
      setDetailError('Please provide remarks when selecting "Other" as reason.');
      return;
    }

    // Photo requirement for completion
    if (detailStatus === 'completed' && detailPhotos.length === 0) {
      setDetailError('At least one photo is required before marking as completed.');
      return;
    }

    const reasonValue = detailReason === '__other__' ? detailRemarks.trim() : detailReason;

    // Auto-populate actual_end on completion
    const actualEnd = detailStatus === 'completed' && !detailActualEnd ? TODAY : detailActualEnd;

    const oldStatus = selectedDetail.status;
    const statusChanged = oldStatus !== detailStatus;

    const result = await updateActivityWithAudit(
      selectedDetail.id,
      {
        status: detailStatus,
        actual_start: detailActualStart,
        actual_end: actualEnd,
        delay_reason: reasonValue,
        remarks: detailReason === '__other__' ? detailRemarks.trim() : '',
      },
      {
        projectId: selectedProjectId,
        changedBy: user?.id || '',
        oldStatus: statusChanged ? oldStatus : undefined,
        newStatus: statusChanged ? detailStatus : undefined,
        floor: selectedDetail.floor,
        flatNumber: selectedDetail.flat_number,
        stage: selectedDetail.stage,
        stageGate: selectedDetail.stage_gate,
        activityName: selectedDetail.activity,
      }
    );

    if (result.error) {
      setDetailError(result.error);
      return;
    }

    // Status reversal notification (completed → lower status)
    if (statusChanged) {
      const RANK: Record<string, number> = { not_started: 0, in_progress: 1, in_progress_delayed: 1, completed: 2, completed_delayed: 2, on_hold: -1 };
      const oldRank = RANK[oldStatus] ?? 0;
      const newRank = RANK[detailStatus] ?? 0;
      if (oldRank > newRank && oldRank !== -1 && newRank !== -1) {
        getAdminEmails().then(emails => {
          if (emails.length === 0) return;
          fetch('/api/admin/notify-reversal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              adminEmails: emails,
              projectName: availableProjects.find(p => p.id === selectedProjectId)?.name || '',
              floor: selectedDetail.floor,
              flatNumber: selectedDetail.flat_number,
              activity: selectedDetail.activity,
              stage: selectedDetail.stage,
              stageGate: selectedDetail.stage_gate,
              oldStatus,
              newStatus: detailStatus,
            }),
          }).catch(() => {});
        });
      }
    }

    setSelectedDetail(null);
    setRefreshKey(k => k + 1);
  }

  function getPriorityRows(): UploadedActivity[] {
    if (activeView === 'overdue') return priorities.overdue;
    if (activeView === 'due_today') return priorities.dueToday;
    if (activeView === 'starting_today') return priorities.startingToday;
    return [];
  }

  const hasFilters = stageFilter || subStageFilter || activityFilter || statusDropdown || statusFilter;
  const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-dark flex items-center justify-center">
        <div className="text-white text-sm">Loading...</div>
      </div>
    );
  }

  if (!projectData || availableProjects.length === 0) {
    return (
      <div className="min-h-screen bg-navy-dark flex flex-col items-center justify-center px-6 max-w-md mx-auto">
        <div className="w-20 h-20 rounded-2xl bg-navy-light flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <h2 className="text-white text-lg font-bold mb-2 text-center">No Project Data</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          Ask your admin to create a project and upload the template from the admin panel.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl"
        >
          Refresh
        </button>
      </div>
    );
  }

  const selectedProject = availableProjects.find(p => p.id === selectedProjectId);

  return (
    <div className="min-h-screen bg-navy-dark flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
              <ellipse cx="20" cy="14" rx="16" ry="10" fill="#E67E22" />
              <rect x="6" y="14" width="28" height="4" rx="1" fill="#D35400" />
              <rect x="17" y="4" width="6" height="4" rx="2" fill="#E67E22" />
            </svg>
            <span className="text-lg font-bold text-white">Finishing <span className="text-primary">Pro</span></span>
          </div>
          <div className="flex items-center gap-1">
            <button className="relative p-2">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              {priorities.overdue.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {priorities.overdue.length > 9 ? '9+' : priorities.overdue.length}
                </span>
              )}
            </button>
            <button
              onClick={async () => { await signOut(); router.replace('/supervisor/login'); }}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>

        {/* Greeting + Date */}
        <div className="mb-3">
          <div className="text-white text-base font-semibold">{getGreeting()}, Supervisor</div>
          <div className="text-gray-400 text-xs">{todayFormatted}</div>
        </div>

        {/* Project selector */}
        <div className="mb-3">
          {availableProjects.length > 1 ? (
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full bg-navy-light/50 text-white border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold appearance-none focus:ring-2 focus:ring-primary/50"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'m19.5 8.25-7.5 7.5-7.5-7.5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', paddingRight: '36px' }}
            >
              {availableProjects.map(p => (
                <option key={p.id} value={p.id} className="bg-navy text-white">{p.name} - {p.location}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-3 bg-navy-light/50 rounded-xl px-3 py-2.5">
              <div className="w-9 h-9 bg-navy rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">{selectedProject?.name || projectData.fileName}</div>
                <div className="text-gray-400 text-xs">{selectedProject?.location} &bull; {floors.length} Floors</div>
              </div>
            </div>
          )}
        </div>

        {/* Today&apos;s Priority Summary */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <button
            onClick={() => setActiveView(activeView === 'overdue' ? 'floor' : 'overdue')}
            className={`flex flex-col items-center py-2.5 rounded-xl transition-all ${
              activeView === 'overdue' ? 'bg-red-500/20 ring-1 ring-red-400' : 'bg-navy-light/60'
            }`}
          >
            <div className="text-xl font-bold text-red-400">{priorities.overdue.length}</div>
            <div className="text-[10px] text-gray-400 leading-tight">Overdue</div>
          </button>
          <button
            onClick={() => setActiveView(activeView === 'due_today' ? 'floor' : 'due_today')}
            className={`flex flex-col items-center py-2.5 rounded-xl transition-all ${
              activeView === 'due_today' ? 'bg-yellow-500/20 ring-1 ring-yellow-400' : 'bg-navy-light/60'
            }`}
          >
            <div className="text-xl font-bold text-yellow-400">{priorities.dueToday.length}</div>
            <div className="text-[10px] text-gray-400 leading-tight">Due Today</div>
          </button>
          <button
            onClick={() => setActiveView(activeView === 'starting_today' ? 'floor' : 'starting_today')}
            className={`flex flex-col items-center py-2.5 rounded-xl transition-all ${
              activeView === 'starting_today' ? 'bg-blue-500/20 ring-1 ring-blue-400' : 'bg-navy-light/60'
            }`}
          >
            <div className="text-xl font-bold text-blue-400">{priorities.startingToday.length}</div>
            <div className="text-[10px] text-gray-400 leading-tight text-center">Starting Today</div>
          </button>
          <div className="flex flex-col items-center py-2.5 rounded-xl bg-navy-light/60">
            <div className="text-xl font-bold text-green-400">{priorities.completedToday.length}</div>
            <div className="text-[10px] text-gray-400 leading-tight">Done Today</div>
          </div>
        </div>

        {/* Floor Tabs - only show when in floor view */}
        {activeView === 'floor' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {floors.map(f => (
              <button
                key={f}
                onClick={() => { setActiveFloor(f); clearFilters(); setSelectedIds(new Set()); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeFloor === f
                    ? 'bg-primary text-white'
                    : 'bg-navy-light text-gray-300 hover:bg-navy-light/80'
                }`}
              >
                Floor {f}
              </button>
            ))}
          </div>
        )}

        {/* Priority view header */}
        {activeView !== 'floor' && (
          <div className="flex items-center justify-between">
            <div className="text-white text-sm font-semibold">
              {activeView === 'overdue' && `Overdue Activities (${priorities.overdue.length})`}
              {activeView === 'due_today' && `Due Today (${priorities.dueToday.length})`}
              {activeView === 'starting_today' && `Starting Today (${priorities.startingToday.length})`}
            </div>
            <button
              onClick={() => setActiveView('floor')}
              className="text-xs text-primary font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Back to floors
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 bg-gray-50 rounded-t-3xl px-4 pt-4 pb-24">

        {/* Priority view content */}
        {activeView !== 'floor' && (
          <div className="space-y-3">
            {getPriorityRows().length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">
                  {activeView === 'overdue' ? '🎉' : '📋'}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeView === 'overdue' ? 'No overdue activities!' : 'Nothing here'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {activeView === 'overdue' ? 'All activities are on track.' : 'No activities match this category today.'}
                </p>
              </div>
            ) : (
              getPriorityRows().slice(0, 30).map(row => (
                <PriorityCard
                  key={row.id}
                  row={row}
                  onDetail={() => openDetail(row)}
                  onQuickAction={(action) => handleQuickAction(row, action)}
                />
              ))
            )}
          </div>
        )}

        {/* Floor view content */}
        {activeView === 'floor' && (
          <>
            {/* Floor summary strip */}
            <div className="flex gap-2 mb-4">
              {([
                { label: 'Total', count: statusCounts.total, filter: null as SupervisorStatus | null },
                { label: 'In Progress', count: statusCounts.in_progress, filter: 'in_progress' as SupervisorStatus },
                { label: 'Delayed', count: statusCounts.delayed, filter: 'delayed' as SupervisorStatus },
                { label: 'On Hold', count: statusCounts.on_hold, filter: 'on_hold' as SupervisorStatus },
              ]).map(stat => (
                <button
                  key={stat.label}
                  onClick={() => setStatusFilter(statusFilter === stat.filter ? null : stat.filter)}
                  className={`flex-1 flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                    statusFilter === stat.filter
                      ? 'border-primary bg-orange-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-xl font-bold text-gray-900">{stat.count}</div>
                  <div className="text-[11px] text-gray-500">{stat.label}</div>
                </button>
              ))}
            </div>

            {/* Filters - cascading from project data */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select
                value={stageFilter}
                onChange={(e) => { setStageFilter(e.target.value); setSubStageFilter(''); setActivityFilter(''); }}
                className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
              >
                <option value="">Stage</option>
                {(projectData?.stages || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={subStageFilter}
                onChange={(e) => { setSubStageFilter(e.target.value); setActivityFilter(''); }}
                disabled={!stageFilter}
                className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50 disabled:bg-gray-100"
              >
                <option value="">Sub Stage</option>
                {subStageOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value)}
                disabled={!subStageFilter}
                className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50 disabled:bg-gray-100"
              >
                <option value="">Activities</option>
                {activityOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <select
                value={statusDropdown}
                onChange={(e) => setStatusDropdown(e.target.value)}
                className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-primary font-medium mb-3 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                Clear all filters
              </button>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Flat No., Activity or Vendor"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Activity Cards */}
            <div className="space-y-3">
              {floorRows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🏗️</div>
                  <h3 className="text-lg font-semibold text-gray-900">No activities found</h3>
                  <p className="text-sm text-gray-500 mt-1">Try changing the filters or search keyword.</p>
                </div>
              ) : (
                floorRows.slice(0, 20).map(row => {
                  const status = normalizeStatus(row.status);
                  const sc = STATUS_CONFIG[status];
                  const overdueDays = status !== 'completed' && row.expected_end && row.expected_end < TODAY
                    ? daysOverdue(row.expected_end) : 0;

                  return (
                    <div
                      key={row.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1" onClick={() => !bulkMode && openDetail(row)}>
                        <div className="flex items-start gap-3">
                          {bulkMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleSelection(row.id)}
                              className="accent-[#E67E22] w-5 h-5 mt-0.5"
                            />
                          )}
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              Flat {row.flat_number} &bull; {row.configuration}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{row.stage}</div>
                            <div className="text-xs font-semibold text-primary mt-0.5">Sub Stage: {row.stage_gate}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                            {sc.label}
                          </span>
                          {overdueDays > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
                              {overdueDays}d overdue
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-gray-800 mt-1" onClick={() => !bulkMode && openDetail(row)}>{row.activity}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{row.vendor}</div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {row.expected_start} → {row.expected_end}
                        </span>
                      </div>

                      {/* Quick Actions */}
                      {!bulkMode && status !== 'completed' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          {status === 'not_started' && (
                            <button
                              onClick={() => handleQuickAction(row, 'start')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                              </svg>
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => handleQuickAction(row, 'complete')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            Complete
                          </button>
                          {status !== 'delayed' && (
                            <button
                              onClick={() => handleQuickAction(row, 'delay')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                              </svg>
                              Delay
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {floorRows.length > 20 && (
                <div className="text-center py-3 text-sm text-gray-500">
                  Showing 20 of {floorRows.length} activities. Use filters to narrow down.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bulk Update Toggle Bar */}
      {activeView === 'floor' && (
        <div className="fixed bottom-0 left-0 right-0 bg-navy-dark border-t border-white/10 px-4 py-3 max-w-md mx-auto">
          {bulkMode && selectedIds.size > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">{selectedIds.size} selected</span>
              <button
                onClick={async () => {
                  for (const id of selectedIds) {
                    await updateActivityInSupabase(id, { status: 'in_progress', actual_start: TODAY });
                  }
                  setBulkMode(false);
                  setSelectedIds(new Set());
                  setRefreshKey(k => k + 1);
                }}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg"
              >
                Start Selected
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-semibold">Bulk Update</div>
                <div className="text-gray-400 text-xs">Select multiple activities to update status.</div>
              </div>
              <button
                onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                className={`relative w-12 h-7 rounded-full transition-colors ${bulkMode ? 'bg-primary' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${bulkMode ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Photo prompt when completing */}
      {showPhotoPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPhotoPrompt(null)} />
          <div className="relative bg-white rounded-2xl mx-6 p-5 shadow-xl w-full max-w-xs">
            <h3 className="text-base font-bold text-gray-900 mb-1">Mark as Completed</h3>
            <p className="text-sm text-gray-500 mb-5">Would you like to add a photo as evidence?</p>
            <div className="space-y-2">
              <button
                onClick={() => confirmComplete(true)}
                className="w-full py-2.5 bg-primary text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
                Yes, add photo
              </button>
              <button
                onClick={() => confirmComplete(false)}
                className="w-full py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-50"
              >
                Skip, mark complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Detail Bottom Sheet */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedDetail(null)} />
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-24">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedDetail.activity}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Floor {selectedDetail.floor} &bull; Flat {selectedDetail.flat_number} &bull; {selectedDetail.stage}
                  </p>
                  <p className="text-xs text-primary font-medium mt-0.5">Sub Stage: {selectedDetail.stage_gate}</p>
                </div>
                <button onClick={() => setSelectedDetail(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Overdue alert in detail */}
              {normalizeStatus(selectedDetail.status) !== 'completed' && selectedDetail.expected_end && selectedDetail.expected_end < TODAY && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span className="text-sm font-semibold text-red-700">
                    {daysOverdue(selectedDetail.expected_end)} days overdue
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Expected Start</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{selectedDetail.expected_start || '-'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide">Expected End</div>
                  <div className="text-sm font-medium text-gray-900 mt-1">{selectedDetail.expected_end || '-'}</div>
                </div>
              </div>

              {detailError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <span className="text-xs font-medium text-red-700">{detailError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual Start</label>
                    <input
                      type="date"
                      value={detailActualStart}
                      max={TODAY}
                      onChange={(e) => { setDetailActualStart(e.target.value); setDetailError(''); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Actual End</label>
                    <input
                      type="date"
                      value={detailActualEnd}
                      min={detailActualStart || undefined}
                      onChange={(e) => { setDetailActualEnd(e.target.value); setDetailError(''); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={detailStatus}
                    onChange={(e) => { setDetailStatus(e.target.value); setDetailError(''); }}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vendor</label>
                  <input type="text" defaultValue={selectedDetail.vendor} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" readOnly />
                </div>

                {/* Reason dropdown - shown for delayed/on_hold, optional for others */}
                {(detailStatus === 'delayed' || detailStatus === 'on_hold') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={detailReason}
                      onChange={(e) => { setDetailReason(e.target.value); setDetailError(''); if (e.target.value !== '__other__') setDetailRemarks(''); }}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    >
                      <option value="">-- Select reason --</option>
                      {reasons.map(r => (
                        <option key={r.id} value={r.label}>{r.label}</option>
                      ))}
                      <option value="__other__">Other (specify in remarks)</option>
                    </select>
                  </div>
                )}

                {/* Remarks field - enabled when "Other" is selected */}
                {detailReason === '__other__' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Remarks <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={detailRemarks}
                      onChange={(e) => { setDetailRemarks(e.target.value); setDetailError(''); }}
                      placeholder="Describe the reason..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Photo Evidence <span className="text-gray-400 font-normal">({detailPhotos.length}/3)</span>
                  </label>

                  {photoError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 mb-2">
                      {photoError}
                    </div>
                  )}

                  {/* Photo thumbnails */}
                  {detailPhotos.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                      {detailPhotos.map(photo => (
                        <div key={photo.id} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={photo.url}
                            alt={photo.file_name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handleDeletePhoto(photo)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  {detailPhotos.length < 3 && (
                    <label className={`w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed rounded-lg text-sm transition-colors cursor-pointer ${
                      photoUploading ? 'border-gray-200 text-gray-400 pointer-events-none' : 'border-gray-300 text-gray-500 hover:border-primary hover:text-primary'
                    }`}>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handlePhotoCapture}
                        disabled={photoUploading}
                        className="hidden"
                      />
                      {photoUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Compressing & uploading...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                          </svg>
                          Tap to take photo or upload
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3">
              <button
                onClick={saveDetail}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Priority Card - used in overdue/due-today/starting-today views */
function PriorityCard({ row, onDetail, onQuickAction }: {
  row: UploadedActivity;
  onDetail: () => void;
  onQuickAction: (action: 'start' | 'complete' | 'delay') => void;
}) {
  const status = normalizeStatus(row.status);
  const sc = STATUS_CONFIG[status];
  const overdueDays = row.expected_end && row.expected_end < TODAY ? daysOverdue(row.expected_end) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-1" onClick={onDetail}>
        <div>
          <div className="text-sm font-bold text-gray-900">
            Floor {row.floor} &bull; Flat {row.flat_number}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{row.stage} &bull; {row.stage_gate}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
            {sc.label}
          </span>
          {overdueDays > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
              {overdueDays}d overdue
            </span>
          )}
        </div>
      </div>

      <div className="text-sm font-semibold text-gray-800 mt-1" onClick={onDetail}>{row.activity}</div>
      <div className="text-xs text-gray-500 mt-0.5">{row.vendor}</div>
      <div className="text-xs text-gray-400 mt-1">{row.expected_start} → {row.expected_end}</div>

      {status !== 'completed' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {status === 'not_started' && (
            <button
              onClick={() => onQuickAction('start')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              Start
            </button>
          )}
          <button
            onClick={() => onQuickAction('complete')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Complete
          </button>
          {status !== 'delayed' && (
            <button
              onClick={() => onQuickAction('delay')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              Delay
            </button>
          )}
        </div>
      )}
    </div>
  );
}
