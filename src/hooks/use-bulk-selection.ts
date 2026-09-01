'use client';

import { useState, useMemo, useCallback } from 'react';

export interface BulkSelectionState {
  bulkMode: boolean;
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
}

export interface BulkSelectionActions {
  setBulkMode: (v: boolean) => void;
  toggleSelection: (id: string) => void;
  handleSelectAll: () => void;
  clearSelection: () => void;
  resetBulk: () => void;
}

/**
 * Manages bulk-selection state for the supervisor home page.
 * @param selectableIds – the currently visible, non-completed activity IDs
 */
export function useBulkSelection(selectableIds: string[]): BulkSelectionState & BulkSelectionActions {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
  const someSelected = selectableIds.some(id => selectedIds.has(id));

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }, [selectableIds, selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const resetBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  return {
    bulkMode, setBulkMode,
    selectedIds,
    allSelected, someSelected,
    toggleSelection, handleSelectAll, clearSelection, resetBulk,
  };
}
