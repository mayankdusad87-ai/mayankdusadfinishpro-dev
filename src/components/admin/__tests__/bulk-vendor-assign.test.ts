/**
 * Bulk Vendor Assignment — functional, positive, negative & stress tests
 *
 * Tests the pure computation logic extracted from BulkVendorAssign.tsx:
 *  - computeStageGroups: groups activities into stage × activity combos
 *  - computePendingAssignments: counts affected combos/rows from inputs
 *  - buildAssignments: produces the assignment payload for the API
 *  - mergeAutocompleteVendors: merges existing + typed vendors
 *
 * All functions are replicated here (they're pure with no React deps).
 */

// ---- Types (mirrored from BulkVendorAssign) ----

interface Activity {
  floor: number;
  flat_number: number;
  stage: string;
  stage_gate: string;
  activity: string;
  vendor: string;
  status: string;
}

interface VendorCombo {
  stage: string;
  activity: string;
  count: number;
  withVendor: number;
  currentVendor: string;
}

interface StageGroup {
  stage: string;
  combos: VendorCombo[];
  totalCount: number;
}

// ---- Pure functions (extracted from BulkVendorAssign.tsx useMemo hooks) ----

function computeStageGroups(
  activities: Activity[],
  floorFrom?: number,
  floorTo?: number,
): StageGroup[] {
  const map = new Map<
    string,
    {
      stage: string;
      activity: string;
      count: number;
      withVendor: number;
      vendorCounts: Map<string, number>;
    }
  >();

  for (const a of activities) {
    if (floorFrom !== undefined && a.floor < floorFrom) continue;
    if (floorTo !== undefined && a.floor > floorTo) continue;

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

  const combos: VendorCombo[] = [...map.values()].map(
    ({ stage, activity, count, withVendor, vendorCounts }) => {
      let mostCommon = '';
      let maxCount = 0;
      for (const [v, c] of vendorCounts) {
        if (v && c > maxCount) {
          mostCommon = v;
          maxCount = c;
        }
      }
      return { stage, activity, count, withVendor, currentVendor: mostCommon };
    },
  );

  const groupMap = new Map<string, VendorCombo[]>();
  for (const c of combos) {
    const arr = groupMap.get(c.stage) || [];
    arr.push(c);
    groupMap.set(c.stage, arr);
  }

  return [...groupMap.entries()].map(([stage, cmbs]) => ({
    stage,
    combos: cmbs.sort((a, b) => a.activity.localeCompare(b.activity)),
    totalCount: cmbs.reduce((sum, c) => sum + c.count, 0),
  }));
}

function computePendingAssignments(
  stageGroups: StageGroup[],
  vendorInputs: Record<string, string>,
  onlyEmpty: boolean,
): { combos: number; rows: number } {
  let combos = 0;
  let rows = 0;
  for (const group of stageGroups) {
    for (const c of group.combos) {
      const key = `${c.stage}|${c.activity}`;
      const vendor = vendorInputs[key]?.trim();
      if (vendor) {
        combos++;
        rows += onlyEmpty ? c.count - c.withVendor : c.count;
      }
    }
  }
  return { combos, rows };
}

function buildAssignments(
  stageGroups: StageGroup[],
  vendorInputs: Record<string, string>,
): Array<{ stage: string; activity: string; vendor: string }> {
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
  return assignments;
}

function mergeAutocompleteVendors(
  existingVendors: string[],
  vendorInputs: Record<string, string>,
): string[] {
  const set = new Set(existingVendors);
  for (const v of Object.values(vendorInputs)) {
    if (v.trim()) set.add(v.trim());
  }
  return [...set].sort();
}

// ---- Helpers to build test data ----

function makeActivity(
  overrides: Partial<Activity> = {},
): Activity {
  return {
    floor: 1,
    flat_number: 101,
    stage: 'Tiling',
    stage_gate: 'SG1',
    activity: 'Floor Tiling',
    vendor: '',
    status: 'not_started',
    ...overrides,
  };
}

/** Generate N activities across multiple floors, stages, activities */
function generateActivities(
  count: number,
  opts: {
    stages?: string[];
    activitiesPerStage?: string[];
    flatsPerFloor?: number;
    startFloor?: number;
    vendorFn?: (i: number) => string;
  } = {},
): Activity[] {
  const stages = opts.stages || ['Pre-Tiling', 'Tiling', 'Post Tiling'];
  const actPerStage = opts.activitiesPerStage || ['Activity A', 'Activity B'];
  const flatsPerFloor = opts.flatsPerFloor || 4;
  const startFloor = opts.startFloor || 1;
  const vendorFn = opts.vendorFn || (() => '');

  const activities: Activity[] = [];
  let i = 0;

  while (activities.length < count) {
    for (const stage of stages) {
      for (const act of actPerStage) {
        const floor = startFloor + Math.floor(i / flatsPerFloor);
        const flat = (floor * 100) + (i % flatsPerFloor) + 1;
        activities.push(
          makeActivity({
            floor,
            flat_number: flat,
            stage,
            activity: act,
            vendor: vendorFn(i),
          }),
        );
        i++;
        if (activities.length >= count) return activities;
      }
    }
  }
  return activities;
}

// =====================================================================
// TESTS
// =====================================================================

describe('Bulk Vendor Assignment', () => {
  // ------------------------------------------------------------------
  // 1. FUNCTIONAL TESTS — core logic correctness
  // ------------------------------------------------------------------
  describe('Functional: computeStageGroups', () => {
    test('groups activities by stage and activity', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ stage: 'Tiling', activity: 'Wall Tiling' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ stage: 'Pre-Tiling', activity: 'Waterproofing' }),
      ];
      const groups = computeStageGroups(activities);

      expect(groups.length).toBe(2);

      const tiling = groups.find(g => g.stage === 'Tiling')!;
      expect(tiling.combos.length).toBe(2);
      expect(tiling.totalCount).toBe(3);

      const preTiling = groups.find(g => g.stage === 'Pre-Tiling')!;
      expect(preTiling.combos.length).toBe(1);
      expect(preTiling.totalCount).toBe(1);
    });

    test('counts rows per combo correctly', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', floor: 1, flat_number: 101 }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', floor: 1, flat_number: 102 }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', floor: 2, flat_number: 201 }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', floor: 2, flat_number: 202 }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', floor: 3, flat_number: 301 }),
      ];
      const groups = computeStageGroups(activities);

      expect(groups.length).toBe(1);
      expect(groups[0].combos[0].count).toBe(5);
    });

    test('tracks withVendor count — distinguishes assigned vs unassigned', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
      ];
      const groups = computeStageGroups(activities);
      const combo = groups[0].combos[0];

      expect(combo.count).toBe(5);
      expect(combo.withVendor).toBe(2);
    });

    test('finds most common vendor per combo', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Gupta' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
      ];
      const groups = computeStageGroups(activities);

      expect(groups[0].combos[0].currentVendor).toBe('Sharma');
    });

    test('most common vendor ignores empty strings', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Gupta' }),
      ];
      const groups = computeStageGroups(activities);
      // Even though '' has 3 occurrences and 'Gupta' has 1, most common non-empty is 'Gupta'
      expect(groups[0].combos[0].currentVendor).toBe('Gupta');
    });

    test('sorts combos alphabetically within each stage group', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Zirconia Tiling' }),
        makeActivity({ stage: 'Tiling', activity: 'Anti-skid Treatment' }),
        makeActivity({ stage: 'Tiling', activity: 'Marble Cladding' }),
      ];
      const groups = computeStageGroups(activities);
      const names = groups[0].combos.map(c => c.activity);

      expect(names).toEqual(['Anti-skid Treatment', 'Marble Cladding', 'Zirconia Tiling']);
    });

    test('applies floor range filter — floorFrom only', () => {
      const activities = [
        makeActivity({ floor: 1, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 2, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 3, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 4, stage: 'Tiling', activity: 'Floor Tiling' }),
      ];
      const groups = computeStageGroups(activities, 3);

      expect(groups[0].totalCount).toBe(2); // floors 3 and 4
    });

    test('applies floor range filter — floorTo only', () => {
      const activities = [
        makeActivity({ floor: 1, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 2, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 3, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 4, stage: 'Tiling', activity: 'Floor Tiling' }),
      ];
      const groups = computeStageGroups(activities, undefined, 2);

      expect(groups[0].totalCount).toBe(2); // floors 1 and 2
    });

    test('applies floor range filter — both from and to', () => {
      const activities = [
        makeActivity({ floor: 1, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 5, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 10, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 15, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 20, stage: 'Tiling', activity: 'Floor Tiling' }),
      ];
      const groups = computeStageGroups(activities, 5, 15);

      expect(groups[0].totalCount).toBe(3); // floors 5, 10, 15
    });

    test('floor range can exclude all activities', () => {
      const activities = [
        makeActivity({ floor: 1 }),
        makeActivity({ floor: 2 }),
        makeActivity({ floor: 3 }),
      ];
      const groups = computeStageGroups(activities, 10, 20);

      expect(groups.length).toBe(0);
    });

    test('floor range with same from and to selects exactly that floor', () => {
      const activities = [
        makeActivity({ floor: 5, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 5, stage: 'Tiling', activity: 'Floor Tiling' }),
        makeActivity({ floor: 6, stage: 'Tiling', activity: 'Floor Tiling' }),
      ];
      const groups = computeStageGroups(activities, 5, 5);

      expect(groups[0].totalCount).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // 2. FUNCTIONAL: computePendingAssignments
  // ------------------------------------------------------------------
  describe('Functional: computePendingAssignments', () => {
    test('counts combos and rows from vendor inputs', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 0, currentVendor: '' },
            { stage: 'Tiling', activity: 'Wall Tiling', count: 80, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 180,
        },
      ];
      const inputs = { 'Tiling|Floor Tiling': 'Sharma', 'Tiling|Wall Tiling': 'Gupta' };
      const result = computePendingAssignments(groups, inputs, false);

      expect(result.combos).toBe(2);
      expect(result.rows).toBe(180);
    });

    test('only counts combos with non-empty vendor input', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 0, currentVendor: '' },
            { stage: 'Tiling', activity: 'Wall Tiling', count: 80, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 180,
        },
      ];
      const inputs = { 'Tiling|Floor Tiling': 'Sharma' }; // only one filled

      const result = computePendingAssignments(groups, inputs, false);
      expect(result.combos).toBe(1);
      expect(result.rows).toBe(100);
    });

    test('onlyEmpty subtracts withVendor from total count', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 60, currentVendor: 'Sharma' },
          ],
          totalCount: 100,
        },
      ];
      const inputs = { 'Tiling|Floor Tiling': 'NewVendor' };

      // Without onlyEmpty → all 100 rows
      expect(computePendingAssignments(groups, inputs, false).rows).toBe(100);
      // With onlyEmpty → only 40 rows (100 - 60)
      expect(computePendingAssignments(groups, inputs, true).rows).toBe(40);
    });

    test('trims whitespace from vendor inputs', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 50, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 50,
        },
      ];

      // Whitespace-only should NOT count
      expect(computePendingAssignments(groups, { 'Tiling|Floor Tiling': '   ' }, false).combos).toBe(0);
      // Whitespace-padded should count
      expect(computePendingAssignments(groups, { 'Tiling|Floor Tiling': '  Sharma  ' }, false).combos).toBe(1);
    });

    test('handles multiple stages correctly', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Pre-Tiling',
          combos: [
            { stage: 'Pre-Tiling', activity: 'Waterproofing', count: 50, withVendor: 10, currentVendor: '' },
          ],
          totalCount: 50,
        },
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 30, currentVendor: '' },
            { stage: 'Tiling', activity: 'Wall Tiling', count: 80, withVendor: 20, currentVendor: '' },
          ],
          totalCount: 180,
        },
      ];
      const inputs = {
        'Pre-Tiling|Waterproofing': 'ABC',
        'Tiling|Floor Tiling': 'Sharma',
        // Wall Tiling left empty
      };

      const all = computePendingAssignments(groups, inputs, false);
      expect(all.combos).toBe(2);
      expect(all.rows).toBe(150); // 50 + 100

      const emptyOnly = computePendingAssignments(groups, inputs, true);
      expect(emptyOnly.combos).toBe(2);
      expect(emptyOnly.rows).toBe(110); // (50-10) + (100-30)
    });
  });

  // ------------------------------------------------------------------
  // 3. FUNCTIONAL: buildAssignments
  // ------------------------------------------------------------------
  describe('Functional: buildAssignments', () => {
    test('builds correct assignment array from inputs', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 0, currentVendor: '' },
            { stage: 'Tiling', activity: 'Wall Tiling', count: 80, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 180,
        },
      ];
      const inputs = {
        'Tiling|Floor Tiling': '  Sharma Plumbing  ',
        'Tiling|Wall Tiling': 'Gupta Tiles',
      };

      const result = buildAssignments(groups, inputs);
      expect(result).toEqual([
        { stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma Plumbing' },
        { stage: 'Tiling', activity: 'Wall Tiling', vendor: 'Gupta Tiles' },
      ]);
    });

    test('skips entries with empty or whitespace vendor', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 0, currentVendor: '' },
            { stage: 'Tiling', activity: 'Wall Tiling', count: 80, withVendor: 0, currentVendor: '' },
            { stage: 'Tiling', activity: 'Counter', count: 60, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 240,
        },
      ];
      const inputs = {
        'Tiling|Floor Tiling': 'Sharma',
        'Tiling|Wall Tiling': '',
        'Tiling|Counter': '   ',
      };

      const result = buildAssignments(groups, inputs);
      expect(result.length).toBe(1);
      expect(result[0].vendor).toBe('Sharma');
    });

    test('preserves exact vendor names including casing', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'A', count: 1, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 1,
        },
      ];

      const result = buildAssignments(groups, { 'Tiling|A': 'Sharma & Sons Pvt. Ltd.' });
      expect(result[0].vendor).toBe('Sharma & Sons Pvt. Ltd.');
    });
  });

  // ------------------------------------------------------------------
  // 4. FUNCTIONAL: mergeAutocompleteVendors
  // ------------------------------------------------------------------
  describe('Functional: mergeAutocompleteVendors', () => {
    test('merges existing and typed vendors, sorted', () => {
      const result = mergeAutocompleteVendors(
        ['Sharma', 'Gupta'],
        { 'Tiling|Floor Tiling': 'Yadav', 'Tiling|Wall Tiling': 'Sharma' },
      );
      expect(result).toEqual(['Gupta', 'Sharma', 'Yadav']);
    });

    test('deduplicates vendor names', () => {
      const result = mergeAutocompleteVendors(
        ['Sharma', 'Gupta', 'Sharma'],
        { a: 'Gupta', b: 'Sharma' },
      );
      expect(result).toEqual(['Gupta', 'Sharma']);
    });

    test('ignores empty and whitespace vendor inputs', () => {
      const result = mergeAutocompleteVendors(
        ['Sharma'],
        { a: '', b: '   ', c: 'Gupta' },
      );
      expect(result).toEqual(['Gupta', 'Sharma']);
    });

    test('returns empty for no vendors', () => {
      expect(mergeAutocompleteVendors([], {})).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // 5. POSITIVE TESTS — happy-path scenarios
  // ------------------------------------------------------------------
  describe('Positive: real-world scenarios', () => {
    test('typical project: 5 stages, 3 activities each', () => {
      const stages = ['Pre-Tiling', 'Tiling', 'Post Tiling', 'Pre Paint', '1st Coat Paint'];
      const acts = ['Activity A', 'Activity B', 'Activity C'];
      const activities = generateActivities(750, {
        stages,
        activitiesPerStage: acts,
        flatsPerFloor: 7,
        startFloor: 1,
      });

      const groups = computeStageGroups(activities);
      expect(groups.length).toBe(5);
      for (const g of groups) {
        expect(g.combos.length).toBe(3);
      }
      // Total rows = 750
      const totalRows = groups.reduce((s, g) => s + g.totalCount, 0);
      expect(totalRows).toBe(750);
    });

    test('assigning all combos at once', () => {
      const activities = generateActivities(300, {
        stages: ['Tiling', 'Post Tiling'],
        activitiesPerStage: ['Floor Tiling', 'Wall Tiling', 'Cladding'],
      });

      const groups = computeStageGroups(activities);

      // Assign vendors to ALL combos
      const inputs: Record<string, string> = {};
      for (const g of groups) {
        for (const c of g.combos) {
          inputs[`${c.stage}|${c.activity}`] = `Vendor for ${c.activity}`;
        }
      }

      const pending = computePendingAssignments(groups, inputs, false);
      expect(pending.combos).toBe(6); // 2 stages × 3 activities
      expect(pending.rows).toBe(300);

      const assignments = buildAssignments(groups, inputs);
      expect(assignments.length).toBe(6);
    });

    test('partial assignment — only some combos get vendors', () => {
      const activities = generateActivities(200, {
        stages: ['Tiling'],
        activitiesPerStage: ['Floor Tiling', 'Wall Tiling', 'Counter', 'Cladding'],
      });

      const groups = computeStageGroups(activities);

      // Only assign 2 of 4 activities
      const inputs = {
        'Tiling|Floor Tiling': 'Sharma',
        'Tiling|Counter': 'Gupta',
      };

      const pending = computePendingAssignments(groups, inputs, false);
      expect(pending.combos).toBe(2);

      const assignments = buildAssignments(groups, inputs);
      expect(assignments.length).toBe(2);
    });

    test('floor range targets vendor replacement on specific floors', () => {
      const activities = [
        // Floors 1-5: Sharma was the original vendor
        ...Array.from({ length: 20 }, (_, i) =>
          makeActivity({ floor: Math.floor(i / 4) + 1, flat_number: 100 + i, stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        ),
        // Floors 6-10: no vendor yet
        ...Array.from({ length: 20 }, (_, i) =>
          makeActivity({ floor: Math.floor(i / 4) + 6, flat_number: 600 + i, stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        ),
      ];

      // Only target floors 6-10 (where vendor is empty)
      const groups = computeStageGroups(activities, 6, 10);
      expect(groups[0].totalCount).toBe(20);
      expect(groups[0].combos[0].withVendor).toBe(0);

      // Full range includes all
      const allGroups = computeStageGroups(activities);
      expect(allGroups[0].totalCount).toBe(40);
      expect(allGroups[0].combos[0].withVendor).toBe(20);
    });

    test('mixed vendor coverage — onlyEmpty correctly subtracts', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Sharma' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
      ];

      const groups = computeStageGroups(activities);
      const inputs = { 'Tiling|Floor Tiling': 'NewVendor' };

      // All: 5 rows. Empty only: 5 - 2 = 3 rows
      expect(computePendingAssignments(groups, inputs, false).rows).toBe(5);
      expect(computePendingAssignments(groups, inputs, true).rows).toBe(3);
    });

    test('vendor with most occurrences wins (tie-breaker: first encountered wins)', () => {
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'A', vendor: 'Alpha' }),
        makeActivity({ stage: 'Tiling', activity: 'A', vendor: 'Alpha' }),
        makeActivity({ stage: 'Tiling', activity: 'A', vendor: 'Beta' }),
        makeActivity({ stage: 'Tiling', activity: 'A', vendor: 'Beta' }),
        makeActivity({ stage: 'Tiling', activity: 'A', vendor: 'Gamma' }),
      ];

      const groups = computeStageGroups(activities);
      // Alpha and Beta tied at 2 each; Alpha seen first, so it wins
      expect(groups[0].combos[0].currentVendor).toBe('Alpha');
    });
  });

  // ------------------------------------------------------------------
  // 6. NEGATIVE TESTS — edge cases and error conditions
  // ------------------------------------------------------------------
  describe('Negative: edge cases', () => {
    test('empty activity list → empty groups', () => {
      const groups = computeStageGroups([]);
      expect(groups).toEqual([]);
    });

    test('all activities have empty vendor → withVendor is 0', () => {
      const activities = [
        makeActivity({ vendor: '' }),
        makeActivity({ vendor: '' }),
      ];
      const groups = computeStageGroups(activities);
      expect(groups[0].combos[0].withVendor).toBe(0);
      expect(groups[0].combos[0].currentVendor).toBe('');
    });

    test('no vendor inputs → 0 pending assignments', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 100,
        },
      ];

      const result = computePendingAssignments(groups, {}, false);
      expect(result.combos).toBe(0);
      expect(result.rows).toBe(0);
    });

    test('vendor inputs for non-existent combos are ignored by buildAssignments', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 100, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 100,
        },
      ];
      const inputs = {
        'Tiling|Floor Tiling': 'Sharma',
        'NonExistent|Ghost Activity': 'Phantom Vendor', // doesn't match any combo
      };

      const assignments = buildAssignments(groups, inputs);
      expect(assignments.length).toBe(1); // only the real one
      expect(assignments[0].stage).toBe('Tiling');
    });

    test('onlyEmpty with all rows having vendor → 0 rows affected', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'A', count: 50, withVendor: 50, currentVendor: 'Sharma' },
          ],
          totalCount: 50,
        },
      ];
      const inputs = { 'Tiling|A': 'NewVendor' };

      const result = computePendingAssignments(groups, inputs, true);
      expect(result.combos).toBe(1); // combo still counted
      expect(result.rows).toBe(0); // but no rows to update
    });

    test('floor range where from > to results in empty groups', () => {
      const activities = [
        makeActivity({ floor: 1 }),
        makeActivity({ floor: 5 }),
        makeActivity({ floor: 10 }),
      ];
      // from=10, to=1 → no floor satisfies floor >= 10 AND floor <= 1
      const groups = computeStageGroups(activities, 10, 1);
      expect(groups.length).toBe(0);
    });

    test('activities with same stage+activity but different stage_gate are merged', () => {
      // The combo key is stage|activity (stage_gate is NOT part of the key)
      const activities = [
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', stage_gate: 'SG1' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', stage_gate: 'SG2' }),
        makeActivity({ stage: 'Tiling', activity: 'Floor Tiling', stage_gate: 'SG3' }),
      ];
      const groups = computeStageGroups(activities);

      expect(groups.length).toBe(1);
      expect(groups[0].combos.length).toBe(1);
      expect(groups[0].combos[0].count).toBe(3);
    });

    test('single activity → single group with single combo', () => {
      const activities = [makeActivity()];
      const groups = computeStageGroups(activities);

      expect(groups.length).toBe(1);
      expect(groups[0].combos.length).toBe(1);
      expect(groups[0].combos[0].count).toBe(1);
    });

    test('vendor inputs with special characters preserved', () => {
      const groups: StageGroup[] = [
        {
          stage: 'Tiling',
          combos: [
            { stage: 'Tiling', activity: 'Floor Tiling', count: 1, withVendor: 0, currentVendor: '' },
          ],
          totalCount: 1,
        },
      ];
      const inputs = { 'Tiling|Floor Tiling': 'M/s Sharma & Sons (P) Ltd.' };

      const assignments = buildAssignments(groups, inputs);
      expect(assignments[0].vendor).toBe('M/s Sharma & Sons (P) Ltd.');
    });

    test('pipe character in stage or activity name does not corrupt key', () => {
      // Edge case: if stage or activity contains "|", the key could be ambiguous
      // "Stage|A" + "Activity" → key "Stage|A|Activity"
      // "Stage" + "A|Activity" → key "Stage|A|Activity" — SAME KEY (collision!)
      // This is a known limitation — documenting the behavior
      const activities = [
        makeActivity({ stage: 'Stage|A', activity: 'Activity' }),
        makeActivity({ stage: 'Stage', activity: 'A|Activity' }),
      ];
      const groups = computeStageGroups(activities);

      // They'll collide into a single combo due to same key
      // This documents the limitation — in practice stage/activity names don't contain pipes
      const totalCombos = groups.reduce((s, g) => s + g.combos.length, 0);
      expect(totalCombos).toBe(1); // collision — both map to "Stage|A|Activity"
    });
  });

  // ------------------------------------------------------------------
  // 7. STRESS TESTS — performance with large datasets
  // ------------------------------------------------------------------
  describe('Stress: large dataset performance', () => {
    test('10,000 activities, 30 combos — computes under 50ms', () => {
      const activities = generateActivities(10_000, {
        stages: ['Pre-Tiling', 'Tiling', 'Post Tiling', 'Pre Paint', '1st Coat Paint', 'Final'],
        activitiesPerStage: ['Activity A', 'Activity B', 'Activity C', 'Activity D', 'Activity E'],
        flatsPerFloor: 7,
        startFloor: 1,
      });

      const start = performance.now();
      const groups = computeStageGroups(activities);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(groups.length).toBe(6); // 6 stages
      const totalCombos = groups.reduce((s, g) => s + g.combos.length, 0);
      expect(totalCombos).toBe(30); // 6 × 5

      const totalRows = groups.reduce((s, g) => s + g.totalCount, 0);
      expect(totalRows).toBe(10_000);
    });

    test('50,000 activities with floor filter — still fast', () => {
      const activities = generateActivities(50_000, {
        stages: ['Stage1', 'Stage2', 'Stage3', 'Stage4', 'Stage5'],
        activitiesPerStage: ['Act1', 'Act2', 'Act3', 'Act4'],
        flatsPerFloor: 4,
        startFloor: 1,
      });

      const start = performance.now();
      const groups = computeStageGroups(activities, 100, 200);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
      // Should have fewer rows than total
      const totalRows = groups.reduce((s, g) => s + g.totalCount, 0);
      expect(totalRows).toBeLessThan(50_000);
      expect(totalRows).toBeGreaterThan(0);
    });

    test('100,000 activities — pendingAssignments computation fast', () => {
      const activities = generateActivities(100_000, {
        stages: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'],
        activitiesPerStage: ['A1', 'A2', 'A3', 'A4', 'A5'],
        flatsPerFloor: 10,
        startFloor: 1,
        vendorFn: i => (i % 3 === 0 ? 'VendorX' : ''),
      });

      const groups = computeStageGroups(activities);

      // Fill all combos with a vendor
      const inputs: Record<string, string> = {};
      for (const g of groups) {
        for (const c of g.combos) {
          inputs[`${c.stage}|${c.activity}`] = 'BulkVendor';
        }
      }

      const start = performance.now();
      const pending = computePendingAssignments(groups, inputs, true);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
      expect(pending.combos).toBe(50); // 10 stages × 5 activities
      // onlyEmpty: rows without vendor (~2/3 of total)
      expect(pending.rows).toBeGreaterThan(60_000);
      expect(pending.rows).toBeLessThan(70_000);
    });

    test('all activities same stage × activity → single combo with huge count', () => {
      const activities = Array.from({ length: 20_000 }, (_, i) =>
        makeActivity({
          floor: Math.floor(i / 4) + 1,
          flat_number: i,
          stage: 'Tiling',
          activity: 'Floor Tiling',
          vendor: i % 5 === 0 ? 'Sharma' : '',
        }),
      );

      const start = performance.now();
      const groups = computeStageGroups(activities);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(groups.length).toBe(1);
      expect(groups[0].combos.length).toBe(1);
      expect(groups[0].combos[0].count).toBe(20_000);
      expect(groups[0].combos[0].withVendor).toBe(4_000); // 20% have vendor
      expect(groups[0].combos[0].currentVendor).toBe('Sharma');
    });

    test('many unique combos (200 stages × 10 activities = 2000 combos)', () => {
      const stages = Array.from({ length: 200 }, (_, i) => `Stage ${i + 1}`);
      const acts = Array.from({ length: 10 }, (_, i) => `Activity ${i + 1}`);

      // Generate at least 1 activity per combo
      const activities: Activity[] = [];
      for (const stage of stages) {
        for (const act of acts) {
          activities.push(makeActivity({ stage, activity: act }));
        }
      }

      const start = performance.now();
      const groups = computeStageGroups(activities);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(groups.length).toBe(200);

      const totalCombos = groups.reduce((s, g) => s + g.combos.length, 0);
      expect(totalCombos).toBe(2_000);
    });
  });

  // ------------------------------------------------------------------
  // 8. INTEGRATION-LIKE TESTS — end-to-end flow through all functions
  // ------------------------------------------------------------------
  describe('Integration: full workflow', () => {
    test('compute → assign → verify pending matches', () => {
      const activities = [
        makeActivity({ floor: 1, stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ floor: 1, stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ floor: 1, stage: 'Tiling', activity: 'Wall Tiling', vendor: 'Sharma' }),
        makeActivity({ floor: 2, stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        makeActivity({ floor: 2, stage: 'Tiling', activity: 'Wall Tiling', vendor: '' }),
        makeActivity({ floor: 2, stage: 'Pre-Tiling', activity: 'Waterproofing', vendor: '' }),
      ];

      // Step 1: compute combos
      const groups = computeStageGroups(activities);
      expect(groups.length).toBe(2); // Tiling and Pre-Tiling

      // Step 2: admin assigns vendors
      const inputs: Record<string, string> = {
        'Tiling|Floor Tiling': 'ABC Tiles',
        'Tiling|Wall Tiling': 'XYZ Walls',
        'Pre-Tiling|Waterproofing': 'WP Solutions',
      };

      // Step 3: check pending
      const pending = computePendingAssignments(groups, inputs, false);
      expect(pending.combos).toBe(3);
      expect(pending.rows).toBe(6); // 3 + 2 + 1

      // With onlyEmpty
      const emptyOnly = computePendingAssignments(groups, inputs, true);
      expect(emptyOnly.rows).toBe(5); // 6 - 1 (Wall Tiling on floor 1 already has Sharma)

      // Step 4: build assignments (order follows data insertion, not alphabetical)
      const assignments = buildAssignments(groups, inputs);
      expect(assignments.length).toBe(3);
      // Verify all three are present regardless of order
      const sorted = [...assignments].sort((a, b) => `${a.stage}|${a.activity}`.localeCompare(`${b.stage}|${b.activity}`));
      expect(sorted).toEqual([
        { stage: 'Pre-Tiling', activity: 'Waterproofing', vendor: 'WP Solutions' },
        { stage: 'Tiling', activity: 'Floor Tiling', vendor: 'ABC Tiles' },
        { stage: 'Tiling', activity: 'Wall Tiling', vendor: 'XYZ Walls' },
      ]);
    });

    test('floor-filtered workflow — vendor replacement on upper floors', () => {
      const activities = [
        // Floors 1-5: all have Vendor A
        ...Array.from({ length: 5 }, (_, i) =>
          makeActivity({ floor: i + 1, stage: 'Tiling', activity: 'Floor Tiling', vendor: 'Vendor A' }),
        ),
        // Floors 6-10: no vendor
        ...Array.from({ length: 5 }, (_, i) =>
          makeActivity({ floor: i + 6, stage: 'Tiling', activity: 'Floor Tiling', vendor: '' }),
        ),
      ];

      // Admin wants to assign Vendor B only to floors 6-10
      const groups = computeStageGroups(activities, 6, 10);
      expect(groups[0].combos[0].count).toBe(5);
      expect(groups[0].combos[0].withVendor).toBe(0);

      const inputs = { 'Tiling|Floor Tiling': 'Vendor B' };
      const pending = computePendingAssignments(groups, inputs, false);
      expect(pending.rows).toBe(5);

      // Admin also wants to replace Vendor A on floors 3-5 with Vendor C
      const groups2 = computeStageGroups(activities, 3, 5);
      expect(groups2[0].combos[0].count).toBe(3);
      expect(groups2[0].combos[0].withVendor).toBe(3);
      expect(groups2[0].combos[0].currentVendor).toBe('Vendor A');

      const inputs2 = { 'Tiling|Floor Tiling': 'Vendor C' };
      const pending2 = computePendingAssignments(groups2, inputs2, false);
      expect(pending2.rows).toBe(3); // overwrite all 3

      // If onlyEmpty, 0 rows (all already have vendor)
      const emptyOnly = computePendingAssignments(groups2, inputs2, true);
      expect(emptyOnly.rows).toBe(0);
    });

    test('autocomplete merges project vendors + new typed vendors', () => {
      const existingVendors = ['Alpha Corp', 'Beta Inc', 'Gamma LLC'];
      const vendorInputs = {
        'Tiling|A': 'Delta Works',
        'Tiling|B': 'Alpha Corp', // duplicate
        'Tiling|C': '',          // empty, ignored
        'Tiling|D': '  ',        // whitespace, ignored
      };

      const result = mergeAutocompleteVendors(existingVendors, vendorInputs);
      expect(result).toEqual(['Alpha Corp', 'Beta Inc', 'Delta Works', 'Gamma LLC']);
    });
  });
});
