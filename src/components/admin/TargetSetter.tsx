'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/shared/Modal';

interface TargetRow {
  id: string;
  stage: string;
  floor_from: number;
  floor_to: number;
  target_date: string;
  notes: string | null;
  title: string;
}

/**
 * Admin-only component for CRUD management of project targets.
 * Lives on the Settings page — completely separate from Insights.
 */
export default function TargetSetter() {
  const { currentProject } = useProject();
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [floors, setFloors] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formStage, setFormStage] = useState('');
  const [formFloorFrom, setFormFloorFrom] = useState<number | ''>('');
  const [formFloorTo, setFormFloorTo] = useState<number | ''>('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = useCallback(async () => {
    if (!currentProject) {
      setTargets([]);
      setStages([]);
      setFloors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch targets, stages, and floors in parallel
      const [targetsRes, stagesRes, floorsRes] = await Promise.all([
        supabase.from('project_milestones').select('id, stage, floor_from, floor_to, target_date, notes, title')
          .eq('project_id', currentProject.id).order('target_date', { ascending: true }),
        supabase.from('activities').select('stage').eq('project_id', currentProject.id),
        supabase.from('activities').select('floor').eq('project_id', currentProject.id),
      ]);
      setTargets((targetsRes.data || []) as TargetRow[]);
      setStages([...new Set((stagesRes.data || []).map(r => r.stage))].sort());
      setFloors([...new Set((floorsRes.data || []).map(r => r.floor))].sort((a, b) => a - b));
    } catch { /* ignore */ }
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { loadData(); }, [loadData]);

  function resetForm() {
    setFormStage(''); setFormFloorFrom(''); setFormFloorTo('');
    setFormTargetDate(''); setFormNotes(''); setFormError('');
    setEditingId(null);
  }

  function openEdit(t: TargetRow) {
    setEditingId(t.id);
    setFormStage(t.stage);
    setFormFloorFrom(t.floor_from);
    setFormFloorTo(t.floor_to);
    setFormTargetDate(t.target_date);
    setFormNotes(t.notes || '');
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    setSuccessMsg('');
    if (editingId) {
      if (!formTargetDate) { setFormError('Target date is required'); return; }
      setSaving(true); setFormError('');
      try {
        const res = await fetch('/api/targets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, targetDate: formTargetDate, notes: formNotes }),
        });
        const d = await res.json();
        if (!res.ok) { setFormError(d.error || 'Failed'); setSaving(false); return; }
        setSuccessMsg('Target updated');
      } catch { setFormError('Network error'); setSaving(false); return; }
    } else {
      if (!formStage || formFloorFrom === '' || formFloorTo === '' || !formTargetDate) {
        setFormError('Stage, floor range, and target date are required'); return;
      }
      if (formFloorTo < formFloorFrom) {
        setFormError('"Floor To" must be ≥ "Floor From"'); return;
      }
      setSaving(true); setFormError('');
      try {
        const res = await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: currentProject!.id, stage: formStage,
            floorFrom: formFloorFrom, floorTo: formFloorTo,
            targetDate: formTargetDate, notes: formNotes,
          }),
        });
        const d = await res.json();
        if (!res.ok) { setFormError(d.error || 'Failed'); setSaving(false); return; }
        setSuccessMsg('Target created');
      } catch { setFormError('Network error'); setSaving(false); return; }
    }
    setSaving(false); resetForm(); setShowForm(false);
    await loadData();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete target "${title}"?`)) return;
    try {
      await fetch('/api/targets', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setSuccessMsg('Target deleted');
      await loadData();
    } catch { /* ignore */ }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function floorLabel(from: number, to: number) {
    return from === to ? `Floor ${from}` : `Floors ${from}–${to}`;
  }

  if (!currentProject) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Project Targets</h2>
        <p className="text-sm text-gray-400">Select a project from the top bar to manage targets.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Project Targets</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Set monthly targets for {currentProject.name}. e.g. &quot;Complete Pre-Tiling for Floors 3–8 by Sep 15&quot;
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setSuccessMsg(''); setShowForm(true); }}
          disabled={stages.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[#C8922A] rounded-lg hover:bg-[#b07e22] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={stages.length === 0 ? 'Upload activities first' : ''}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Set Target
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-lg p-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-between">
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-600">&times;</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-3 border-[#C8922A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : targets.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {stages.length === 0
            ? 'Upload activities for this project first, then set targets.'
            : 'No targets set yet. Click "Set Target" to add one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {targets.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-white">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">{t.stage}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">{floorLabel(t.floor_from, t.floor_to)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>By <strong className="text-gray-700">{fmtDate(t.target_date)}</strong></span>
                  {t.notes && <span className="text-gray-400 italic truncate max-w-[200px]">{t.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(t)}
                  className="p-1.5 text-gray-400 hover:text-[#C8922A] hover:bg-[#C8922A]/10 rounded-lg transition-colors cursor-pointer" title="Edit">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(t.id, t.title)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="Delete">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? 'Edit Target' : 'Set New Target'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
            <select value={formStage} onChange={e => setFormStage(e.target.value)} disabled={!!editingId}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A] disabled:opacity-50 disabled:bg-gray-50">
              <option value="">Select stage</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor From</label>
              <select value={formFloorFrom} onChange={e => setFormFloorFrom(e.target.value ? Number(e.target.value) : '')} disabled={!!editingId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A] disabled:opacity-50 disabled:bg-gray-50">
                <option value="">From</option>
                {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor To</label>
              <select value={formFloorTo} onChange={e => setFormFloorTo(e.target.value ? Number(e.target.value) : '')} disabled={!!editingId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A] disabled:opacity-50 disabled:bg-gray-50">
                <option value="">To</option>
                {floors.filter(f => formFloorFrom === '' || f >= formFloorFrom).map(f => <option key={f} value={f}>Floor {f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Target Date</label>
            <input type="date" value={formTargetDate} onChange={e => setFormTargetDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
              placeholder="Additional context" maxLength={500}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#C8922A]/20 focus:border-[#C8922A]" />
          </div>
          {formError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#C8922A] rounded-lg hover:bg-[#b07e22] disabled:opacity-50 cursor-pointer flex items-center gap-2">
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editingId ? 'Update' : 'Set Target'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
