'use client';

import { useState, useMemo, useEffect } from 'react';
import type { UploadedActivity } from '@/lib/project-data-store';
import { bulkAssignVendorByFilter } from '@/lib/supabase-data';
import { getVendorMappings, setVendorMappings, type VendorMapping } from '@/repositories/settings-repo';

interface VendorCombo {
  stage: string;
  activity: string;
  count: number;
  withVendor: number;
  currentVendor: string; // most common existing vendor
}

interface StageGroup {
  stage: string;
  combos: VendorCombo[];
  totalCount: number;
}

interface BulkVendorAssignProps {
  activities: UploadedActivity[];
  projectId: string;
  existingVendors: string[];
  floors: number[];
  onClose: () => void;
  onComplete: () => void;
}

export default function BulkVendorAssign({
  activities,
  projectId,
  existingVendors,
  floors,
  onClose,
  onComplete,
}: BulkVendorAssignProps) {
  const [floorFrom, setFloorFrom] = useState<number | ''>('');
  const [floorTo, setFloorTo] = useState<number | ''>('');
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [vendorInputs, setVendorInputs] = useState<Record<string, string>>({});
  const [saveDefault, setSaveDefault] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingSaved, setLoadingSaved] = useState(true);

  const minFloor = floors.length > 0 ? floors[0] : 0;
  const maxFloor = floors.length > 0 ? floors[floors.length - 1] : 0;

  // Load saved default mappings on mount
  useEffect(() => {
    getVendorMappings(projectId).then(saved => {
      if (saved.length > 0) {
        const map: Record<string, string> = {};
        for (const m of saved) {
          map[`${m.stage}|${m.activity}`] = m.vendor;
        }
        setVendorInputs(map);
        setSaveDefault(true); // if they already have saved mappings, keep the checkbox on
      }
      setLoadingSaved(false);
    }).catch(() => setLoadingSaved(false));
  }, [projectId]);

  // Compute stage × activity combos from loaded data
  const stageGroups = useMemo(() => {
    const map = new Map<string, { stage: string; activity: string; count: number; withVendor: number; vendorCounts: Map<string, number> }>();

    for (const a of activities) {
      if (floorFrom !== '' && a.floor < floorFrom) continue;
      if (floorTo !== '' && a.floor > floorTo) continue;

      const key = `${a.stage}|${a.activity}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (a.vendor) existing.withVendor++;
        const v = a.vendor || '';
        existing.vendorCounts.set(v, (existing.vendorCounts.get(v) || 0) + 1);
      } else {
        const vendorCounts = new Map<string, number>();
        vendorCounts.set(a.vendor || '', 1);
        map.set(key, {
          stage: a.stage,
          activity: a.activity,
          count: 1,
          withVendor: a.vendor ? 1 : 0,
          vendorCounts,
        });
      }
    }

    // Convert to combos with most common vendor
    const combos: VendorCombo[] = [...map.values()].map(({ stage, activity, count, withVendor, vendorCounts }) => {
      let mostCommon = '';
      let maxCount = 0;
      for (const [v, c] of vendorCounts) {
        if (v && c > maxCount) { mostCommon = v; maxCount = c; }
      }
      return { stage, activity, count, withVendor, currentVendor: mostCommon };
    });

    // Group by stage
    const groupMap = new Map<string, VendorCombo[]>();
    for (const c of combos) {
      const arr = groupMap.get(c.stage) || [];
      arr.push(c);
      groupMap.set(c.stage, arr);
    }

    const groups: StageGroup[] = [...groupMap.entries()].map(([stage, cmbs]) => ({
      stage,
      combos: cmbs.sort((a, b) => a.activity.localeCompare(b.activity)),
      totalCount: cmbs.reduce((sum, c) => sum + c.count, 0),
    }));

    return groups;
  }, [activities, floorFrom, floorTo]);

  // All vendors for autocomplete (existing + from saved mappings)
  const allVendors = useMemo(() => {
    const set = new Set(existingVendors);
    for (const v of Object.values(vendorInputs)) {
      if (v.trim()) set.add(v.trim());
    }
    return [...set].sort();
  }, [existingVendors, vendorInputs]);

  // Count how many assignments are pending
  const pendingAssignments = useMemo(() => {
    let combos = 0;
    let rows = 0;
    for (const group of stageGroups) {
      for (const c of group.combos) {
        const key = `${c.stage}|${c.activity}`;
        const vendor = vendorInputs[key]?.trim();
        if (vendor) {
          combos++;
          rows += onlyEmpty ? (c.count - c.withVendor) : c.count;
        }
      }
    }
    return { combos, rows };
  }, [stageGroups, vendorInputs, onlyEmpty]);

  function updateVendor(stage: string, activity: string, vendor: string) {
    setVendorInputs(prev => ({ ...prev, [`${stage}|${activity}`]: vendor }));
  }

  // Apply a vendor to all activities in a stage
  function applyToStage(stage: string, vendor: string) {
    setVendorInputs(prev => {
      const next = { ...prev };
      for (const group of stageGroups) {
        if (group.stage === stage) {
          for (const c of group.combos) {
            next[`${c.stage}|${c.activity}`] = vendor;
          }
        }
      }
      return next;
    });
  }

  async function handleApply() {
    // Build assignments from non-empty vendor inputs
    const assignments: Array<{ stage: string; activity: string; vendor: string }> = [];
    for (const group of stageGroups) {
      for (const c of group.combos) {
        const key = `${c.stage}|${c.activity}`;
        const vendor = vendorInputs[key]?.trim();
        if (vendor) {
          assignments.push({ stage: c.stage, activity: c.activity, vendor });
        }
      }
    }

    if (assignments.length === 0) {
      setResult({ success: false, message: 'No vendor assignments to apply. Type a vendor name next to at least one activity.' });
      return;
    }

    const rowWord = pendingAssignments.rows === 1 ? 'activity' : 'activities';
    const msg = `Assign vendors to ${pendingAssignments.rows.toLocaleString()} ${rowWord} across ${assignments.length} activity types?${onlyEmpty ? '\n\nOnly activities without a vendor will be updated.' : ''}`;
    if (!confirm(msg)) return;

    setApplying(true);
    setResult(null);

    try {
      const { errors } = await bulkAssignVendorByFilter(
        projectId,
        assignments,
        {
          floorFrom: floorFrom !== '' ? floorFrom : undefined,
          floorTo: floorTo !== '' ? floorTo : undefined,
          onlyEmpty,
        },
      );

      // Save as default mapping if checked
      if (saveDefault) {
        const mappings: VendorMapping[] = assignments.map(a => ({
          stage: a.stage,
          activity: a.activity,
          vendor: a.vendor,
        }));
        await setVendorMappings(projectId, mappings);
      }

      if (errors.length > 0) {
        setResult({ success: false, message: `Partial success. ${errors.length} errors:\n${errors.join('\n')}` });
      } else {
        setResult({ success: true, message: `Successfully assigned ${assignments.length} vendors to ${pendingAssignments.rows.toLocaleString()} activities.${saveDefault ? ' Default mapping saved.' : ''}` });
        // Auto-close after short delay and refresh data
        setTimeout(() => {
          onComplete();
          onClose();
        }, 1500);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setResult({ success: false, message: e?.message || 'Failed to assign vendors' });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              Bulk Assign Vendors
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Assign vendors to multiple activities at once. Changes apply immediately.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Floor Range (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={floorFrom}
                  onChange={e => setFloorFrom(e.target.value ? Number(e.target.value) : '')}
                  placeholder={String(minFloor)}
                  min={minFloor}
                  max={maxFloor}
                  className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="number"
                  value={floorTo}
                  onChange={e => setFloorTo(e.target.value ? Number(e.target.value) : '')}
                  placeholder={String(maxFloor)}
                  min={minFloor}
                  max={maxFloor}
                  className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyEmpty}
                onChange={e => setOnlyEmpty(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary/30 accent-[#C8922A]"
              />
              <span className="text-sm text-gray-700">Only assign where vendor is empty</span>
            </label>
          </div>
        </div>

        {/* Combos Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingSaved ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-2 text-sm text-gray-500">Loading saved mappings...</span>
            </div>
          ) : stageGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No activities found{floorFrom !== '' || floorTo !== '' ? ' in the specified floor range' : ''}.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {stageGroups.map(group => (
                <div key={group.stage} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Stage header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{group.stage}</span>
                      <span className="text-xs text-gray-400">{group.combos.length} activities · {group.totalCount.toLocaleString()} rows</span>
                    </div>
                    {/* Quick-apply vendor to entire stage */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Apply to all..."
                        list="vendor-autocomplete"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                            applyToStage(group.stage, (e.target as HTMLInputElement).value.trim());
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-36 px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 placeholder:text-gray-300 focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Activity rows */}
                  <div className="divide-y divide-gray-100">
                    {group.combos.map(combo => {
                      const key = `${combo.stage}|${combo.activity}`;
                      const inputValue = vendorInputs[key] || '';
                      const hasExisting = combo.withVendor > 0;

                      return (
                        <div key={key} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800 font-medium truncate block">{combo.activity}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{combo.count.toLocaleString()} rows</span>
                              {hasExisting && (
                                <span className="text-xs text-gray-400">
                                  · {combo.withVendor} have vendor
                                  {combo.currentVendor && (
                                    <span className="text-gray-500"> ({combo.currentVendor})</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={inputValue}
                            onChange={e => updateVendor(combo.stage, combo.activity, e.target.value)}
                            placeholder={combo.currentVendor || 'Vendor name'}
                            list="vendor-autocomplete"
                            className={`w-48 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary ${
                              inputValue.trim() ? 'border-primary/40 bg-orange-50/30' : 'border-gray-200'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Autocomplete datalist */}
          <datalist id="vendor-autocomplete">
            {allVendors.map(v => <option key={v} value={v} />)}
          </datalist>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
          {result && (
            <div className={`mb-3 px-4 py-2.5 rounded-lg text-sm ${
              result.success
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {result.message}
            </div>
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveDefault}
                onChange={e => setSaveDefault(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary/30 accent-[#C8922A]"
              />
              <span className="text-sm text-gray-600">Save as default mapping</span>
              <span className="text-xs text-gray-400" title="Saved mappings auto-apply on future uploads">ⓘ</span>
            </label>
            <div className="flex items-center gap-3">
              {pendingAssignments.combos > 0 && (
                <span className="text-xs text-gray-500">
                  {pendingAssignments.combos} vendors → {pendingAssignments.rows.toLocaleString()} activities
                </span>
              )}
              <button
                onClick={onClose}
                disabled={applying}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applying || pendingAssignments.combos === 0}
                className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {applying ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Applying...
                  </>
                ) : (
                  `Apply${pendingAssignments.combos > 0 ? ` (${pendingAssignments.combos})` : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
