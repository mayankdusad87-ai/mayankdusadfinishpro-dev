'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAppErrors, AppError } from '@/lib/supabase-data';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { formatTimestamp } from '@/lib/utils';

function parseContext(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export default function ErrorLogPage() {
  const [entries, setEntries] = useState<AppError[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    setLoading(true);
    const filters: { startDate?: string; endDate?: string; action?: string } = {};
    if (dateFrom) filters.startDate = dateFrom;
    if (dateTo) filters.endDate = dateTo;
    if (actionFilter) filters.action = actionFilter;
    const data = await getAppErrors(filters);
    setEntries(data);
    setCurrentPage(1);
    setLoading(false);
  }, [dateFrom, dateTo, actionFilter]);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  const totalPages = Math.max(1, Math.ceil(entries.length / DEFAULT_PAGE_SIZE));
  const paginated = entries.slice((currentPage - 1) * DEFAULT_PAGE_SIZE, currentPage * DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Error Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Application errors captured automatically. Use this to diagnose issues reported by supervisors.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Action</label>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g. upload photo"
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {(dateFrom || dateTo || actionFilter) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setActionFilter(''); }}
              className="h-9 px-3 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
          <div className="ml-auto text-sm text-gray-500">
            {entries.length} error{entries.length !== 1 ? 's' : ''}
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
            <svg className="w-12 h-12 text-green-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">No errors found</h3>
            <p className="text-sm text-gray-500 mt-1">Everything is running smoothly.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">When</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Error</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((entry) => {
                    const { date, time } = formatTimestamp(entry.created_at || '');
                    const ctx = parseContext(typeof entry.context === 'string' ? entry.context : null);
                    const isExpanded = expandedId === entry.id;

                    return (
                      <tr key={entry.id} className="border-l-4 border-l-red-400 hover:bg-gray-50/50 transition-colors align-top">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{date}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{time}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-gray-900 text-xs">{entry.user_email || 'Unknown'}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium">
                            {entry.action}
                          </span>
                          {entry.page_url && (
                            <div className="text-xs text-gray-400 mt-0.5">{entry.page_url}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-gray-900 text-xs">{entry.friendly_message}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Show details"
                          >
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Expanded detail panels rendered outside table for clean layout */}
              {paginated.map((entry) => {
                if (expandedId !== entry.id) return null;
                const ctx = parseContext(typeof entry.context === 'string' ? entry.context : null);
                return (
                  <div key={`detail-${entry.id}`} className="bg-gray-50 border-t border-b border-gray-200 px-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="font-semibold text-gray-600 uppercase tracking-wide mb-1">Raw error (for developer / AI)</div>
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800 font-mono break-all">
                          {entry.raw_error}
                        </div>
                      </div>
                      {ctx && (
                        <div>
                          <div className="font-semibold text-gray-600 uppercase tracking-wide mb-1">Context</div>
                          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-1">
                            {Object.entries(ctx).map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <span className="text-gray-500 capitalize">{k}:</span>
                                <span className="text-gray-900 font-medium">{String(v ?? '-')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                      Tip: Copy the raw error and paste it into ChatGPT or Claude with &quot;How do I fix this Supabase error?&quot; to get the SQL fix.
                    </div>
                  </div>
                );
              })}
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
