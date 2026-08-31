/**
 * WIP Aging — functional, stress, positive & negative tests
 *
 * Tests the computeWipAging logic extracted from OperationsView.
 * We replicate the function here (it's a pure function with no React deps)
 * so we can unit-test it thoroughly.
 */

// ---- Types (mirrored from OperationsView) ----

interface InsightRow {
  floor: number;
  flat_number: number;
  stage: string;
  stage_gate: string;
  activity: string;
  status: string;
  expected_start: string;
  expected_end: string;
  actual_start: string;
  actual_end: string;
  vendor: string;
  delay_reason: string;
}

interface WipItem {
  floor: number;
  flatNumber: number;
  stage: string;
  activity: string;
  daysInWip: number;
  severity: 'critical' | 'warning' | 'normal';
  delayReason: string;
}

interface WipStageGroup {
  stage: string;
  items: WipItem[];
  maxDays: number;
}

const VELOCITY_STAGES = [
  'Pre-Tiling',
  'Tiling',
  'Post Tiling',
  'Pre Paint Activities',
  '1st coat paint',
] as const;

// ---- Function under test (copied from OperationsView.tsx) ----

function computeWipAging(rows: InsightRow[]): WipStageGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const wipRows = rows.filter(r => {
    const s = r.status;
    return (s === 'in_progress' || s === 'in_progress_delayed') && r.actual_start;
  });

  const stageMap = new Map<string, Map<string, WipItem>>();

  for (const r of wipRows) {
    const startDate = new Date(r.actual_start);
    startDate.setHours(0, 0, 0, 0);
    const daysInWip = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const severity: WipItem['severity'] = daysInWip >= 10 ? 'critical' : daysInWip >= 7 ? 'warning' : 'normal';

    if (!stageMap.has(r.stage)) stageMap.set(r.stage, new Map());
    const flatMap = stageMap.get(r.stage)!;
    const flatKey = `${r.floor}-${r.flat_number}`;

    const existing = flatMap.get(flatKey);
    if (!existing || daysInWip > existing.daysInWip) {
      flatMap.set(flatKey, {
        floor: r.floor,
        flatNumber: r.flat_number,
        stage: r.stage,
        activity: r.activity,
        daysInWip,
        severity,
        delayReason: r.delay_reason || '',
      });
    }
  }

  const groups: WipStageGroup[] = [];
  for (const stage of VELOCITY_STAGES) {
    const flatMap = stageMap.get(stage);
    if (!flatMap || flatMap.size === 0) continue;
    const items = [...flatMap.values()].sort((a, b) => b.daysInWip - a.daysInWip);
    groups.push({ stage, items, maxDays: items[0].daysInWip });
  }

  for (const [stage, flatMap] of stageMap) {
    if ((VELOCITY_STAGES as readonly string[]).includes(stage)) continue;
    if (flatMap.size === 0) continue;
    const items = [...flatMap.values()].sort((a, b) => b.daysInWip - a.daysInWip);
    groups.push({ stage, items, maxDays: items[0].daysInWip });
  }

  return groups;
}

// ---- Test helpers ----

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function makeRow(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    floor: 1,
    flat_number: 101,
    stage: 'Pre-Tiling',
    stage_gate: '',
    activity: 'Plumbing',
    status: 'in_progress',
    expected_start: '2026-08-01',
    expected_end: '2026-08-30',
    actual_start: daysAgo(5),
    actual_end: '',
    vendor: 'Vendor A',
    delay_reason: '',
    ...overrides,
  };
}

// ---- Tests ----

describe('computeWipAging', () => {

  // =====================
  // POSITIVE TESTS
  // =====================

  describe('Positive / Functional', () => {

    test('returns empty array when no rows', () => {
      const result = computeWipAging([]);
      expect(result).toEqual([]);
    });

    test('single in_progress activity produces one group with one item', () => {
      const rows = [makeRow({ actual_start: daysAgo(3) })];
      const result = computeWipAging(rows);

      expect(result).toHaveLength(1);
      expect(result[0].stage).toBe('Pre-Tiling');
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].daysInWip).toBe(3);
      expect(result[0].items[0].severity).toBe('normal');
      expect(result[0].items[0].floor).toBe(1);
      expect(result[0].items[0].flatNumber).toBe(101);
    });

    test('in_progress_delayed status is included', () => {
      const rows = [makeRow({ status: 'in_progress_delayed', actual_start: daysAgo(12) })];
      const result = computeWipAging(rows);

      expect(result).toHaveLength(1);
      expect(result[0].items[0].daysInWip).toBe(12);
      expect(result[0].items[0].severity).toBe('critical');
    });

    test('severity thresholds: normal (<7), warning (7-9), critical (10+)', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(0) }),  // 0 days = normal
        makeRow({ flat_number: 102, actual_start: daysAgo(6) }),  // 6 days = normal
        makeRow({ flat_number: 103, actual_start: daysAgo(7) }),  // 7 days = warning
        makeRow({ flat_number: 104, actual_start: daysAgo(9) }),  // 9 days = warning
        makeRow({ flat_number: 105, actual_start: daysAgo(10) }), // 10 days = critical
        makeRow({ flat_number: 106, actual_start: daysAgo(30) }), // 30 days = critical
      ];
      const result = computeWipAging(rows);
      const items = result[0].items;

      // Sorted by daysInWip descending
      expect(items[0].severity).toBe('critical');  // 30d
      expect(items[1].severity).toBe('critical');  // 10d
      expect(items[2].severity).toBe('warning');   // 9d
      expect(items[3].severity).toBe('warning');   // 7d
      expect(items[4].severity).toBe('normal');    // 6d
      expect(items[5].severity).toBe('normal');    // 0d
    });

    test('items are sorted by daysInWip descending (worst first)', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(2) }),
        makeRow({ flat_number: 102, actual_start: daysAgo(15) }),
        makeRow({ flat_number: 103, actual_start: daysAgo(8) }),
      ];
      const result = computeWipAging(rows);
      const days = result[0].items.map(i => i.daysInWip);
      expect(days).toEqual([15, 8, 2]);
    });

    test('maxDays equals the highest daysInWip in the group', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(3) }),
        makeRow({ flat_number: 102, actual_start: daysAgo(20) }),
        makeRow({ flat_number: 103, actual_start: daysAgo(7) }),
      ];
      const result = computeWipAging(rows);
      expect(result[0].maxDays).toBe(20);
    });

    test('groups are ordered by VELOCITY_STAGES pipeline order', () => {
      const rows = [
        makeRow({ stage: '1st coat paint', flat_number: 101, actual_start: daysAgo(5) }),
        makeRow({ stage: 'Pre-Tiling', flat_number: 201, actual_start: daysAgo(3) }),
        makeRow({ stage: 'Tiling', flat_number: 301, actual_start: daysAgo(8) }),
      ];
      const result = computeWipAging(rows);
      expect(result.map(g => g.stage)).toEqual(['Pre-Tiling', 'Tiling', '1st coat paint']);
    });

    test('delay_reason is captured on the WipItem', () => {
      const rows = [
        makeRow({ delay_reason: 'Material shortage', actual_start: daysAgo(5) }),
      ];
      const result = computeWipAging(rows);
      expect(result[0].items[0].delayReason).toBe('Material shortage');
    });

    test('empty delay_reason becomes empty string', () => {
      const rows = [
        makeRow({ delay_reason: '', actual_start: daysAgo(5) }),
      ];
      const result = computeWipAging(rows);
      expect(result[0].items[0].delayReason).toBe('');
    });

    test('multiple activities for same flat — keeps the one with most days', () => {
      const rows = [
        makeRow({ flat_number: 101, activity: 'Plumbing', actual_start: daysAgo(3) }),
        makeRow({ flat_number: 101, activity: 'Electrical', actual_start: daysAgo(12) }),
        makeRow({ flat_number: 101, activity: 'Waterproofing', actual_start: daysAgo(7) }),
      ];
      const result = computeWipAging(rows);
      expect(result[0].items).toHaveLength(1); // one flat, not three
      expect(result[0].items[0].activity).toBe('Electrical'); // 12 days = worst
      expect(result[0].items[0].daysInWip).toBe(12);
    });

    test('multiple activities for same flat — keeps delay reason of worst activity', () => {
      const rows = [
        makeRow({ flat_number: 101, activity: 'Plumbing', actual_start: daysAgo(3), delay_reason: 'Labour issue' }),
        makeRow({ flat_number: 101, activity: 'Electrical', actual_start: daysAgo(12), delay_reason: 'Material shortage' }),
      ];
      const result = computeWipAging(rows);
      expect(result[0].items[0].delayReason).toBe('Material shortage');
    });

    test('same flat in different stages appears in both stage groups', () => {
      const rows = [
        makeRow({ flat_number: 101, stage: 'Pre-Tiling', actual_start: daysAgo(5) }),
        makeRow({ flat_number: 101, stage: 'Tiling', actual_start: daysAgo(3) }),
      ];
      const result = computeWipAging(rows);
      expect(result).toHaveLength(2);
      expect(result[0].stage).toBe('Pre-Tiling');
      expect(result[1].stage).toBe('Tiling');
    });

    test('stages not in VELOCITY_STAGES are appended after pipeline stages', () => {
      const rows = [
        makeRow({ stage: 'Pre-Tiling', flat_number: 101, actual_start: daysAgo(5) }),
        makeRow({ stage: 'Lobby Flooring', flat_number: 201, actual_start: daysAgo(8) }),
      ];
      const result = computeWipAging(rows);
      expect(result).toHaveLength(2);
      expect(result[0].stage).toBe('Pre-Tiling');
      expect(result[1].stage).toBe('Lobby Flooring');
    });

    test('activity started today has 0 days in WIP', () => {
      const rows = [makeRow({ actual_start: daysAgo(0) })];
      const result = computeWipAging(rows);
      expect(result[0].items[0].daysInWip).toBe(0);
      expect(result[0].items[0].severity).toBe('normal');
    });
  });

  // =====================
  // NEGATIVE TESTS
  // =====================

  describe('Negative (should be excluded)', () => {

    test('completed activities are excluded', () => {
      const rows = [
        makeRow({ status: 'completed', actual_start: daysAgo(10) }),
        makeRow({ status: 'completed_delayed', actual_start: daysAgo(15) }),
      ];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('not_started activities are excluded', () => {
      const rows = [makeRow({ status: 'not_started', actual_start: '' })];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('delayed (not_started variant) activities are excluded', () => {
      const rows = [makeRow({ status: 'delayed', actual_start: '' })];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('on_hold activities are excluded', () => {
      const rows = [makeRow({ status: 'on_hold', actual_start: daysAgo(5) })];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('in_progress without actual_start is excluded', () => {
      const rows = [makeRow({ status: 'in_progress', actual_start: '' })];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('in_progress_delayed without actual_start is excluded', () => {
      const rows = [makeRow({ status: 'in_progress_delayed', actual_start: '' })];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('null-like actual_start is excluded', () => {
      const rows = [
        makeRow({ actual_start: undefined as unknown as string }),
        makeRow({ actual_start: null as unknown as string }),
      ];
      const result = computeWipAging(rows);
      expect(result).toEqual([]);
    });

    test('mixed valid and invalid rows — only valid ones appear', () => {
      const rows = [
        makeRow({ flat_number: 101, status: 'in_progress', actual_start: daysAgo(5) }),       // valid
        makeRow({ flat_number: 102, status: 'completed', actual_start: daysAgo(10) }),          // excluded
        makeRow({ flat_number: 103, status: 'in_progress', actual_start: '' }),                 // excluded
        makeRow({ flat_number: 104, status: 'not_started', actual_start: '' }),                 // excluded
        makeRow({ flat_number: 105, status: 'in_progress_delayed', actual_start: daysAgo(8) }),// valid
      ];
      const result = computeWipAging(rows);
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(2);
      expect(result[0].items.map(i => i.flatNumber).sort()).toEqual([101, 105]);
    });
  });

  // =====================
  // EDGE CASES
  // =====================

  describe('Edge cases', () => {

    test('future actual_start date results in 0 days (clamped by Math.max)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const rows = [makeRow({ actual_start: tomorrow.toISOString().slice(0, 10) })];
      const result = computeWipAging(rows);
      expect(result[0].items[0].daysInWip).toBe(0);
      expect(result[0].items[0].severity).toBe('normal');
    });

    test('exact boundary: 7 days is warning, 6 is normal', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(6) }),
        makeRow({ flat_number: 102, actual_start: daysAgo(7) }),
      ];
      const result = computeWipAging(rows);
      const items = result[0].items;
      const six = items.find(i => i.flatNumber === 101)!;
      const seven = items.find(i => i.flatNumber === 102)!;
      expect(six.severity).toBe('normal');
      expect(seven.severity).toBe('warning');
    });

    test('exact boundary: 10 days is critical, 9 is warning', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(9) }),
        makeRow({ flat_number: 102, actual_start: daysAgo(10) }),
      ];
      const result = computeWipAging(rows);
      const items = result[0].items;
      const nine = items.find(i => i.flatNumber === 101)!;
      const ten = items.find(i => i.flatNumber === 102)!;
      expect(nine.severity).toBe('warning');
      expect(ten.severity).toBe('critical');
    });

    test('very old activity (365 days) is critical', () => {
      const rows = [makeRow({ actual_start: daysAgo(365) })];
      const result = computeWipAging(rows);
      expect(result[0].items[0].daysInWip).toBe(365);
      expect(result[0].items[0].severity).toBe('critical');
    });

    test('actual_start with time component is parsed correctly', () => {
      const d = new Date();
      d.setDate(d.getDate() - 5);
      const rows = [makeRow({ actual_start: d.toISOString() })]; // full ISO with time
      const result = computeWipAging(rows);
      expect(result[0].items[0].daysInWip).toBe(5);
    });

    test('delay_reason with special characters is preserved', () => {
      const rows = [makeRow({
        actual_start: daysAgo(3),
        delay_reason: 'Material delay — supplier didn\'t deliver (20% short)',
      })];
      const result = computeWipAging(rows);
      expect(result[0].items[0].delayReason).toBe('Material delay — supplier didn\'t deliver (20% short)');
    });
  });

  // =====================
  // STRESS TESTS
  // =====================

  describe('Stress tests', () => {

    test('1000 activities across 5 stages, 10 floors, 4 flats each', () => {
      const rows: InsightRow[] = [];
      const stages = ['Pre-Tiling', 'Tiling', 'Post Tiling', 'Pre Paint Activities', '1st coat paint'];
      const activities = ['Plumbing', 'Electrical', 'Waterproofing', 'POP Punning', 'Tile Work'];

      for (const stage of stages) {
        for (let floor = 1; floor <= 10; floor++) {
          for (let flat = 1; flat <= 4; flat++) {
            for (const activity of activities) {
              rows.push(makeRow({
                stage,
                floor,
                flat_number: floor * 100 + flat,
                activity,
                actual_start: daysAgo(Math.floor(Math.random() * 30)),
                status: Math.random() > 0.5 ? 'in_progress' : 'in_progress_delayed',
                delay_reason: Math.random() > 0.3 ? 'Some reason' : '',
              }));
            }
          }
        }
      }

      expect(rows.length).toBe(1000);

      const start = performance.now();
      const result = computeWipAging(rows);
      const elapsed = performance.now() - start;

      // Should complete in under 100ms for 1000 rows
      expect(elapsed).toBeLessThan(100);

      // 5 stages
      expect(result).toHaveLength(5);

      // Each stage has 40 flats (10 floors × 4 flats), since we pick worst activity per flat
      for (const group of result) {
        expect(group.items.length).toBe(40);
      }

      // Items sorted descending
      for (const group of result) {
        for (let i = 1; i < group.items.length; i++) {
          expect(group.items[i - 1].daysInWip).toBeGreaterThanOrEqual(group.items[i].daysInWip);
        }
      }

      // maxDays matches first item
      for (const group of result) {
        expect(group.maxDays).toBe(group.items[0].daysInWip);
      }
    });

    test('5000 activities — performance under 200ms', () => {
      const rows: InsightRow[] = [];
      for (let i = 0; i < 5000; i++) {
        rows.push(makeRow({
          stage: VELOCITY_STAGES[i % 5],
          floor: Math.floor(i / 100) + 1,
          flat_number: (Math.floor(i / 100) + 1) * 100 + (i % 10) + 1,
          activity: `Activity ${i % 20}`,
          actual_start: daysAgo(i % 40),
          status: 'in_progress',
        }));
      }

      const start = performance.now();
      const result = computeWipAging(rows);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(result.length).toBeGreaterThan(0);
    });

    test('all activities on the same flat — only one item per stage', () => {
      const rows: InsightRow[] = [];
      for (let i = 0; i < 50; i++) {
        rows.push(makeRow({
          floor: 1,
          flat_number: 101,
          stage: 'Pre-Tiling',
          activity: `Activity ${i}`,
          actual_start: daysAgo(i),
        }));
      }

      const result = computeWipAging(rows);
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(1); // collapsed to one flat
      expect(result[0].items[0].daysInWip).toBe(49); // worst = oldest
    });
  });

  // =====================
  // UI-RELATED LOGIC TESTS
  // =====================

  describe('UI computation (counts used in header badges)', () => {

    test('wipTotalFlats counts all flats across groups', () => {
      const rows = [
        makeRow({ stage: 'Pre-Tiling', flat_number: 101, actual_start: daysAgo(5) }),
        makeRow({ stage: 'Pre-Tiling', flat_number: 102, actual_start: daysAgo(3) }),
        makeRow({ stage: 'Tiling', flat_number: 201, actual_start: daysAgo(8) }),
      ];
      const groups = computeWipAging(rows);
      const wipTotalFlats = groups.reduce((s, g) => s + g.items.length, 0);
      expect(wipTotalFlats).toBe(3);
    });

    test('wipCriticalCount counts only critical items', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(15) }), // critical
        makeRow({ flat_number: 102, actual_start: daysAgo(8) }),  // warning
        makeRow({ flat_number: 103, actual_start: daysAgo(3) }),  // normal
        makeRow({ flat_number: 104, actual_start: daysAgo(12) }), // critical
      ];
      const groups = computeWipAging(rows);
      const wipCriticalCount = groups.reduce((s, g) => s + g.items.filter(i => i.severity === 'critical').length, 0);
      expect(wipCriticalCount).toBe(2);
    });

    test('wipWarningCount counts only warning items', () => {
      const rows = [
        makeRow({ flat_number: 101, actual_start: daysAgo(15) }), // critical
        makeRow({ flat_number: 102, actual_start: daysAgo(8) }),  // warning
        makeRow({ flat_number: 103, actual_start: daysAgo(7) }),  // warning
        makeRow({ flat_number: 104, actual_start: daysAgo(3) }),  // normal
      ];
      const groups = computeWipAging(rows);
      const wipWarningCount = groups.reduce((s, g) => s + g.items.filter(i => i.severity === 'warning').length, 0);
      expect(wipWarningCount).toBe(2);
    });

    test('no in-progress rows → all counts are zero', () => {
      const rows = [
        makeRow({ status: 'completed', actual_start: daysAgo(5) }),
      ];
      const groups = computeWipAging(rows);
      const wipTotalFlats = groups.reduce((s, g) => s + g.items.length, 0);
      const wipCriticalCount = groups.reduce((s, g) => s + g.items.filter(i => i.severity === 'critical').length, 0);
      const wipWarningCount = groups.reduce((s, g) => s + g.items.filter(i => i.severity === 'warning').length, 0);
      expect(wipTotalFlats).toBe(0);
      expect(wipCriticalCount).toBe(0);
      expect(wipWarningCount).toBe(0);
    });
  });
});
