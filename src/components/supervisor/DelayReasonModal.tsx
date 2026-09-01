'use client';

import { useState } from 'react';
import type { Reason } from '@/lib/supabase-data';

interface DelayReasonModalProps {
  reasons: Reason[];
  onConfirm: (reason: string, remarks: string) => void;
  onCancel: () => void;
  mode?: 'complete' | 'overdue_start' | 'overdue_capture';
}

export default function DelayReasonModal({ reasons, onConfirm, onCancel, mode = 'overdue_capture' }: DelayReasonModalProps) {
  const [selected, setSelected] = useState('');
  const [remarks, setRemarks] = useState('');
  const isOther = selected === '__other__';
  const isPreviousActivityPending = selected === 'Previous Activity Pending';
  const needsRemarks = isOther || isPreviousActivityPending;
  const canSubmit = selected && (needsRemarks ? remarks.trim().length > 0 : true);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center max-w-md md:max-w-lg mx-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-t-2xl w-full shadow-xl max-h-[70vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pb-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {mode === 'complete' ? 'Completing Overdue Activity'
                  : mode === 'overdue_start' ? 'Starting Overdue Activity'
                  : 'Overdue — Delay Reason Required'}
              </h3>
              <p className="text-xs text-gray-500">
                {mode === 'complete'
                  ? 'This activity crossed its expected end date. Please select the delay reason.'
                  : mode === 'overdue_start'
                  ? 'This activity is already past its expected end date. Please capture the reason before starting.'
                  : 'This activity is past its expected end date. Please capture the delay reason before proceeding.'}
              </p>
            </div>
          </div>

          {/* Reason picker */}
          <div className="space-y-2 mb-3">
            {reasons.map(r => (
              <button
                key={r.id}
                onClick={() => { setSelected(r.label); if (r.label !== 'Previous Activity Pending') setRemarks(''); }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selected === r.label
                    ? 'border-red-400 bg-red-50 text-red-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => { setSelected('__other__'); setRemarks(''); }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                isOther
                  ? 'border-red-400 bg-red-50 text-red-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              Other (specify below)
            </button>
          </div>

          {/* Remarks — for "Other" or "Previous Activity Pending" */}
          {needsRemarks && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isPreviousActivityPending ? 'Which activity is pending?' : 'Describe the delay reason'}
                {' '}<span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={isPreviousActivityPending ? 'e.g. Waterproofing not done yet...' : 'Describe the delay reason...'}
                maxLength={500}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none"
              />
              {remarks.trim().length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">Remarks are required</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const finalReason = isOther ? remarks.trim() : selected;
                onConfirm(finalReason, needsRemarks ? remarks.trim() : '');
              }}
              disabled={!canSubmit}
              className={`flex-1 py-2.5 font-semibold rounded-xl text-sm transition-colors ${
                canSubmit
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {mode === 'complete' ? 'Continue' : mode === 'overdue_start' ? 'Start Activity' : 'Submit & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
