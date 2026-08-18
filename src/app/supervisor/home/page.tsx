'use client';

import { useState, useMemo, useEffect } from 'react';
import { UploadedActivity, ProjectData } from '@/lib/project-data-store';
import { ManagedProject } from '@/lib/project-store';
import { getProjectsFromSupabase, getProjectDataFromSupabase, getActiveReasons, getSupervisorAssignments, updateActivityWithAudit } from '@/lib/supabase-data';
import type { Reason } from '@/lib/supabase-data';
import type { ActivityUpdate } from '@/types/database.types';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { TODAY, SupervisorStatus, PriorityView, normalizeStatus, daysOverdue, getGreeting, matchesSearch } from '@/components/supervisor/supervisor-utils';
import ActivityCard from '@/components/supervisor/ActivityCard';
import PriorityCard from '@/components/supervisor/PriorityCard';
import SupervisorFilters from '@/components/supervisor/SupervisorFilters';
import ActivityDetailSheet from '@/components/supervisor/ActivityDetailSheet';
import BulkUpdateBar from '@/components/supervisor/BulkUpdateBar';
import PhotoPromptModal from '@/components/supervisor/PhotoPromptModal';
import DelayReasonModal from '@/components/supervisor/DelayReasonModal';
import { useCanAccess } from '@/hooks';
import NotificationDropdown from '@/components/shared/NotificationDropdown';

export default function SupervisorHomePage() {
  const allowBulk = useCanAccess('bulk-status-update');
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [availableProjects, setAvailableProjects] = useState<ManagedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFloor, setActiveFloor] = useState<number>(0);
  const [activeView, setActiveView] = useState<PriorityView>('floor');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('');
  const [subStageFilter, setSubStageFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [statusDropdown, setStatusDropdown] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<UploadedActivity | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPhotoPrompt, setShowPhotoPrompt] = useState<string | null>(null);
  const [delayPromptRow, setDelayPromptRow] = useState<UploadedActivity | null>(null);
  const [delayPromptMode, setDelayPromptMode] = useState<'complete' | 'overdue_start' | 'overdue_capture'>('overdue_capture');
  const [pendingCompleteReason, setPendingCompleteReason] = useState<string | null>(null);
  const [pendingDetailRow, setPendingDetailRow] = useState<UploadedActivity | null>(null);
  const [detailError, setDetailError] = useState('');
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignedFloors, setAssignedFloors] = useState<number[] | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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
    if (!selectedProjectId) { setProjectData(null); setAssignedFloors(null); return; }
    // Only show full-screen loading on initial load, not background refreshes
    if (!projectData) setLoading(true);
    Promise.all([
      getProjectDataFromSupabase(selectedProjectId),
      user ? getSupervisorAssignments(user.id) : Promise.resolve([]),
    ]).then(([data, assignments]) => {
      const assignment = assignments.find(a => a.project_id === selectedProjectId);
      const myFloors = assignment?.assigned_floors?.length ? assignment.assigned_floors : null;
      setAssignedFloors(myFloors);
      setProjectData(data);
      if (data) {
        const allFloors = [...new Set(data.activities.map(a => a.floor))].sort((a, b) => a - b);
        const visibleFloors = myFloors ? allFloors.filter(f => myFloors.includes(f)) : allFloors;
        if (visibleFloors.length > 0 && !visibleFloors.includes(activeFloor)) {
          setActiveFloor(visibleFloors[0]);
        }
      }
      if (typeof window !== 'undefined') localStorage.setItem('supervisor_selected_project', selectedProjectId);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, user, refreshKey]);

  const allActivities = useMemo(() => {
    if (!projectData) return [];
    if (!assignedFloors) return projectData.activities;
    return projectData.activities.filter(a => assignedFloors.includes(a.floor));
  }, [projectData, assignedFloors]);

  const floors = useMemo(() => {
    const allFloors = [...new Set(allActivities.map(a => a.floor))].sort((a, b) => a - b);
    if (!assignedFloors) return allFloors;
    return allFloors.filter(f => assignedFloors.includes(f));
  }, [allActivities, assignedFloors]);

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
      if (row.expected_end === TODAY) dueToday.push(row);
      if (row.expected_start === TODAY && status === 'not_started') startingToday.push(row);
      if (row.expected_end && row.expected_end < TODAY) overdue.push(row);
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
    if (statusFilter === '__overdue__') {
      rows = rows.filter(r => normalizeStatus(r.status) !== 'completed' && r.expected_end != null && r.expected_end < TODAY);
    } else if (statusFilter) {
      rows = rows.filter(r => normalizeStatus(r.status) === statusFilter);
    }
    if (statusDropdown) rows = rows.filter(r => normalizeStatus(r.status) === statusDropdown);
    if (stageFilter) rows = rows.filter(r => r.stage === stageFilter);
    if (subStageFilter) rows = rows.filter(r => r.stage_gate === subStageFilter);
    if (activityFilter) rows = rows.filter(r => r.activity === activityFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => matchesSearch(r, q));
    }
    return rows;
  }, [allActivities, activeFloor, statusFilter, statusDropdown, stageFilter, subStageFilter, activityFilter, search]);

  const allFloorRows = useMemo(() => {
    if (activeView !== 'all') return [];
    if (!stageFilter && !search) return [];
    let rows = [...allActivities];
    if (stageFilter) rows = rows.filter(r => r.stage === stageFilter);
    if (subStageFilter) rows = rows.filter(r => r.stage_gate === subStageFilter);
    if (activityFilter) rows = rows.filter(r => r.activity === activityFilter);
    if (statusDropdown) rows = rows.filter(r => normalizeStatus(r.status) === statusDropdown);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => matchesSearch(r, q));
    }
    return rows;
  }, [activeView, allActivities, stageFilter, subStageFilter, activityFilter, statusDropdown, search]);

  const allFloorGrouped = useMemo(() => {
    const floorMap = new Map<number, UploadedActivity[]>();
    for (const row of allFloorRows) {
      if (!floorMap.has(row.floor)) floorMap.set(row.floor, []);
      floorMap.get(row.floor)!.push(row);
    }
    return [...floorMap.keys()].sort((a, b) => a - b).map(f => ({ floor: f, rows: floorMap.get(f)! }));
  }, [allFloorRows]);

  const statusCounts = useMemo(() => {
    const rows = allActivities.filter(r => r.floor === activeFloor);
    return {
      total: rows.length,
      not_started: rows.filter(r => normalizeStatus(r.status) === 'not_started').length,
      in_progress: rows.filter(r => normalizeStatus(r.status) === 'in_progress').length,
      completed: rows.filter(r => normalizeStatus(r.status) === 'completed').length,
      overdue: rows.filter(r => {
        const s = normalizeStatus(r.status);
        return s !== 'completed' && r.expected_end != null && r.expected_end < TODAY;
      }).length,
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

  /** Gate: if activity is overdue in-progress with no delay_reason, capture reason first */
  function openDetail(row: UploadedActivity) {
    const status = normalizeStatus(row.status);
    const isOverdueInProgress = (status === 'in_progress') && row.expected_end && row.expected_end < TODAY && !row.delay_reason;
    if (isOverdueInProgress) {
      setPendingDetailRow(row);
      setDelayPromptRow(row);
      setDelayPromptMode('overdue_capture');
      return;
    }
    setSelectedDetail(row);
  }

  async function handleQuickAction(row: UploadedActivity, action: 'start' | 'complete') {
    if (action === 'complete') {
      if (!row.actual_start) {
        setSelectedDetail(row);
        setTimeout(() => {
          setDetailError('Please enter the Actual Start date before marking as completed.');
        }, 100);
        return;
      }
      // If overdue, capture delay reason before completing
      const isOverdue = row.expected_end && row.expected_end < TODAY;
      if (isOverdue && !row.delay_reason) {
        setDelayPromptRow(row);
        setDelayPromptMode('complete');
        return;
      }
      setShowPhotoPrompt(row.id);
      return;
    }
    // action === 'start': check if activity is already overdue
    const isOverdueStart = row.expected_end && row.expected_end < TODAY;
    if (isOverdueStart) {
      setDelayPromptRow(row);
      setDelayPromptMode('overdue_start');
      return;
    }
    const updates: ActivityUpdate = { status: 'in_progress', actual_start: TODAY };
    await updateActivityWithAudit(row.id, updates, {
      projectId: selectedProjectId,
      changedBy: user?.id || '',
      oldStatus: row.status,
      newStatus: 'in_progress',
      floor: row.floor,
      flatNumber: row.flat_number,
      stage: row.stage,
      stageGate: row.stage_gate,
      activityName: row.activity,
    });
    setRefreshKey(k => k + 1);
  }

  async function confirmDelay(reason: string) {
    if (!delayPromptRow) return;
    const row = delayPromptRow;

    if (delayPromptMode === 'complete') {
      // Store reason and proceed to photo prompt
      setPendingCompleteReason(reason);
      setDelayPromptRow(null);
      setDelayPromptMode('overdue_capture');
      setShowPhotoPrompt(row.id);
      return;
    }

    if (delayPromptMode === 'overdue_start') {
      // Start the overdue activity with delay reason in one save
      const updates: ActivityUpdate = { status: 'in_progress', actual_start: TODAY, delay_reason: reason };
      await updateActivityWithAudit(row.id, updates, {
        projectId: selectedProjectId,
        changedBy: user?.id || '',
        oldStatus: row.status,
        newStatus: 'in_progress',
        floor: row.floor,
        flatNumber: row.flat_number,
        stage: row.stage,
        stageGate: row.stage_gate,
        activityName: row.activity,
      });
      setDelayPromptRow(null);
      setDelayPromptMode('overdue_capture');
      setRefreshKey(k => k + 1);
      return;
    }

    // overdue_capture: save delay_reason to DB immediately, then open detail sheet
    const updates: ActivityUpdate = { delay_reason: reason };
    await updateActivityWithAudit(row.id, updates, {
      projectId: selectedProjectId,
      changedBy: user?.id || '',
      oldStatus: row.status,
      newStatus: row.status,
      floor: row.floor,
      flatNumber: row.flat_number,
      stage: row.stage,
      stageGate: row.stage_gate,
      activityName: row.activity,
    });
    setDelayPromptRow(null);
    setDelayPromptMode('overdue_capture');
    // Open detail sheet with updated row
    if (pendingDetailRow) {
      setSelectedDetail({ ...pendingDetailRow, delay_reason: reason });
      setPendingDetailRow(null);
    }
    setRefreshKey(k => k + 1);
  }

  async function confirmComplete(_withPhoto: boolean) {
    if (showPhotoPrompt) {
      const row = allActivities.find(r => r.id === showPhotoPrompt);
      if (!row) { setShowPhotoPrompt(null); setPendingCompleteReason(null); return; }

      // Don't save completed status here — open the detail sheet instead.
      // The detail sheet enforces photo upload before allowing completion.
      // Pre-set status to completed so the detail sheet opens with it selected.
      setSelectedDetail({
        ...row,
        status: 'completed',
        actual_end: row.actual_end || TODAY,
        actual_start: row.actual_start || TODAY,
        delay_reason: pendingCompleteReason || row.delay_reason || '',
      });
    }
    setShowPhotoPrompt(null);
    setPendingCompleteReason(null);
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
              <ellipse cx="20" cy="14" rx="16" ry="10" fill="#C8922A" />
              <rect x="6" y="14" width="28" height="4" rx="1" fill="#A67921" />
              <rect x="17" y="4" width="6" height="4" rx="2" fill="#C8922A" />
            </svg>
            <span className="text-lg font-bold text-white">Finishing <span className="text-primary">Pro</span></span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationDropdown variant="dark" />
            {/* Profile avatar */}
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-sm font-bold"
            >
              {(profile?.full_name || 'S').charAt(0).toUpperCase()}
            </button>
          </div>
        </div>

        {/* Profile dropdown */}
        {showProfile && (
          <div className="mb-3 bg-navy-light/80 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-primary text-lg font-bold">
                {(profile?.full_name || 'S').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">{profile?.full_name || 'Supervisor'}</div>
                <div className="text-gray-400 text-xs truncate">{user?.email || ''}</div>
                {profile?.phone && <div className="text-gray-500 text-xs truncate">{profile.phone}</div>}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                {profile?.role || 'supervisor'}
              </span>
              <button
                onClick={async () => { await signOut(); router.replace('/supervisor/login'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}

        <div className="flex items-baseline justify-between mb-2">
          <div className="text-white text-sm font-semibold">{getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Supervisor'}</div>
          <div className="text-gray-500 text-xs">{todayFormatted}</div>
        </div>

        {/* Project selector */}
        <div className="mb-2">
          {availableProjects.length > 1 ? (
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full bg-navy-light/50 text-white border border-white/10 rounded-lg px-3 py-2 text-sm font-semibold appearance-none focus:ring-2 focus:ring-primary/50"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'m19.5 8.25-7.5 7.5-7.5-7.5\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', paddingRight: '36px' }}
            >
              {availableProjects.map(p => (
                <option key={p.id} value={p.id} className="bg-navy text-white">{p.name} - {p.location}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center justify-between bg-navy-light/50 rounded-lg px-3 py-2">
              <div className="text-white font-semibold text-sm">{selectedProject?.name || projectData.fileName}</div>
              <div className="text-gray-500 text-xs">{selectedProject?.location} &bull; {floors.length} Floors</div>
            </div>
          )}
        </div>

        {/* Priority Summary */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <button
            onClick={() => setActiveView(activeView === 'overdue' ? 'floor' : 'overdue')}
            className={`flex flex-col items-center py-2 rounded-lg transition-all ${
              activeView === 'overdue' ? 'bg-red-500/20 ring-1 ring-red-400' : 'bg-navy-light/60'
            }`}
          >
            <div className="text-lg font-bold text-red-400">{priorities.overdue.length}</div>
            <div className="text-[9px] text-gray-400 leading-tight">Overdue</div>
          </button>
          <button
            onClick={() => setActiveView(activeView === 'due_today' ? 'floor' : 'due_today')}
            className={`flex flex-col items-center py-2 rounded-lg transition-all ${
              activeView === 'due_today' ? 'bg-yellow-500/20 ring-1 ring-yellow-400' : 'bg-navy-light/60'
            }`}
          >
            <div className="text-lg font-bold text-yellow-400">{priorities.dueToday.length}</div>
            <div className="text-[9px] text-gray-400 leading-tight">Due today</div>
          </button>
          <button
            onClick={() => setActiveView(activeView === 'starting_today' ? 'floor' : 'starting_today')}
            className={`flex flex-col items-center py-2 rounded-lg transition-all ${
              activeView === 'starting_today' ? 'bg-blue-500/20 ring-1 ring-blue-400' : 'bg-navy-light/60'
            }`}
          >
            <div className="text-lg font-bold text-blue-400">{priorities.startingToday.length}</div>
            <div className="text-[9px] text-gray-400 leading-tight text-center">Starting</div>
          </button>
          <div className="flex flex-col items-center py-2 rounded-lg bg-navy-light/60">
            <div className="text-lg font-bold text-green-400">{priorities.completedToday.length}</div>
            <div className="text-[9px] text-gray-400 leading-tight">Done</div>
          </div>
        </div>

        {/* Overdue without delay reason banner — slim single-line */}
        {(() => {
          const needsReason = priorities.overdue.filter(r => normalizeStatus(r.status) === 'in_progress' && !r.delay_reason);
          if (needsReason.length === 0) return null;
          return (
            <button
              onClick={() => setActiveView('overdue')}
              className="w-full flex items-center justify-between bg-red-500/15 rounded-lg px-3 py-1.5 mb-2 text-left"
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span className="text-xs font-semibold text-red-300">
                  {needsReason.length} {needsReason.length === 1 ? 'activity needs' : 'need'} delay reason
                </span>
              </div>
              <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          );
        })()}

        {/* Floor Tabs */}
        {(activeView === 'floor' || activeView === 'all') && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => { setActiveView('all'); clearFilters(); setSelectedIds(new Set()); setBulkMode(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                activeView === 'all' ? 'bg-primary text-white' : 'bg-navy-light text-gray-300 hover:bg-navy-light/80'
              }`}
            >
              All
            </button>
            {floors.map(f => (
              <button
                key={f}
                onClick={() => { setActiveView('floor'); setActiveFloor(f); clearFilters(); setSelectedIds(new Set()); setBulkMode(false); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeView === 'floor' && activeFloor === f ? 'bg-primary text-white' : 'bg-navy-light text-gray-300 hover:bg-navy-light/80'
                }`}
              >
                Floor {f}
              </button>
            ))}
          </div>
        )}

        {/* Priority view header */}
        {(activeView === 'overdue' || activeView === 'due_today' || activeView === 'starting_today') && (
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
        {(activeView === 'overdue' || activeView === 'due_today' || activeView === 'starting_today') && (
          <div className="space-y-3">
            {getPriorityRows().length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">{activeView === 'overdue' ? '\u{1F389}' : '\u{1F4CB}'}</div>
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

        {/* All floors view content */}
        {activeView === 'all' && (
          <>
            {/* Collapsed search + filter row */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search flat, floor, stage, vendor..."
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
                  showFilters || hasFilters
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75M10.5 18a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 18H7.5m3-6h9.75M10.5 12a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 12H7.5" />
                </svg>
                Filter
                {hasFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* Expandable advanced filters */}
            {showFilters && (
              <>
                <SupervisorFilters
                  stages={projectData?.stages || []}
                  subStageOptions={subStageOptions}
                  activityOptions={activityOptions}
                  stageFilter={stageFilter}
                  subStageFilter={subStageFilter}
                  activityFilter={activityFilter}
                  statusDropdown={statusDropdown}
                  onStageChange={(v) => { setStageFilter(v); setSubStageFilter(''); setActivityFilter(''); setSelectedIds(new Set()); }}
                  onSubStageChange={(v) => { setSubStageFilter(v); setActivityFilter(''); setSelectedIds(new Set()); }}
                  onActivityChange={(v) => { setActivityFilter(v); setSelectedIds(new Set()); }}
                  onStatusChange={(v) => { setStatusDropdown(v); setSelectedIds(new Set()); }}
                />
                {hasFilters && (
                  <button onClick={() => { clearFilters(); setSelectedIds(new Set()); }} className="text-xs text-primary font-medium mb-3 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    Clear all filters
                  </button>
                )}
              </>
            )}

            {!stageFilter && !search ? (
              <div className="text-center py-16">
                <svg className="w-14 h-14 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Search or filter to view activities</h3>
                <p className="text-sm text-gray-500 mt-1">Type a flat number, stage name, or use the filters above.</p>
              </div>
            ) : allFloorRows.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">{'\u{1F3D7}️'}</div>
                <h3 className="text-lg font-semibold text-gray-900">No activities found</h3>
                <p className="text-sm text-gray-500 mt-1">Try changing the filters or search keyword.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 mb-2">{allFloorRows.length} activities across {allFloorGrouped.length} floors</div>
                {allFloorGrouped.map(group => (
                  <div key={group.floor}>
                    <div className="flex items-center gap-2 py-2">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Floor {group.floor}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{group.rows.length}</span>
                    </div>
                    <div className="space-y-3 mb-4">
                      {group.rows.map(row => (
                        <ActivityCard
                          key={row.id}
                          row={row}
                          bulkMode={bulkMode}
                          isSelected={selectedIds.has(row.id)}
                          onToggleSelect={toggleSelection}
                          onOpenDetail={openDetail}
                          onQuickAction={handleQuickAction}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Floor view content */}
        {activeView === 'floor' && (
          <>
            {/* Floor summary strip */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {([
                { label: 'Total', count: statusCounts.total, filter: null as string | null, borderColor: '', activeBg: 'bg-amber-50' },
                { label: 'Not Started', count: statusCounts.not_started, filter: 'not_started', borderColor: 'border-gray-300', activeBg: 'bg-gray-50' },
                { label: 'In Progress', count: statusCounts.in_progress, filter: 'in_progress', borderColor: 'border-blue-300', activeBg: 'bg-blue-50' },
                { label: 'Completed', count: statusCounts.completed, filter: 'completed', borderColor: 'border-green-300', activeBg: 'bg-green-50' },
                { label: 'Overdue', count: statusCounts.overdue, filter: '__overdue__', borderColor: 'border-red-300', activeBg: 'bg-red-50' },
                { label: 'On Hold', count: statusCounts.on_hold, filter: 'on_hold', borderColor: 'border-amber-300', activeBg: 'bg-amber-50' },
              ]).map(stat => (
                <button
                  key={stat.label}
                  onClick={() => setStatusFilter(statusFilter === stat.filter ? null : stat.filter)}
                  className={`min-w-[68px] flex-shrink-0 flex flex-col items-center py-2 rounded-xl border transition-all ${
                    statusFilter === stat.filter
                      ? `${stat.borderColor || 'border-primary'} ${stat.activeBg} ring-1 ring-primary/30`
                      : `border-gray-200 bg-white ${stat.borderColor ? `hover:${stat.borderColor}` : ''}`
                  }`}
                >
                  <div className="text-lg font-bold text-gray-900">{stat.count}</div>
                  <div className="text-[9px] text-gray-500 leading-tight">{stat.label}</div>
                </button>
              ))}
            </div>

            {/* Collapsed search + filter row */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search flat, stage, vendor..."
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
                  showFilters || hasFilters
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75M10.5 18a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 18H7.5m3-6h9.75M10.5 12a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 12H7.5" />
                </svg>
                Filter
                {hasFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* Expandable advanced filters */}
            {showFilters && (
              <>
                <SupervisorFilters
                  stages={projectData?.stages || []}
                  subStageOptions={subStageOptions}
                  activityOptions={activityOptions}
                  stageFilter={stageFilter}
                  subStageFilter={subStageFilter}
                  activityFilter={activityFilter}
                  statusDropdown={statusDropdown}
                  onStageChange={(v) => { setStageFilter(v); setSubStageFilter(''); setActivityFilter(''); }}
                  onSubStageChange={(v) => { setSubStageFilter(v); setActivityFilter(''); }}
                  onActivityChange={(v) => setActivityFilter(v)}
                  onStatusChange={(v) => setStatusDropdown(v)}
                />
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-primary font-medium mb-3 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    Clear all filters
                  </button>
                )}
              </>
            )}

            {/* Activity Cards */}
            <div className="space-y-3">
              {floorRows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">{'\u{1F3D7}️'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">No activities found</h3>
                  <p className="text-sm text-gray-500 mt-1">Try changing the filters or search keyword.</p>
                </div>
              ) : (
                floorRows.slice(0, 20).map(row => (
                  <ActivityCard
                    key={row.id}
                    row={row}
                    bulkMode={bulkMode}
                    isSelected={selectedIds.has(row.id)}
                    onToggleSelect={toggleSelection}
                    onOpenDetail={openDetail}
                    onQuickAction={handleQuickAction}
                  />
                ))
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
      {allowBulk && <BulkUpdateBar
        activeView={activeView}
        stageFilter={stageFilter}
        bulkMode={bulkMode}
        selectedIds={selectedIds}
        allActivities={allActivities}
        allFloorGrouped={allFloorGrouped}
        projectId={selectedProjectId}
        userId={user?.id || ''}
        onToggleBulkMode={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
        onBulkComplete={() => { setBulkMode(false); setSelectedIds(new Set()); setRefreshKey(k => k + 1); }}
      />}

      {/* Photo prompt when completing */}
      {showPhotoPrompt && (
        <PhotoPromptModal
          onConfirm={confirmComplete}
          onCancel={() => setShowPhotoPrompt(null)}
        />
      )}

      {/* Delay reason prompt */}
      {delayPromptRow && (
        <DelayReasonModal
          reasons={reasons}
          mode={delayPromptMode}
          onConfirm={(reason) => confirmDelay(reason)}
          onCancel={() => { setDelayPromptRow(null); setDelayPromptMode('overdue_capture'); setPendingDetailRow(null); }}
        />
      )}

      {/* Activity Detail Bottom Sheet */}
      {selectedDetail && (
        <ActivityDetailSheet
          activity={selectedDetail}
          reasons={reasons}
          userId={user?.id || ''}
          projectId={selectedProjectId}
          projectName={availableProjects.find(p => p.id === selectedProjectId)?.name || ''}
          onClose={() => setSelectedDetail(null)}
          onSaved={() => { setSelectedDetail(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
