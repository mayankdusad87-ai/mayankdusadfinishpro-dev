'use client';

import { useState } from 'react';
import { UploadedActivity } from '@/lib/project-data-store';
import { bulkUpdateStatus } from '@/services/activity-service';
import { normalizeStatus, PriorityView } from './supervisor-utils';
import type { Reason } from '@/lib/supabase-data';

interface BulkUpdateBarProps {
  activeView: PriorityView;
  stageFilter: string;
  bulkMode: boolean;
  selectedIds: Set<string>;
  allActivities: UploadedActivity[];
  allFloorGrouped: { floor: number; rows: UploadedActivity[] }[];
  projectId: string;
  userId: string;
  reasons: Reason[];
  onToggleBulkMode: () => void;
  onBulkComplete: () => void;
}

export default function BulkUpdateBar({
  activeView,
  stageFilter,
  bulkMode,
  selectedIds,
  allActivities,
  allFloorGrouped,
  projectId,
  userId,
  reasons,
  onToggleBulkMode,
  onBulkComplete,
}: BulkUpdateBarProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [showHoldPicker, setShowHoldPicker] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (activeView !== 'floor' && !(activeView === 'all' && stageFilter)) return null;

  async function handleBulkAction(newStatus: 'in_progress' | 'completed') {
    const result = await bulkUpdateStatus(
      [...selectedIds],
      allActivities.map(a => ({
        id: a.id,
        status: a.status,
        actual_start: a.actual_start || null,
        floor: a.floor,
        flat_number: a.flat_number,
        stage: a.stage,
        stage_gate: a.stage_gate,
        activity: a.activity,
      })),
      newStatus,
      projectId,
      userId,
    );

    if (result.skippedNoPhoto && result.skippedNoPhoto > 0) {
      const msg = `${result.skippedNoPhoto} skipped — no photos uploaded yet`;
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    }

    onBulkComplete();
  }

  async function handleBulkHold() {
    if (!selectedReason) return;
    setSubmitting(true);

    const result = await bulkUpdateStatus(
      [...selectedIds],
      allActivities.map(a => ({
        id: a.id,
        status: a.status,
        actual_start: a.actual_start || null,
        floor: a.floor,
        flat_number: a.flat_number,
        stage: a.stage,
        stage_gate: a.stage_gate,
        activity: a.activity,
      })),
      'on_hold',
      projectId,
      userId,
      selectedReason,
    );

    setSubmitting(false);
    setShowHoldPicker(false);
    setSelectedReason('');

    if (result.skippedNoPhoto && result.skippedNoPhoto > 0) {
      const msg = `${result.skippedNoPhoto} skipped — no photos uploaded yet`;
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
    }

    const count = selectedIds.size;
    setToast(`${count} activit${count === 1 ? 'y' : 'ies'} put on hold`);
    setTimeout(() => setToast(null), 3000);

    onBulkComplete();
  }

  return (
    <>
      {/* Toast for feedback */}
      {toast && (
        <div className="fixed bottom-16 left-0 right-0 max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto px-4 z-50">
          <div className="bg-amber-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl text-center shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Hold reason picker modal */}
      {showHoldPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-md mx-auto max-h-[80vh] flex flex-col overflow-hidden shadow-xl">
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Put On Hold</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedIds.size} activit{selectedIds.size === 1 ? 'y' : 'ies'} selected
                  </p>
                </div>
                <button
                  onClick={() => { setShowHoldPicker(false); setSelectedReason(''); }}
                  className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reason list */}
            <div className="px-5 py-3 overflow-y-auto flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Select reason</p>
              <div className="space-y-1.5">
                {reasons.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReason(r.label)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      selectedReason === r.label
                        ? 'bg-orange-50 text-orange-700 ring-2 ring-orange-400'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setShowHoldPicker(false); setSelectedReason(''); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkHold}
                disabled={!selectedReason || submitting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-navy-dark border-t border-white/10 px-4 py-3 max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto">
        {bulkMode && selectedIds.size > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-white text-sm font-medium flex-shrink-0">
              {selectedIds.size} selected{activeView === 'all' ? ` (${allFloorGrouped.filter(g => g.rows.some(r => selectedIds.has(r.id) && normalizeStatus(r.status) !== 'completed')).length} floors)` : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('in_progress')}
                className="px-3 py-2 bg-blue-500 text-white text-xs font-semibold rounded-lg"
              >
                Start
              </button>
              <button
                onClick={() => handleBulkAction('completed')}
                className="px-3 py-2 bg-green-500 text-white text-xs font-semibold rounded-lg"
              >
                Complete
              </button>
              <button
                onClick={() => setShowHoldPicker(true)}
                className="px-3 py-2 bg-orange-500 text-white text-xs font-semibold rounded-lg"
              >
                On Hold
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-sm font-semibold">Bulk Update</div>
              <div className="text-gray-400 text-xs">Select multiple activities to update status.</div>
            </div>
            <button
              onClick={onToggleBulkMode}
              className={`relative w-12 h-7 rounded-full transition-colors ${bulkMode ? 'bg-primary' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${bulkMode ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
