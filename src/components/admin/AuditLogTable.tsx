'use client';

import { useState, useMemo } from 'react';
import { AuditLogEntry, ChangeType } from '@/lib/types';

interface AuditLogTableProps {
  entries: AuditLogEntry[];
}

const CHANGE_TYPE_LABELS: Record<ChangeType | 'all', string> = {
  all: 'All Types',
  date_change: 'Date Change',
  status_change: 'Status Change',
  vendor_change: 'Vendor Change',
  assignment_change: 'Assignment Change',
};

const CHANGE_TYPE_BORDER: Record<ChangeType, string> = {
  date_change: 'border-l-orange-400',
  status_change: 'border-l-blue-400',
  vendor_change: 'border-l-gray-400',
  assignment_change: 'border-l-purple-400',
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return { date, time };
}

export default function AuditLogTable({ entries }: AuditLogTableProps) {
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [changedByFilter, setChangedByFilter] = useState<string>('all');
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [exportOpen, setExportOpen] = useState(false);

  // Derive unique filter options
  const projectOptions = useMemo(
    () => [...new Set(entries.map((e) => e.project_name).filter(Boolean))] as string[],
    [entries]
  );
  const floorOptions = useMemo(
    () => [...new Set(entries.map((e) => e.floor_label).filter(Boolean))] as string[],
    [entries]
  );
  const changedByOptions = useMemo(
    () => [...new Set(entries.map((e) => e.changed_by_name).filter(Boolean))] as string[],
    [entries]
  );

  // Filter entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (projectFilter !== 'all' && e.project_name !== projectFilter) return false;
      if (floorFilter !== 'all' && e.floor_label !== floorFilter) return false;
      if (changedByFilter !== 'all' && e.changed_by_name !== changedByFilter) return false;
      if (changeTypeFilter !== 'all' && e.change_type !== changeTypeFilter) return false;
      if (dateFrom) {
        const entryDate = new Date(e.changed_at).toISOString().split('T')[0];
        if (entryDate < dateFrom) return false;
      }
      if (dateTo) {
        const entryDate = new Date(e.changed_at).toISOString().split('T')[0];
        if (entryDate > dateTo) return false;
      }
      return true;
    });
  }, [entries, projectFilter, floorFilter, changedByFilter, changeTypeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedEntries = filtered.slice(
    (safeCurrentPage - 1) * perPage,
    safeCurrentPage * perPage
  );

  const startEntry = filtered.length === 0 ? 0 : (safeCurrentPage - 1) * perPage + 1;
  const endEntry = Math.min(safeCurrentPage * perPage, filtered.length);

  // Generate page numbers for pagination
  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safeCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  const selectClass =
    'h-9 pl-3 pr-8 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none cursor-pointer';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log / Audit History</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track all changes and actions performed across projects.
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-light transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export Log
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
              <button
                onClick={() => setExportOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
              >
                Export as CSV
              </button>
              <button
                onClick={() => setExportOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Export as Excel
              </button>
              <button
                onClick={() => setExportOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
              >
                Export as PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Project */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={selectClass}
            >
              <option value="all">All Projects</option>
              {projectOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Floor */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Floor
            </label>
            <select
              value={floorFilter}
              onChange={(e) => {
                setFloorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={selectClass}
            >
              <option value="all">All Floors</option>
              {floorOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Changed By */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Changed By
            </label>
            <select
              value={changedByFilter}
              onChange={(e) => {
                setChangedByFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={selectClass}
            >
              <option value="all">All Users</option>
              {changedByOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Change Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Change Type
            </label>
            <select
              value={changeTypeFilter}
              onChange={(e) => {
                setChangeTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={selectClass}
            >
              {Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  Target
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Field Changed
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  Old Value &rarr; New Value
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                  IP / Device
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No audit log entries found matching the current filters.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => {
                  const { date, time } = formatTimestamp(entry.changed_at);
                  const borderClass = CHANGE_TYPE_BORDER[entry.change_type] || 'border-l-gray-300';
                  const initials = getInitials(entry.changed_by_name);
                  const isAdmin = entry.changed_by_role === 'admin';

                  return (
                    <tr
                      key={entry.id}
                      className={`border-l-4 ${borderClass} hover:bg-gray-50/50 transition-colors`}
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{date}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{time}</div>
                      </td>

                      {/* Changed By */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                              isAdmin ? 'bg-navy' : 'bg-primary'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 whitespace-nowrap">
                              {entry.changed_by_name}
                            </div>
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                                isAdmin ? 'bg-navy' : 'bg-primary'
                              }`}
                            >
                              {entry.changed_by_role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2">
                          {/* Building icon */}
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            {entry.project_name && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">&bull;</span>
                                <span>{entry.project_name}</span>
                              </div>
                            )}
                            {entry.floor_label && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">&bull;</span>
                                <span>{entry.floor_label}</span>
                              </div>
                            )}
                            {entry.flat_number && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">&bull;</span>
                                <span>{entry.flat_number}</span>
                              </div>
                            )}
                            {entry.activity_name && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-300">&bull;</span>
                                <span>{entry.activity_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Field Changed */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700">
                          {entry.field_changed}
                        </span>
                      </td>

                      {/* Old Value -> New Value */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">{entry.old_value}</span>
                          <svg
                            className="w-4 h-4 text-gray-300 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                          <span className="font-semibold text-gray-900 bg-amber-50 px-1.5 py-0.5 rounded">
                            {entry.new_value}
                          </span>
                        </div>
                      </td>

                      {/* IP / Device */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-xs text-gray-500">{entry.ip_address}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{entry.user_agent}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50/50">
          <div className="text-sm text-gray-500">
            Showing {startEntry} to {endEntry} of {filtered.length} entries
          </div>
          <div className="flex items-center gap-2">
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="px-2 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              {getPageNumbers().map((page, idx) =>
                page === '...' ? (
                  <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      safeCurrentPage === page
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="px-2 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Per page selector */}
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 pl-2 pr-7 rounded-md border border-gray-200 bg-white text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
