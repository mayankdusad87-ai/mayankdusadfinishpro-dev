'use client';

import { useState } from 'react';
import { useProject } from '@/lib/project-context';
import { getAuditLog, AuditLogRow } from '@/lib/supabase-data';
import { STATUS_LABELS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { formatTimestamp } from '@/lib/utils';
import { useDataLoader } from '@/hooks/use-data-loader';

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  delayed: 'bg-orange-100 text-orange-700',
  on_hold: 'bg-red-100 text-red-700',
};

export default function AuditLogPage() {
  const { currentProject } = useProject();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: entries, loading } = useDataLoader(
    async () => {
      if (!currentProject) return [];
      const filters: { startDate?: string; endDate?: string } = {};
      if (dateFrom) filters.startDate = dateFrom;
      if (dateTo) filters.endDate = dateTo;
      setCurrentPage(1);
      return getAuditLog(currentProject.id, filters);
    },
    [] as AuditLogRow[],
    [currentProject, dateFrom, dateTo],
  );

  const totalPages = Math.max(1, Math.ceil(entries.length / DEFAULT_PAGE_SIZE));
  const paginated = entries.slice((currentPage - 1) * DEFAULT_PAGE_SIZE, currentPage * DEFAULT_PAGE_SIZE);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p>Select a project first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log / Audit History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track status changes across activities for {currentProject.name}.
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
          <div className="ml-auto text-sm text-gray-500">
            {entries.length} record{entries.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">No status changes yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Status changes made by supervisors will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      Timestamp
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      Changed By
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      Activity
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      Location
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      Status Change
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((entry) => {
                    const { date, time } = formatTimestamp(entry.created_at || '');
                    return (
                      <tr key={entry.id} className="border-l-4 border-l-blue-400 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{date}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{time}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-gray-900">
                            {entry.changed_by_name || 'System'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-gray-900">{entry.activity_name || '-'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {entry.stage}{entry.stage_gate ? ` / ${entry.stage_gate}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="text-gray-700">
                            Floor {entry.floor}, Flat {entry.flat_number}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[entry.old_status] || 'bg-gray-100 text-gray-700'}`}>
                              {STATUS_LABELS[entry.old_status] || entry.old_status}
                            </span>
                            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[entry.new_status] || 'bg-gray-100 text-gray-700'}`}>
                              {STATUS_LABELS[entry.new_status] || entry.new_status}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <div className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * DEFAULT_PAGE_SIZE + 1} to {Math.min(currentPage * DEFAULT_PAGE_SIZE, entries.length)} of {entries.length}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
