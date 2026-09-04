'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import StatusPill from '@/components/shared/StatusPill';
import Modal from '@/components/shared/Modal';
import {
  getActivitiesPage,
} from '@/lib/supabase-data';
import type { ActivityRow, ActivityUpdate } from '@/types/database.types';
import type { ActivityStatus } from '@/lib/types';
import { ADMIN_STATUS_OPTIONS, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { normalizeToBaseStatus, formatDate, todayISO } from '@/lib/utils';
import { updateActivityStatus, updateActivityField, bulkUpdateField } from '@/services/activity-service';
import { exportToExcel, exportToPDF } from '@/services/export-service';
import { useToast } from '@/hooks/use-toast';
import { useCanAccess, useCanEdit, useRole } from '@/hooks';
import { useAuth } from '@/lib/auth-context';
import { getActivitiesDeleteInfo, deleteActivitiesFromDB } from '@/repositories/activity-repo';
import type { ActivityDeleteInfo } from '@/repositories/activity-repo';

interface EditingCell {
  rowId: string;
  field: 'status' | 'vendor' | 'expected_start' | 'expected_end' | 'revised_start' | 'revised_end';
}

interface DateEditTarget {
  row: ActivityRow;
  actualStart: string;
  actualEnd: string;
}

interface ActivityTableProps {
  projectId: string;
  filters: { floor?: string; flat?: string; stage?: string; stageGate?: string; vendor?: string; status?: string; search?: string };
  statusFilter: ActivityStatus | null;
  projectName: string;
  refugeFloors?: number[];
  refugeUnits?: number[];
  refreshKey?: number;
}

export default function ActivityTable({ projectId, filters, statusFilter, projectName, refugeFloors = [], refugeUnits = [], refreshKey = 0 }: ActivityTableProps) {
  const allowExport = useCanAccess('export-download');
  const allowEdit = useCanEdit('manage-projects');
  const [tableRows, setTableRows] = useState<ActivityRow[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();

  // Bulk action modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [bulkVendor, setBulkVendor] = useState('');
  const [bulkExpStart, setBulkExpStart] = useState('');
  const [bulkExpEnd, setBulkExpEnd] = useState('');
  const [bulkRevStart, setBulkRevStart] = useState('');
  const [bulkRevEnd, setBulkRevEnd] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dateEditTarget, setDateEditTarget] = useState<DateEditTarget | null>(null);
  const [dateEditSaving, setDateEditSaving] = useState(false);

  // Delete state
  const role = useRole();
  const { user } = useAuth();
  const isAdmin = role === 'admin';
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<ActivityDeleteInfo[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeFilters = useMemo(() => {
    const f: { floor?: string; flat?: string; stage?: string; stageGate?: string; vendor?: string; status?: string; search?: string } = { ...filters };
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [filters, statusFilter]);

  // Reset state on project/filter change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRows(new Set());
    setEditingCell(null);
  }, [projectId, activeFilters]);

  // Load table data (debounced 300ms on filter changes)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      async function load() {
        setTableLoading(true);
        const pageResult = await getActivitiesPage(projectId, activeFilters, currentPage, DEFAULT_PAGE_SIZE);
        if (cancelled) return;
        setTableRows(pageResult.rows);
        setTableTotal(pageResult.totalCount);
        setTableLoading(false);
      }
      load();
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectId, activeFilters, currentPage, refreshKey]);


  const totalPages = Math.max(1, Math.ceil(tableTotal / DEFAULT_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const refugeFloorSet = useMemo(() => new Set(refugeFloors), [refugeFloors]);
  const refugeUnitSet = useMemo(() => new Set(refugeUnits), [refugeUnits]);

  const toggleRow = useCallback((id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  function toggleAll() {
    if (selectedRows.size === tableRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableRows.map(r => r.id)));
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

  const startEdit = useCallback((rowId: string, field: EditingCell['field'], currentValue: string) => {
    if (!allowEdit) return;
    setEditingCell({ rowId, field });
    setEditValue(currentValue || '');
  }, []);

  // Get current user ID
  const saveEdit = useCallback(async (valueOverride?: string) => {
    if (!editingCell || saving) return;
    const row = tableRows.find(r => (r.id) === editingCell.rowId);
    if (!row) { setEditingCell(null); return; }

    const val = valueOverride !== undefined ? valueOverride : editValue;
    const field = editingCell.field;
    const oldValue = String(row[field] || '');
    if (val === oldValue) { setEditingCell(null); return; }

    setSaving(true);

    if (field === 'status') {
      const result = await updateActivityStatus(row, val, projectId, projectName);

      if (result.error) {
        showToast(result.error, 'error');
      } else {
        setTableRows(prev => prev.map(r =>
          (r.id) === editingCell.rowId
            ? { ...r, ...result.updates }
            : r
        ));
        showToast('Status updated.', 'success');
      }
    } else {
      const result = await updateActivityField(row.id, field, val);
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        setTableRows(prev => prev.map(r =>
          (r.id) === editingCell.rowId ? { ...r, [field]: val } : r
        ));
        showToast('Updated.', 'success');
      }
    }

    setSaving(false);
    setEditingCell(null);
  }, [editingCell, editValue, saving, tableRows, projectId, projectName]);

  async function handleBulkVendor() {
    if (!bulkVendor.trim() || selectedRows.size === 0) return;
    setBulkSaving(true);
    const result = await bulkUpdateField([...selectedRows], { vendor: bulkVendor.trim() });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      setTableRows(prev => prev.map(r =>
        selectedRows.has(r.id) ? { ...r, vendor: bulkVendor.trim() } : r
      ));
      showToast(`Vendor updated for ${selectedRows.size} activities.`, 'success');
      setSelectedRows(new Set());
    }
    setBulkSaving(false);
    setShowVendorModal(false);
    setBulkVendor('');
  }

  async function handleBulkDates() {
    if (selectedRows.size === 0) return;
    const updates: ActivityUpdate = {};
    if (bulkExpStart) updates.expected_start = bulkExpStart;
    if (bulkExpEnd) updates.expected_end = bulkExpEnd;
    if (bulkRevStart) updates.revised_start = bulkRevStart;
    if (bulkRevEnd) updates.revised_end = bulkRevEnd;
    if (Object.keys(updates).length === 0) return;

    setBulkSaving(true);
    const result = await bulkUpdateField([...selectedRows], updates);
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      setTableRows(prev => prev.map(r =>
        selectedRows.has(r.id) ? { ...r, ...updates } : r
      ));
      showToast(`Dates updated for ${selectedRows.size} activities.`, 'success');
      setSelectedRows(new Set());
    }
    setBulkSaving(false);
    setShowDatesModal(false);
    setBulkExpStart('');
    setBulkExpEnd('');
    setBulkRevStart('');
    setBulkRevEnd('');
  }

  async function handleDateEdit() {
    if (!dateEditTarget) return;
    const { row, actualStart, actualEnd } = dateEditTarget;
    const updates: ActivityUpdate = {};
    if (actualStart !== (row.actual_start || '')) updates.actual_start = actualStart || null;
    if (actualEnd !== (row.actual_end || '')) updates.actual_end = actualEnd || null;
    if (Object.keys(updates).length === 0) { setDateEditTarget(null); return; }

    setDateEditSaving(true);
    // Update each changed field
    let hasError = false;
    for (const [field, value] of Object.entries(updates)) {
      const result = await updateActivityField(row.id, field, value as string);
      if (result.error) { showToast(result.error, 'error'); hasError = true; break; }
    }
    if (!hasError) {
      setTableRows(prev => prev.map(r =>
        r.id === row.id ? { ...r, ...updates } : r
      ));
      showToast('Actual dates updated.', 'success');
    }
    setDateEditSaving(false);
    setDateEditTarget(null);
  }

  async function handleDeleteClick() {
    if (selectedRows.size === 0) return;
    setDeleteLoading(true);
    setShowDeleteModal(true);
    try {
      const info = await getActivitiesDeleteInfo([...selectedRows]);
      if (info.length === 0) {
        showToast('Activities not found — they may have been deleted already.', 'error');
        setShowDeleteModal(false);
        return;
      }
      setDeleteInfo(info);
    } catch {
      showToast('Failed to load activity details.', 'error');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!user || deleteInfo.length === 0) return;
    setDeleting(true);
    try {
      const result = await deleteActivitiesFromDB(
        deleteInfo.map(i => i.id),
        deleteInfo,
        user.id,
        projectId,
      );
      if (result.error) {
        showToast(`Delete failed: ${result.error}`, 'error');
      } else {
        setTableRows(prev => prev.filter(r => !selectedRows.has(r.id)));
        setTableTotal(prev => prev - result.deletedCount);
        showToast(`Deleted ${result.deletedCount} activities.`, 'success');
        setSelectedRows(new Set());
      }
    } catch {
      showToast('Delete failed — network error.', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeleteInfo([]);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const { count } = await exportToExcel(projectId, projectName, activeFilters);
      showToast(`Exported ${count} activities to Excel.`, 'success');
    } catch {
      showToast('Export failed.', 'error');
    }
    setExporting(false);
    setShowExportMenu(false);
  }

  async function exportPDF() {
    setExporting(true);
    try {
      const { count } = await exportToPDF(projectId, projectName, activeFilters);
      showToast(`Exported ${count} activities to PDF.`, 'success');
    } catch {
      showToast('PDF export failed.', 'error');
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
  function renderEditableCell(row: ActivityRow, field: EditingCell['field'], displayValue: string, className: string) {
    const rowId = row.id;
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
            {ADMIN_STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }
      if (field === 'expected_start' || field === 'expected_end' || field === 'revised_start' || field === 'revised_end') {
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
        <button onClick={() => startEdit(rowId, field, row.status || '')} className="cursor-pointer">
          <StatusPill status={normalizeToBaseStatus(row.status || 'not_started')} />
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
    <div className="space-y-5">
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
              <input type="checkbox" checked readOnly className="accent-[#C8922A] w-4 h-4" />
              <span className="text-sm font-medium text-blue-800">{selectedRows.size} rows selected</span>
            </div>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-600">Bulk Actions:</span>

            {allowExport && (
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
            )}

            {allowEdit && (
              <>
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
              </>
            )}

            {isAdmin && (
              <button
                onClick={handleDeleteClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 rounded-md text-sm text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                Delete
              </button>
            )}
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
                        <input type="checkbox" checked={selectedRows.size === tableRows.length && tableRows.length > 0} onChange={toggleAll} className="accent-[#C8922A] w-4 h-4" />
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
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Rev. Start <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Rev. End <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Act. Start <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Act. End <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">
                        <span className="flex items-center gap-1">Status <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg></span>
                      </th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tableRows.map(row => {
                      const isRefugeFloor = refugeFloorSet.has(row.floor);
                      const isRefugeUnit = refugeUnitSet.has(row.flat_number);
                      const isRefuge = isRefugeFloor || isRefugeUnit;
                      return (
                      <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${selectedRows.has(row.id) ? 'bg-orange-50/50' : isRefuge ? 'bg-amber-50/60' : ''}`}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selectedRows.has(row.id)} onChange={() => toggleRow(row.id)} className="accent-[#C8922A] w-4 h-4" />
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">
                          <span className="flex items-center gap-1.5">
                            {row.floor}
                            {isRefugeFloor && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200" title="Refuge Floor">
                                R
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900">
                          <span className="flex items-center gap-1.5">
                            {row.flat_number}
                            {isRefugeUnit && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200" title="Refuge Unit">
                                R
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{row.configuration || ''}</td>
                        <td className="px-3 py-2.5 text-gray-600">{row.stage}</td>
                        <td className="px-3 py-2.5 text-gray-600">{row.stage_gate || ''}</td>
                        <td className="px-3 py-2.5 text-gray-600">{row.activity}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[90px]">
                          {renderEditableCell(row, 'vendor', row.vendor || '', 'text-gray-600 truncate')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {renderEditableCell(row, 'expected_start', formatDate(row.expected_start), 'text-gray-500')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {renderEditableCell(row, 'expected_end', formatDate(row.expected_end), 'text-gray-500')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {renderEditableCell(row, 'revised_start', formatDate(row.revised_start), 'text-indigo-600')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          {renderEditableCell(row, 'revised_end', formatDate(row.revised_end), 'text-indigo-600')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          <button
                            onClick={() => setDateEditTarget({ row, actualStart: row.actual_start || '', actualEnd: row.actual_end || '' })}
                            className="text-gray-500 cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors text-left"
                            title="Click to edit actual dates"
                          >
                            {formatDate(row.actual_start) || '-'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                          <button
                            onClick={() => setDateEditTarget({ row, actualStart: row.actual_start || '', actualEnd: row.actual_end || '' })}
                            className="text-gray-500 cursor-pointer hover:bg-primary/5 rounded px-1 -mx-1 transition-colors text-left"
                            title="Click to edit actual dates"
                          >
                            {formatDate(row.actual_end) || '-'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          {renderEditableCell(row, 'status', '', '')}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">
                          {(row.delay_days ?? 0) > 0 ? `${row.delay_days}d` : row.delay_reason || '-'}
                        </td>
                      </tr>
                      );
                    })}
                    {tableRows.length === 0 && !tableLoading && (
                      <tr>
                        <td colSpan={16} className="px-3 py-12 text-center text-sm text-gray-400">
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
                  Showing {tableTotal === 0 ? 0 : (safePage - 1) * DEFAULT_PAGE_SIZE + 1}-{Math.min(safePage * DEFAULT_PAGE_SIZE, tableTotal)} of {tableTotal.toLocaleString()}
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

      {/* Edit Actual Dates Modal */}
      {dateEditTarget && (
        <Modal open={!!dateEditTarget} onClose={() => setDateEditTarget(null)} title="Edit Actual Dates" maxWidth="max-w-md">
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-bold text-gray-900">{dateEditTarget.row.activity}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Floor {dateEditTarget.row.floor} &bull; Flat {dateEditTarget.row.flat_number} &bull; {dateEditTarget.row.stage}
                {dateEditTarget.row.stage_gate ? ` → ${dateEditTarget.row.stage_gate}` : ''}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual Start</label>
                <input
                  type="date"
                  value={dateEditTarget.actualStart}
                  max={todayISO()}
                  onChange={e => setDateEditTarget({ ...dateEditTarget, actualStart: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual End</label>
                <input
                  type="date"
                  value={dateEditTarget.actualEnd}
                  min={dateEditTarget.actualStart || undefined}
                  max={todayISO()}
                  onChange={e => setDateEditTarget({ ...dateEditTarget, actualEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDateEditTarget(null)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleDateEdit}
                disabled={dateEditSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {dateEditSaving ? 'Saving...' : 'Save Dates'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Update Expected Dates Modal */}
      {showDatesModal && (
        <Modal open={showDatesModal} onClose={() => setShowDatesModal(false)} title="Update Dates" maxWidth="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Update dates for <strong>{selectedRows.size}</strong> selected activities. Leave a field blank to keep the existing date.
            </p>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Revised Start</label>
                <input
                  type="date"
                  value={bulkRevStart}
                  onChange={e => setBulkRevStart(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Revised End</label>
                <input
                  type="date"
                  value={bulkRevEnd}
                  onChange={e => setBulkRevEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDatesModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleBulkDates}
                disabled={(!bulkExpStart && !bulkExpEnd && !bulkRevStart && !bulkRevEnd) || bulkSaving}
                className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
              >
                {bulkSaving ? 'Updating...' : 'Update Dates'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal open={showDeleteModal} onClose={() => { if (!deleting) { setShowDeleteModal(false); setDeleteInfo([]); } }} title="Delete Activities" maxWidth="max-w-md">
          {deleteLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Checking activity data...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-red-800 font-medium">
                  This will permanently delete <strong>{deleteInfo.length}</strong> {deleteInfo.length === 1 ? 'activity' : 'activities'}. This action cannot be undone.
                </p>
              </div>

              {/* Warnings */}
              {(() => {
                const withPhotos = deleteInfo.filter(i => i.photoCount > 0);
                const withStatus = deleteInfo.filter(i => i.status !== 'not_started');
                const totalPhotos = withPhotos.reduce((sum, i) => sum + i.photoCount, 0);
                return (
                  <>
                    {withPhotos.length > 0 && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                        <span className="text-xs text-amber-800">
                          <strong>{totalPhotos}</strong> {totalPhotos === 1 ? 'photo' : 'photos'} attached across <strong>{withPhotos.length}</strong> {withPhotos.length === 1 ? 'activity' : 'activities'} will also be deleted.
                        </span>
                      </div>
                    )}
                    {withStatus.length > 0 && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                        </svg>
                        <span className="text-xs text-amber-800">
                          <strong>{withStatus.length}</strong> {withStatus.length === 1 ? 'activity has' : 'activities have'} status updates that will be lost.
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Activity summary */}
              <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Floor</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Flat</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Activity</th>
                      <th className="text-left px-2 py-1.5 font-medium text-gray-600">Status</th>
                      <th className="text-center px-2 py-1.5 font-medium text-gray-600">📷</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deleteInfo.map(info => (
                      <tr key={info.id}>
                        <td className="px-2 py-1.5 text-gray-700">{info.floor}</td>
                        <td className="px-2 py-1.5 text-gray-700">{info.flat_number}</td>
                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-[120px]">{info.activity}</td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            info.status === 'completed' ? 'bg-green-100 text-green-700'
                            : info.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                            : info.status === 'on_hold' ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {info.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center text-gray-500">{info.photoCount || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteInfo([]); }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Permanently'
                  )}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
