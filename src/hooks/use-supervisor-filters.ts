'use client';

import { useState, useCallback } from 'react';

export interface SupervisorFilterState {
  stageFilter: string;
  subStageFilter: string;
  activityFilter: string;
  statusDropdown: string;
  statusFilter: string | null;
  search: string;
  showFilters: boolean;
}

export interface SupervisorFilterActions {
  setStageFilter: (v: string) => void;
  setSubStageFilter: (v: string) => void;
  setActivityFilter: (v: string) => void;
  setStatusDropdown: (v: string) => void;
  setStatusFilter: (v: string | null) => void;
  setSearch: (v: string) => void;
  setShowFilters: (v: boolean | ((prev: boolean) => boolean)) => void;
  clearFilters: () => void;
  hasFilters: boolean;
}

/**
 * Manages all filter-related state for the supervisor home page.
 * Groups 7 useState hooks + clear function into a single hook.
 */
export function useSupervisorFilters(): SupervisorFilterState & SupervisorFilterActions {
  const [stageFilter, setStageFilter] = useState('');
  const [subStageFilter, setSubStageFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [statusDropdown, setStatusDropdown] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const hasFilters = !!(stageFilter || subStageFilter || activityFilter || statusDropdown || statusFilter);

  const clearFilters = useCallback(() => {
    setStageFilter('');
    setSubStageFilter('');
    setActivityFilter('');
    setStatusDropdown('');
    setStatusFilter(null);
    setSearch('');
  }, []);

  return {
    stageFilter, setStageFilter,
    subStageFilter, setSubStageFilter,
    activityFilter, setActivityFilter,
    statusDropdown, setStatusDropdown,
    statusFilter, setStatusFilter,
    search, setSearch,
    showFilters, setShowFilters,
    clearFilters,
    hasFilters,
  };
}
