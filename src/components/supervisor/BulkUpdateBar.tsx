'use client';

import { useState } from 'react';
import { UploadedActivity } from '@/lib/project-data-store';
import { bulkUpdateStatus } from '@/services/activity-service';
import { normalizeStatus, PriorityView } from './supervisor-utils';

interface BulkUpdateBarProps {
  activeView: PriorityView;
  stageFilter: string;
  bulkMode: boolean;
  selectedIds: Set<string>;
  allActivities: UploadedActivity[];
  allFloorGrouped: { floor: number; rows: UploadedActivity[] }[];
  projectId: string;
  userId: string;
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
  onToggleBulkMode,
  onBulkComplete,
}: BulkUpdateBarProps) {
  const [toast, setToast] = useState<string | null>(null);

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

  return (
    <>
      {/* Toast for skipped activities */}
      {toast && (
        <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 z-50">
          <div className="bg-amber-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl text-center shadow-lg">
            {toast}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-navy-dark border-t border-white/10 px-4 py-3 max-w-md mx-auto">
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
