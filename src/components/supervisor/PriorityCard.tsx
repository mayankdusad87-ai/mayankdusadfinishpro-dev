'use client';

import { memo } from 'react';
import { UploadedActivity } from '@/lib/project-data-store';
import { STATUS_CONFIG, normalizeStatus, daysOverdue, TODAY } from './supervisor-utils';

interface PriorityCardProps {
  row: UploadedActivity;
  onDetail: () => void;
  onQuickAction: (action: 'start' | 'complete') => void;
}

function PriorityCard({ row, onDetail, onQuickAction }: PriorityCardProps) {
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
        </div>
      )}
    </div>
  );
}

export default memo(PriorityCard);
