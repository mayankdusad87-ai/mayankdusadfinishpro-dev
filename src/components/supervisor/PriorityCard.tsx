'use client';

import { memo } from 'react';
import { UploadedActivity } from '@/lib/project-data-store';
import { STATUS_CONFIG, normalizeStatus, daysOverdue, TODAY } from './supervisor-utils';

interface PriorityCardProps {
  row: UploadedActivity;
  savingId?: string | null;
  onDetail: () => void;
  onQuickAction: (action: 'start' | 'complete') => void;
}

function PriorityCard({ row, savingId, onDetail, onQuickAction }: PriorityCardProps) {
  const isSaving = savingId === row.id;
  const status = normalizeStatus(row.status);
  const sc = STATUS_CONFIG[status];
  const overdueDays = row.expected_end && row.expected_end < TODAY ? daysOverdue(row.expected_end) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between" onClick={onDetail}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-gray-900">{row.activity}</div>
          <div className="text-xs text-gray-500 mt-1">F{row.floor} &bull; Flat {row.flat_number}</div>
          <div className="text-xs text-primary font-medium mt-0.5">{row.stage} → {row.stage_gate}</div>
          <div className="text-xs text-gray-400 mt-0.5">{row.vendor}</div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
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

      {status !== 'completed' && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {status === 'not_started' && (
            <button
              onClick={() => onQuickAction('start')}
              disabled={isSaving}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
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
            onClick={() => onQuickAction('complete')}
            disabled={isSaving}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
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

export default memo(PriorityCard);
