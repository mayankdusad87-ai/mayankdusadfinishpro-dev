'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TARGET_STATUS_CONFIG,
  formatFloorRange,
  type TargetAchievementResult,
  type TargetSummary,
  type TargetStatus,
} from '@/lib/target-engine';
import Modal from '@/components/shared/Modal';

interface Props {
  projectId: string;
  projectName: string;
  stages: string[];
  floors: number[];
  /** Is the current user an admin? */
  isAdmin?: boolean;
}

interface AchievementData {
  targets: TargetAchievementResult[];
  summary: TargetSummary;
}

// ---- Cache helper (mirrors the SWR pattern from Insights) ----
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
function cacheKey(pid: string) { return `target_ach_${pid}`; }

function readCache(pid: string): AchievementData | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(pid));
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) {
      sessionStorage.removeItem(cacheKey(pid));
      return null;
    }
    return cached.data as AchievementData;
  } catch { return null; }
}

function writeCache(pid: string, data: AchievementData) {
  try {
    sessionStorage.setItem(cacheKey(pid), JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full */ }
}

// ---- Component ----

export default function TargetAchievement({ projectId, projectName, stages, floors, isAdmin = false }: Props) {
  const [data, setData] = useState<AchievementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAllTargets, setShowAllTargets] = useState(false);
  const loadedForProject = useRef<string | null>(null);

  // Form state
  const [formStage, setFormStage] = useState('');
  const [formFloorFrom, setFormFloorFrom] = useState<number | ''>('');
  const [formFloorTo, setFormFloorTo] = useState<number | ''>('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit / delete
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAchievements = useCallback(async (skipCache = false) => {
    if (!projectId) return;

    // SWR: show cached data instantly
    if (!skipCache) {
      const cached = readCache(projectId);
      if (cached) {
        setData(cached);
        setLoading(false);
        loadedForProject.current = projectId;
        // Still fetch fresh in background
      } else {
        setLoading(true);
      }
    }

    try {
      const res = await fetch(`/api/targets/achievement?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to load');
      const fresh: AchievementData = await res.json();
      setData(fresh);
      writeCache(projectId, fresh);
      loadedForProject.current = projectId;
    } catch (err) {
      console.error('[TargetAchievement] load error:', err);
      // Keep cached data if available
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadedForProject.current = null;
    loadAchievements();
  }, [loadAchievements]);

  function resetForm() {
    setFormStage('');
    setFormFloorFrom('');
    setFormFloorTo('');
    setFormTargetDate('');
    setFormNotes('');
    setFormError('');
    setEditingId(null);
  }

  function openEdit(t: TargetAchievementResult) {
    setEditingId(t.id);
    setFormTargetDate(t.targetDate);
    setFormNotes(t.notes || '');
    setFormStage(t.stage);
    setFormFloorFrom(t.floorFrom);
    setFormFloorTo(t.floorTo);
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (editingId) {
      // Update: only date + notes
      if (!formTargetDate) { setFormError('Target date is required'); return; }
      setSaving(true);
      setFormError('');
      try {
        const res = await fetch('/api/targets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, targetDate: formTargetDate, notes: formNotes }),
        });
        const d = await res.json();
        if (!res.ok) { setFormError(d.error || 'Failed to update'); setSaving(false); return; }
      } catch { setFormError('Network error'); setSaving(false); return; }
    } else {
      // Create
      if (!formStage || formFloorFrom === '' || formFloorTo === '' || !formTargetDate) {
        setFormError('Stage, floor range, and target date are required');
        return;
      }
      if (formFloorTo < formFloorFrom) {
        setFormError('"Floor To" must be ≥ "Floor From"');
        return;
      }
      setSaving(true);
      setFormError('');
      try {
        const res = await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            stage: formStage,
            floorFrom: formFloorFrom,
            floorTo: formFloorTo,
            targetDate: formTargetDate,
            notes: formNotes,
          }),
        });
        const d = await res.json();
        if (!res.ok) { setFormError(d.error || 'Failed to create'); setSaving(false); return; }
      } catch { setFormError('Network error'); setSaving(false); return; }
    }

    setSaving(false);
    resetForm();
    setShowForm(false);
    // Clear cache and reload
    try { sessionStorage.removeItem(cacheKey(projectId)); } catch {}
    await loadAchievements(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch('/api/targets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const d = await res.json();
        console.error('Delete failed:', d.error);
      }
    } catch { /* ignore */ }
    setDeletingId(null);
    try { sessionStorage.removeItem(cacheKey(projectId)); } catch {}
    await loadAchievements(true);
  }

  // ---- Render ----

  // Loading skeleton
  if (loading && !data) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // No targets → show prompt (admin) or nothing (management)
  if (!data || data.targets.length === 0) {
    if (!isAdmin) return null;  // Management users see nothing when no targets
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C8922A]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#C8922A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Target Achievement</h3>
              <p className="text-xs text-gray-400">Set monthly targets and track completion</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C8922A] bg-[#C8922A]/10 border border-[#C8922A]/20 rounded-lg hover:bg-[#C8922A]/20 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Set Target
          </button>
        </div>
        <div className="text-center py-10 px-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">No targets set</p>
          <p className="text-xs text-gray-400 mt-1">Set a target like &quot;Complete Pre-Tiling for Floors 3–8 by Sep 15&quot;</p>
        </div>
        {renderFormModal()}
      </div>
    );
  }

  const { targets, summary } = data;
  // Show max 4 cards in summary view
  const visibleTargets = showAllTargets ? targets : targets.slice(0, 4);
  const hasMore = targets.length > 4;

  return (
    <div className="space-y-3">
      {/* ---- Header row ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C8922A]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#C8922A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Target Achievement</h3>
            <p className="text-xs text-gray-400">
              {summary.achieved + summary.delayed} of {summary.total} targets achieved
              {summary.atRisk > 0 && <span className="text-orange-600 ml-1">· {summary.atRisk} at risk</span>}
              {summary.missed > 0 && <span className="text-red-600 ml-1">· {summary.missed} missed</span>}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C8922A] bg-[#C8922A]/10 border border-[#C8922A]/20 rounded-lg hover:bg-[#C8922A]/20 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Set Target
          </button>
        )}
      </div>

      {/* ---- Target cards grid ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleTargets.map(t => (
          <TargetCard
            key={t.id}
            target={t}
            isAdmin={isAdmin}
            onEdit={() => openEdit(t)}
            onDelete={() => handleDelete(t.id)}
            deleting={deletingId === t.id}
          />
        ))}
      </div>

      {/* View all / collapse */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setShowAllTargets(!showAllTargets)}
            className="text-xs font-medium text-[#C8922A] hover:text-[#a8771e] transition-colors cursor-pointer"
          >
            {showAllTargets ? 'Show less' : `View all ${targets.length} targets`}
          </button>
        </div>
      )}

      {renderFormModal()}
    </div>
  );

  // ---- Form modal (shared for create + edit) ----
  function renderFormModal() {
    return (
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? 'Edit Target' : 'Set New Target'}
      >
        <div className="space-y-4">
          {/* Stage selector (disabled when editing) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
            <select
              value={formStage}
              onChange={e => setFormStage(e.target.value)}
              disabled={!!editingId}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A] disabled:opacity-50 disabled:bg-gray-50"
            >
              <option value="">Select stage</option>
              {stages.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Floor range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor From</label>
              <select
                value={formFloorFrom}
                onChange={e => setFormFloorFrom(e.target.value ? Number(e.target.value) : '')}
                disabled={!!editingId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A] disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="">From</option>
                {floors.map(f => (
                  <option key={f} value={f}>Floor {f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor To</label>
              <select
                value={formFloorTo}
                onChange={e => setFormFloorTo(e.target.value ? Number(e.target.value) : '')}
                disabled={!!editingId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A] disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="">To</option>
                {floors.filter(f => formFloorFrom === '' || f >= formFloorFrom).map(f => (
                  <option key={f} value={f}>Floor {f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Target date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target Date</label>
            <input
              type="date"
              value={formTargetDate}
              onChange={e => setFormTargetDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="Additional context"
              maxLength={500}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A]"
            />
          </div>

          {/* Error */}
          {formError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#C8922A] rounded-lg hover:bg-[#b07e22] disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editingId ? 'Update' : 'Set Target'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
}

// ---- TargetCard sub-component ----

function TargetCard({
  target: t,
  isAdmin,
  onEdit,
  onDelete,
  deleting,
}: {
  target: TargetAchievementResult;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const cfg = TARGET_STATUS_CONFIG[t.status];
  const floorLabel = formatFloorRange(t.floorFrom, t.floorTo);

  function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className={`bg-white rounded-xl border ${cfg.border} overflow-hidden transition-all hover:shadow-sm ${deleting ? 'opacity-50' : ''}`}>
      {/* Status bar */}
      <div className={`${cfg.bg} px-4 py-2 flex items-center justify-between`}>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-[#C8922A] hover:bg-[#C8922A]/10 rounded transition-colors cursor-pointer"
              title="Edit target"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Delete target"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {/* Stage + floors */}
        <h4 className="text-sm font-bold text-gray-900 truncate">{t.stage}</h4>
        <p className="text-[11px] text-gray-500 mt-0.5">{floorLabel}</p>

        {/* Progress bar */}
        <div className="mt-3 mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium tabular-nums">{t.completedFlats}/{t.totalFlats} flats</span>
            <span className="text-gray-500 font-semibold tabular-nums">{t.progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${t.progressPct}%`,
                backgroundColor: statusBarColor(t.status),
              }}
            />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span>
            By <strong className="text-gray-700">{fmtDate(t.targetDate)}</strong>
          </span>
          {t.status === 'achieved' && (
            <span className="text-emerald-600 font-semibold">✓ On time</span>
          )}
          {t.status === 'delayed' && t.daysLate !== null && (
            <span className="text-amber-600 font-semibold">
              Done {t.daysLate} day{t.daysLate === 1 ? '' : 's'} late
            </span>
          )}
          {t.status === 'missed' && (
            <span className="text-red-600 font-semibold">
              {Math.abs(t.daysRemaining)} day{Math.abs(t.daysRemaining) === 1 ? '' : 's'} overdue
            </span>
          )}
          {t.status === 'on_track' && t.daysRemaining > 0 && (
            <span className="text-green-600">
              {t.daysRemaining} day{t.daysRemaining === 1 ? '' : 's'} left
            </span>
          )}
          {t.status === 'at_risk' && t.daysRemaining > 0 && (
            <span className="text-orange-600 font-semibold">
              {t.daysRemaining} day{t.daysRemaining === 1 ? '' : 's'} left — pace too slow
            </span>
          )}
        </div>

        {/* Delay reasons (only for missed/at_risk/delayed) */}
        {t.delayReasons.length > 0 && (t.status === 'missed' || t.status === 'at_risk' || t.status === 'delayed') && (
          <div className="mt-2 space-y-1">
            {t.delayReasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                <span className="text-gray-500 truncate">{r.reason}</span>
                <span className="text-gray-400 tabular-nums shrink-0">({r.count})</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {t.notes && (
          <p className="mt-2 text-[10px] text-gray-400 italic truncate">{t.notes}</p>
        )}
      </div>
    </div>
  );
}

function statusBarColor(status: TargetStatus): string {
  switch (status) {
    case 'achieved': return '#10B981';
    case 'delayed': return '#F59E0B';
    case 'missed': return '#EF4444';
    case 'on_track': return '#22C55E';
    case 'at_risk': return '#F97316';
  }
}
