'use client';

import { memo } from 'react';
import { UploadedActivity } from '@/lib/project-data-store';
import { SupervisorStatus, STATUS_CONFIG, normalizeStatus, daysOverdue, TODAY } from './supervisor-utils';

interface ActivityCardProps {
  row: UploadedActivity;
  bulkMode: boolean;
  isSelected: boolean;
  savingId?: string | null;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (row: UploadedActivity) => void;
  onQuickAction: (row: UploadedActivity, action: 'start' | 'complete') => void;
}

function ActivityCard({
  row,
  bulkMode,
  isSelected,
  savingId,
  onToggleSelect,
  onOpenDetail,
  onQuickAction,
}: ActivityCardProps) {
  const isSaving = savingId === row.id;
  const status = normalizeStatus(row.status);
  const sc = STATUS_CONFIG[status];
  const isCompleted = status === 'completed';
  const overdueDays = !isCompleted && row.expected_end && row.expected_end < TODAY
    ? daysOverdue(row.expected_end) : 0;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 transition-colors ${!bulkMode ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between" onClick={() => !bulkMode && onOpenDetail(row)}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {bulkMode && !isCompleted && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(row.id)}
              className="accent-[#C8922A] w-5 h-5 mt-0.5"
            />
          )}
          {bulkMode && isCompleted && (
            <input type="checkbox" disabled className="w-5 h-5 mt-0.5 opacity-30" />
          )}
          <div className="min-w-0">
            <div className="text-sm md:text-base font-bold text-gray-900">{row.activity}</div>
            <div className="text-xs md:text-sm text-gray-500 mt-1">F{row.floor} &bull; Flat {row.flat_number} &bull; {row.configuration}</div>
            <div className="text-xs md:text-sm text-primary font-medium mt-0.5">{row.stage} → {row.stage_gate}</div>
            <div className="text-xs md:text-sm text-gray-400 mt-0.5">{row.vendor}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] md:text-xs font-bold ${sc.bg} ${sc.text}`}>
            {sc.label}
          </span>
          {overdueDays > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-500 text-white text-[11px] md:text-xs font-bold">
              {overdueDays}d overdue
            </span>
          )}
        </div>
      </div>

      {!bulkMode && !isCompleted && status === 'on_hold' && row.delay_reason && (
        <div className="mt-3 pt-3 border-t border-gray-100" onClick={() => onOpenDetail(row)}>
          <div className="flex items-start gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="line-clamp-2">{row.delay_reason}</span>
          </div>
        </div>
      )}

      {!bulkMode && !isCompleted && status !== 'on_hold' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {status === 'not_started' && (
            <button
              onClick={() => onQuickAction(row, 'start')}
              disabled={isSaving}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-colors ${
                isSaving ? 'bg-blue-100 text-blue-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {isSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
              )}
              {isSaving ? 'Starting...' : 'Start'}
            </button>
          )}
          <button
            onClick={() => onQuickAction(row, 'complete')}
            disabled={isSaving}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-colors ${
              isSaving ? 'bg-green-100 text-green-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Complete
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(ActivityCard);
