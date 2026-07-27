'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import StatusPill from '@/components/shared/StatusPill';
import Modal from '@/components/shared/Modal';
import { ActivityStatus } from '@/lib/types';
import {
  getActivitiesPage,
  getCriticalDelays,
  updateActivityWithAudit,
  bulkUpdateActivities,
  getPhotoCount,
  getAllFilteredActivities,
  getAdminEmails,
} from '@/lib/supabase-data';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const PER_PAGE = 25;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const STATUS_RANK: Record<string, number> = {
  not_started: 0,
  in_progress: 1,
  in_progress_delayed: 1,
  completed: 2,
  completed_delayed: 2,
  on_hold: -1,
};

function normalizeStatus(s: string): ActivityStatus {
  if (s === 'in_progress' || s === 'in_progress_delayed') return 'in_progress';
  if (s === 'completed' || s === 'completed_delayed') return 'completed';
  if (s === 'delayed') return 'delayed';
  if (s === 'on_hold') return 'on_hold';
  return 'not_started';
}

function formatDate(d: string): string {
  if (!d) return '';
  return d.slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EditingCell {
  rowId: string;
  field: 'status' | 'vendor' | 'expected_start' | 'expected_end';
}

interface ActivityTableProps {
  projectId: string;
  filters: { floor?: string; stage?: string; stageGate?: string; vendor?: string; status?: string };
  statusFilter: ActivityStatus | null;
  projectName: string;
}

export default function ActivityTable({ projectId, filters, statusFilter, projectName }: ActivityTableProps) {
  const [tableRows, setTableRows] = useState<Array<Record<string, unknown>>>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [criticalDelays, setCriticalDelays] = useState<Array<Record<string, unknown>>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Bulk action modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkExpStart, setBulkExpStart] = useState('');
  const [bulkExpEnd, setBulkExpEnd] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const activeFilters = useMemo(() => {
    const f: { floor?: string; stage?: string; stageGate?: string; vendor?: string; status?: string } = { ...filters };
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [filters, statusFilter]);

  // Reset state on project/filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
    setEditingCell(null);
  }, [projectId, activeFilters]);

  // Load table data
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function load() {
      setTableLoading(true);
      const [pageResult, delays] = await Promise.all([
        getActivitiesPage(projectId, activeFilters, currentPage, PER_PAGE),
        getCriticalDelays(projectId),
      ]);
      if (cancelled) return;
      setTableRows(pageResult.rows);
      setTableTotal(pageResult.totalCount);
      setCriticalDelays(delays);
      setTableLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, activeFilters, currentPage]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const totalPages = Math.max(1, Math.ceil(tableTotal / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  function toggleRow(id: string) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedRows.size === tableRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableRows.map(r => r.id as string)));
    }
  }

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  // Start inline edit
  function startEdit(rowId: string, field: EditingCell['field'], currentValue: string) {
    setEditingCell({ rowId, field });
    setEditValue(currentValue || '');
  }

  // Get current user ID
  async function getCurrentUserId(): Promise<string> {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || '';
  }

  // Check if status change is a reversal
  function isReversal(oldStatus: string, newStatus: string): boolean {
    const oldRank = STATUS_RANK[oldStatus] ?? 0;
    const newRank = STATUS_RANK[newStatus] ?? 0;
    if (oldRank === -1 || newRank === -1) return false;
    return oldRank > newRank;
  }

  // Send reversal notification email
  async function notifyReversal(row: Record<string, unknown>, oldStatus: string, newStatus: string) {
    try {
      const adminEmails = await getAdminEmails();
      if (adminEmails.length === 0) return;
      await fetch('/api/admin/notify-reversal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmails,
          projectName,
          floor: row.floor,
          flatNumber: row.flat_number,
          activity: row.activity,
          stage: row.stage,
          stageGate: row.stage_gate,
          oldStatus,
          newStatus,
        }),
      });
    } catch {
      // Email notification is best-effort
    }
  }

  // Save inline edit
  const saveEdit = useCallback(async (valueOverride?: string) => {
    if (!editingCell || saving) return;
    const row = tableRows.find(r => (r.id as string) === editingCell.rowId);
    if (!row) { setEditingCell(null); return; }

    const val = valueOverride !== undefined ? valueOverride : editValue;
    const field = editingCell.field;
    const oldValue = String(row[field] || '');
    if (val === oldValue) { setEditingCell(null); return; }

    setSaving(true);
    const userId = await getCurrentUserId();

    if (field === 'status') {
      const oldStatus = row.status as string;
      const newStatus = val;

      // Photo check for completion
      if (newStatus === 'completed') {
        const count = await getPhotoCount(row.id as string);
        if (count === 0) {
          setToast({ message: 'At least one photo is required before marking as completed.', type: 'error' });
          setSaving(false);
          setEditingCell(null);
          return;
        }
      }

      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'completed') {
        updates.actual_end = todayISO();
      }

      const result = await updateActivityWithAudit(row.id as string, updates, {
        projectId,
        changedBy: userId,
        oldStatus,
        newStatus,
        floor: row.floor as number,
        flatNumber: row.flat_number as number,
        stage: row.stage as string,
        stageGate: row.stage_gate as string,
        activityName: row.activity as string,
      });

      if (result.error) {
        setToast({ message: result.error, type: 'error' });
      } else {
        setTableRows(prev => prev.map(r =>
          (r.id as string) === editingCell.rowId
            ? { ...r, status: newStatus, ...(newStatus === 'completed' ? { actual_end: todayISO() } : {}) }
            : r
        ));
        setToast({ message: 'Status updated.', type: 'success' });

        if (isReversal(oldStatus, newStatus)) {
          notifyReversal(row, oldStatus, newStatus);
        }
      }
    } else {
      const updates: Record<string, unknown> = { [field]: val };
      const { error } = await supabase.from('activities').update(updates).eq('id', row.id as string);
      if (error) {
        setToast({ message: error.message, type: 'error' });
      } else {
        setTableRows(prev => prev.map(r =>
          (r.id as string) === editingCell.rowId ? { ...r, [field]: val } : r
        ));
        setToast({ message: 'Updated.', type: 'success' });
      }
    }

    setSaving(false);
    setEditingCell(null);
  }, [editingCell, editValue, saving, tableRows, projectId, projectName]);

  // Bulk: Reassign Vendor
  async function handleBulkVendor() {
    if (!bulkVendor.trim() || selectedRows.size === 0) return;
    setBulkSaving(true);
    const result = await bulkUpdateActivities([...selectedRows], { vendor: bulkVendor.trim() });
    if (result.error) {
      setToast({ message: result.error, type: 'error' });
    } else {
      setTableRows(prev => prev.map(r =>
        selectedRows.has(r.id as string) ? { ...r, vendor: bulkVendor.trim() } : r
      ));
      setToast({ message: `Vendor updated for ${selectedRows.size} activities.`, type: 'success' });
      setSelectedRows(new Set());
    }
    setBulkSaving(false);
    setShowVendorModal(false);
    setBulkVendor('');
  }

  // Bulk: Update Expected Dates
  async function handleBulkDates() {
    if (selectedRows.size === 0) return;
    const updates: Record<string, unknown> = {};
    if (bulkExpStart) updates.expected_start = bulkExpStart;
    if (bulkExpEnd) updates.expected_end = bulkExpEnd;
    if (Object.keys(updates).length === 0) return;

    setBulkSaving(true);
    const result = await bulkUpdateActivities([...selectedRows], updates);
    if (result.error) {
      setToast({ message: result.error, type: 'error' });
    } else {
      setTableRows(prev => prev.map(r =>
        selectedRows.has(r.id as string) ? { ...r, ...updates } : r
      ));
      setToast({ message: `Dates updated for ${selectedRows.size} activities.`, type: 'success' });
      setSelectedRows(new Set());
    }
    setBulkSaving(false);
    setShowDatesModal(false);
    setBulkExpStart('');
    setBulkExpEnd('');
  }

  // Export: Excel
  async function exportExcel() {
    setExporting(true);
    try {
      const rows = await getAllFilteredActivities(projectId, activeFilters);
      const wsData = [
        ['Floor', 'Flat No.', 'Config', 'Stage', 'Stage Gate', 'Activity', 'Vendor', 'Exp. Start', 'Exp. End', 'Act. Start', 'Act. End', 'Status', 'Delay Days', 'Delay Reason', 'Remarks'],
        ...rows.map(r => [
          r.floor, r.flat_number, r.configuration || '', r.stage, r.stage_gate || '', r.activity,
          r.vendor || '', formatDate(r.expected_start as string), formatDate(r.expected_end as string),
          formatDate(r.actual_start as string), formatDate(r.actual_end as string),
          r.status, r.delay_days || 0, r.delay_reason || '', r.remarks || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activities');
      XLSX.writeFile(wb, `${projectName}_Activities_${todayISO()}.xlsx`);
      setToast({ message: `Exported ${rows.length} activities to Excel.`, type: 'success' });
    } catch {
      setToast({ message: 'Export failed.', type: 'error' });
    }
    setExporting(false);
    setShowExportMenu(false);
  }

  // Export: PDF
  async function exportPDF() {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const rows = await getAllFilteredActivities(projectId, activeFilters);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(14);
      doc.text(`${projectName} — Activity Report`, 14, 15);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 21);

      autoTable(doc, {
        startY: 26,
        head: [['Floor', 'Flat', 'Stage', 'Stage Gate', 'Activity', 'Vendor', 'Exp Start', 'Exp End', 'Status', 'Delay']],
        body: rows.map(r => [
          String(r.floor ?? ''), String(r.flat_number ?? ''), String(r.stage ?? ''), String(r.stage_gate || ''), String(r.activity ?? ''),
          String(r.vendor || ''), formatDate(r.expected_start as string), formatDate(r.expected_end as string),
          String(r.status ?? ''), (r.delay_days as number) > 0 ? `${r.delay_days}d` : '',
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [230, 126, 34], fontSize: 7 },
      });

      doc.save(`${projectName}_Activities_${todayISO()}.pdf`);
      setToast({ message: `Exported ${rows.length} activities to PDF.`, type: 'success' });
    } catch {
      setToast({ message: 'PDF export failed.', type: 'error' });
    }
    setExporting(false);
    setShowExportMenu(false);
  }

  function handleBlur(e: React.FocusEvent) {
    const el = e.currentTarget;
    setTimeout(() => {
      if (document.activeElement !== el) saveEdit();
    }, 150);
  }

  // Render editable cell
  function renderEditableCell(row: Record<string, unknown>, field: EditingCell['field'], displayValue: string, className: string) {
    const rowId = row.id as string;
    const isEditing = editingCell?.rowId === rowId && editingCell?.field === field;

    if (isEditing) {
      if (field === 'status') {
        return (
          <select
            value={editValue}
            onChange={e => {
              const v = e.target.value;
              setEditValue(v);
              saveEdit(v);
            }}
            onBlur={handleBlur}
            autoFocus
            disabled={saving}
            className="w-full px-1.5 py-1 text-xs border border-primary rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }
      if (field === 'expected_start' || field === 'expected_end') {
        return (
          <input
            type="date"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => e.key === 'Enter' && saveEdit()}
            autoFocus
            disabled={saving}
            className="w-full px-1.5 py-1 text-xs border border-primary rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        );
      }
      // vendor
      return (
        <input
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => e.key === 'Enter' && saveEdit()}
          autoFocus
          disabled={saving}
          className="w-full px-1.5 py-1 text-xs border border-primary rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        />
      );
    }

    if (field === 'status') {
      return (
        <button onClick={() => startEdit(rowId, field, row.status as string)} className="cursor-pointer">
          <StatusPill status={normalizeStatus((row.status as string) || 'not_started')} />
        </button>
      );
    }

    return (
      <button
        onClick={() => startEdit(rowId, field, String(row[field] || ''))}
        className={`${className} cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors text-left w-full`}
        title="Click to edit"
      >
        {displayValue || '-'}
      </button>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-5">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedRows.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked readOnly className="accent-[#E67E22] w-4 h-4" />
              <span className="text-sm font-medium text-blue-800">{selectedRows.size} rows selected</span>
            </div>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600">Bulk Actions:</span>

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                )}
                Export
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {showExportMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 w-36">
                  <button onClick={exportExcel} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Excel (.xlsx)</button>
                  <button onClick={exportPDF} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">PDF (.pdf)</button>
                </div>
              )}
            </div>

            <button
              onClick={() => { setShowVendorModal(true); setBulkVendor(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
              Reassign Vendor
            </button>
            <button
              onClick={() => { setShowDatesModal(true); setBulkExpStart(''); setBulkExpEnd(''); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
              Update Expected Dates
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {tableLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-3 w-10">
                        <input type="checkbox" checked={selectedRows.size === tableRows.length && tableRows.length > 0} onChange={toggleAll} className="accent-[#E67E22] w-4 h-4" />
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Floor</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Flat No.</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Config</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Stage</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Stage Gate</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Activity</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Vendor <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Exp. Start <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Exp. End <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Act. Start</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Act. End</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Status <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tableRows.map(row => (
                      <tr key={row.id as string} className={`hover:bg-gray-50 transition-colors ${selectedRows.has(row.id as string) ? 'bg-orange-50/50' : ''}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selectedRows.has(row.id as string)} onChange={() => toggleRow(row.id as string)} className="accent-[#E67E22] w-4 h-4" />
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{row.floor as number}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-900">{row.flat_number as number}</td>
                        <td className="px-3 py-2.5 text-gray-600">{(row.configuration as string) || ''}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{row.stage as string}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[90px] truncate">{(row.stage_gate as string) || ''}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{row.activity as string}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[90px]">
                          {renderEditableCell(row, 'vendor', (row.vendor as string) || '', 'text-gray-600 truncate')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {renderEditableCell(row, 'expected_start', formatDate(row.expected_start as string), 'text-gray-500')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {renderEditableCell(row, 'expected_end', formatDate(row.expected_end as string), 'text-gray-500')}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{formatDate(row.actual_start as string) || '-'}</td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{formatDate(row.actual_end as string) || '-'}</td>
                        <td className="px-3 py-2.5">
                          {renderEditableCell(row, 'status', '', '')}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">
                          {(row.delay_days as number) > 0 ? `${row.delay_days}d` : (row.delay_reason as string) || '-'}
                        </td>
                      </tr>
                    ))}
                    {tableRows.length === 0 && !tableLoading && (
                      <tr>
                        <td colSpan={14} className="px-3 py-12 text-center text-sm text-gray-400">
                          No activities match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
                <span className="text-xs sm:text-sm text-gray-500">
                  Showing {tableTotal === 0 ? 0 : (safePage - 1) * PER_PAGE + 1}-{Math.min(safePage * PER_PAGE, tableTotal)} of {tableTotal.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&laquo;</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&lsaquo;</button>
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`d${i}`} className="px-2 py-1 text-xs text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-[28px] px-2 py-1 rounded text-xs font-medium ${safePage === p ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&rsaquo;</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40">&raquo;</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Critical Delays Panel */}
      <aside className="w-72 shrink-0 hidden xl:block">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Critical Delays</h3>
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mb-4">Top 5 overdue activities</p>

          {criticalDelays.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No delayed activities</p>
          ) : (
            <div className="space-y-3">
              {criticalDelays.map((d) => (
                <div key={d.id as string} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900">Flat {d.flat_number as number}</span>
                    <StatusPill status="delayed" />
                  </div>
                  <div className="text-xs text-gray-600 mb-0.5">{d.activity as string}</div>
                  <div className="text-[11px] text-gray-400">Floor {d.floor as number} &bull; {d.stage_gate as string}</div>
                  <div className="text-[11px] text-gray-400">Vendor: {d.vendor as string}</div>
                  <div className="text-xs font-semibold text-red-600 mt-1">Overdue by {d.delay_days as number} day{(d.delay_days as number) > 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Reassign Vendor Modal */}
      {showVendorModal && (
        <Modal open={showVendorModal} onClose={() => setShowVendorModal(false)} title="Reassign Vendor" maxWidth="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Update the vendor for <strong>{selectedRows.size}</strong> selected activities.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Vendor Name</label>
              <input
                type="text"
                value={bulkVendor}
                onChange={e => setBulkVendor(e.target.value)}
                placeholder="Enter vendor name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowVendorModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleBulkVendor}
                disabled={!bulkVendor.trim() || bulkSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {bulkSaving ? 'Updating...' : 'Reassign'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Update Expected Dates Modal */}
      {showDatesModal && (
        <Modal open={showDatesModal} onClose={() => setShowDatesModal(false)} title="Update Expected Dates" maxWidth="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Update expected dates for <strong>{selectedRows.size}</strong> selected activities. Leave a field blank to keep the existing date.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Start</label>
              <input
                type="date"
                value={bulkExpStart}
                onChange={e => setBulkExpStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected End</label>
              <input
                type="date"
                value={bulkExpEnd}
                onChange={e => setBulkExpEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDatesModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleBulkDates}
                disabled={(!bulkExpStart && !bulkExpEnd) || bulkSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {bulkSaving ? 'Updating...' : 'Update Dates'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
