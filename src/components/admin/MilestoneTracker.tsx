'use client';

import { useState, useCallback, useEffect } from 'react';
import { getMilestones } from '@/repositories/milestone-repo';
import type { Milestone, MilestoneProgress } from '@/repositories/milestone-repo';
import { computeMilestoneProgress } from '@/lib/milestone-engine';
import Modal from '@/components/shared/Modal';

interface ActivityForMilestone {
  floor: number;
  flat_number: number;
  stage: string;
  stage_gate: string | null;
  status: string;
}

interface Props {
  projectId: string;
  projectName: string;
  activities: ActivityForMilestone[];
  stages: string[];
  floors: number[];
}

const STATUS_CONFIG = {
  completed: { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  on_track: { label: 'On Track', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  at_risk: { label: 'At Risk', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  not_started: { label: 'Not Started', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
} as const;

export default function MilestoneTracker({ projectId, projectName, activities, stages, floors }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<MilestoneProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [stage, setStage] = useState('');
  const [floorFrom, setFloorFrom] = useState<number | ''>('');
  const [floorTo, setFloorTo] = useState<number | ''>('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadMilestones = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const ms = await getMilestones(projectId);
      setMilestones(ms);
      const prog = computeMilestoneProgress(ms, activities);
      setProgress(prog);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [projectId, activities]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  // Auto-generate title when stage + floors change
  useEffect(() => {
    if (!editingId && stage && floorFrom !== '' && floorTo !== '') {
      const auto = floorFrom === floorTo
        ? `${stage} — Floor ${floorFrom}`
        : `${stage} — Floors ${floorFrom}-${floorTo}`;
      setTitle(auto);
    }
  }, [stage, floorFrom, floorTo, editingId]);

  function resetForm() {
    setTitle('');
    setStage('');
    setFloorFrom('');
    setFloorTo('');
    setTargetDate('');
    setNotes('');
    setError('');
    setEditingId(null);
  }

  function openEdit(m: MilestoneProgress) {
    setEditingId(m.id);
    setTitle(m.title);
    setTargetDate(m.targetDate);
    setNotes(m.notes || '');
    setStage(m.stage);
    setFloorFrom(m.floorFrom);
    setFloorTo(m.floorTo);
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!title || !stage || floorFrom === '' || floorTo === '' || !targetDate) {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        const res = await fetch('/api/milestones', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, title, targetDate, notes }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to update'); setSaving(false); return; }
      } else {
        const res = await fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title,
            stage,
            floorFrom,
            floorTo,
            targetDate,
            notes,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to create'); setSaving(false); return; }
      }

      resetForm();
      setShowForm(false);
      await loadMilestones();
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this milestone?')) return;
    try {
      await fetch('/api/milestones', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await loadMilestones();
    } catch { /* ignore */ }
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Project Milestones</h3>
            <p className="text-xs text-gray-400">SPI-based schedule tracking for {projectName}</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Target
        </button>
      </div>

      {/* Milestone cards */}
      {progress.length === 0 ? (
        <div className="text-center py-10 px-6">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">No milestones set</p>
          <p className="text-xs text-gray-400 mt-1">Add a target to track stage completion across floors</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {progress.map(m => {
            const cfg = STATUS_CONFIG[m.status];
            const spiDisplay = m.spi !== null ? m.spi.toFixed(2) : '—';

            return (
              <div key={m.id} className="px-5 py-4">
                {/* Title row */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{m.title}</h4>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => openEdit(m)}
                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{m.completedFlats}/{m.totalFlats} flats</span>
                    <span className="text-gray-500 tabular-nums">{m.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        m.status === 'completed' ? 'bg-emerald-500'
                        : m.status === 'on_track' ? 'bg-green-500'
                        : m.status === 'at_risk' ? 'bg-amber-500'
                        : m.status === 'critical' ? 'bg-red-500'
                        : 'bg-gray-300'
                      }`}
                      style={{ width: `${m.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Metrics row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
                  <span>
                    Target: <strong className="text-gray-700">{formatDate(m.targetDate)}</strong>
                  </span>
                  {m.daysRemaining > 0 ? (
                    <span>{m.daysRemaining} days left</span>
                  ) : m.daysRemaining === 0 ? (
                    <span className="text-amber-600 font-medium">Due today</span>
                  ) : (
                    <span className="text-red-600 font-medium">{Math.abs(m.daysRemaining)} days overdue</span>
                  )}
                  {m.spi !== null && (
                    <span>
                      SPI: <strong className={`tabular-nums ${
                        m.spi >= 0.95 ? 'text-green-600' : m.spi >= 0.85 ? 'text-amber-600' : 'text-red-600'
                      }`}>{spiDisplay}</strong>
                    </span>
                  )}
                  {m.estimatedFinish && m.status !== 'completed' && (
                    <span>
                      Est. finish: <strong className="text-gray-700">{formatDate(m.estimatedFinish)}</strong>
                    </span>
                  )}
                  {m.status === 'completed' && m.daysRemaining > 0 && (
                    <span className="text-emerald-600 font-medium">{m.daysRemaining} days early ✓</span>
                  )}
                  {m.status === 'completed' && m.daysRemaining < 0 && (
                    <span className="text-amber-600 font-medium">Finished {Math.abs(m.daysRemaining)} days late</span>
                  )}
                </div>

                {m.notes && (
                  <p className="mt-1.5 text-[11px] text-gray-400 italic">{m.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? 'Edit Milestone' : 'Add Milestone Target'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              disabled={!!editingId}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
            >
              <option value="">Select stage</option>
              {stages.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor From</label>
              <select
                value={floorFrom}
                onChange={e => setFloorFrom(e.target.value ? Number(e.target.value) : '')}
                disabled={!!editingId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
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
                value={floorTo}
                onChange={e => setFloorTo(e.target.value ? Number(e.target.value) : '')}
                disabled={!!editingId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              >
                <option value="">To</option>
                {floors.filter(f => floorFrom === '' || f >= floorFrom).map(f => (
                  <option key={f} value={f}>Floor {f}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto-generated from stage + floors"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
          )}

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
              className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editingId ? 'Update' : 'Create Target'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
