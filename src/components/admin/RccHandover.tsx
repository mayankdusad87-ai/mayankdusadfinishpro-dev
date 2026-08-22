'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFloorHandovers, bulkUpsertFloorHandovers } from '@/repositories/handover-repo';
import type { FloorHandover } from '@/repositories/handover-repo';
import { getProjectFloors } from '@/repositories/project-repo';

interface Props {
  projectId: string;
}

interface FloorRow {
  floor: number;
  planned: string;
  actual: string;
  remarks: string;
  dirty: boolean;
}

function handoverStatus(planned: string, actual: string): { label: string; cls: string } {
  if (actual) {
    if (!planned) return { label: '✅ Done', cls: 'text-emerald-600' };
    const p = new Date(planned);
    const a = new Date(actual);
    const diff = Math.round((a.getTime() - p.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return { label: '✅ On time', cls: 'text-emerald-600' };
    return { label: `✅ ${diff}d late`, cls: 'text-amber-600' };
  }
  if (planned) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const p = new Date(planned);
    const diff = Math.round((today.getTime() - p.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) return { label: `⏳ ${diff}d overdue`, cls: 'text-red-600 font-semibold' };
    if (diff === 0) return { label: '⏳ Due today', cls: 'text-amber-600' };
    return { label: `⏳ In ${Math.abs(diff)}d`, cls: 'text-blue-600' };
  }
  return { label: '— No date', cls: 'text-gray-400' };
}

export default function RccHandover({ projectId }: Props) {
  const [rows, setRows] = useState<FloorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [floors, handovers] = await Promise.all([
        getProjectFloors(projectId),
        getFloorHandovers(projectId),
      ]);
      const handoverMap = new Map<number, FloorHandover>();
      for (const h of handovers) handoverMap.set(h.floor, h);

      const merged: FloorRow[] = floors.map(f => {
        const h = handoverMap.get(f);
        return {
          floor: f,
          planned: h?.planned_handover ?? '',
          actual: h?.actual_handover ?? '',
          remarks: h?.remarks ?? '',
          dirty: false,
        };
      });
      setRows(merged);
    } catch (err) {
      console.error('[RccHandover] load error:', err);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  function updateRow(floor: number, field: 'planned' | 'actual' | 'remarks', value: string) {
    setRows(prev => prev.map(r =>
      r.floor === floor ? { ...r, [field]: value, dirty: true } : r
    ));
    setSaved(false);
  }

  async function handleSave() {
    const dirtyRows = rows.filter(r => r.dirty);
    if (dirtyRows.length === 0) return;
    setSaving(true);
    try {
      await bulkUpsertFloorHandovers(
        projectId,
        dirtyRows.map(r => ({
          floor: r.floor,
          planned: r.planned || null,
          actual: r.actual || null,
          remarks: r.remarks || null,
        })),
      );
      setRows(prev => prev.map(r => ({ ...r, dirty: false })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[RccHandover] save error:', err);
      alert('Failed to save. Please try again.');
    }
    setSaving(false);
  }

  const hasDirty = rows.some(r => r.dirty);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No floors found for this project. Upload activity data first.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">RCC Floor Handover</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track when each floor is handed over by the civil/RCC team</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasDirty || saving}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              hasDirty
                ? 'bg-[#C8922A] text-white hover:bg-[#b07e22]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Floor</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Date</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actual Date</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(r => {
                const status = handoverStatus(r.planned, r.actual);
                return (
                  <tr key={r.floor} className={`hover:bg-gray-50 ${r.dirty ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-3 py-2 font-bold text-gray-900 tabular-nums">{r.floor}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={r.planned}
                        onChange={e => updateRow(r.floor, 'planned', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-[#C8922A]/30 focus:border-[#C8922A] outline-none w-[150px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={r.actual}
                        onChange={e => updateRow(r.floor, 'actual', e.target.value)}
                        className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-[#C8922A]/30 focus:border-[#C8922A] outline-none w-[150px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
