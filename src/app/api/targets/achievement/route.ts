import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import {
  computeTargetStatus,
  computeTargetSummary,
  aggregateScopeData,
  type TargetRow,
  type RawActivityRow,
  type TargetAchievementResult,
} from '@/lib/target-engine';

/**
 * GET /api/targets/achievement?projectId=xxx
 *
 * Server-side computation of target achievement.
 * Requires authenticated admin/management/finishing_team role.
 * Uses supabaseAdmin (service role) internally to bypass RLS for aggregation.
 *
 * For each target, runs a focused query on just the relevant stage+floor range,
 * selecting only 5 narrow columns. Paginates to handle >1000 rows.
 *
 * If the project has 0 targets, returns immediately — no further queries.
 */
export async function GET(req: NextRequest) {
  const limited = applyRateLimit(req, 'read');
  if (limited) return limited;

  // Authenticate: only admin-panel roles can access target achievement data
  const auth = await verifyAdmin(req, ['admin', 'management', 'finishing_team']);
  if (auth.error) return auth.error;

  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  // 1. Fetch all targets for this project
  const { data: targets, error: tErr } = await supabaseAdmin
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('target_date', { ascending: true });

  if (tErr) {
    console.error('[achievement] targets query error:', tErr.message);
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }

  // Fast path: no targets → empty response, zero additional queries
  if (!targets || targets.length === 0) {
    return NextResponse.json({
      targets: [],
      summary: { total: 0, achieved: 0, delayed: 0, missed: 0, onTrack: 0, atRisk: 0, notStarted: 0, behind: 0 },
    });
  }

  // 2. For each target, fetch activity data for its scope and compute status
  const results: TargetAchievementResult[] = [];

  for (const target of targets as TargetRow[]) {
    const rows = await fetchScopeActivities(
      projectId,
      target.stage,
      target.floor_from,
      target.floor_to,
    );

    const scopeData = aggregateScopeData(rows);
    const result = computeTargetStatus(target, scopeData);
    results.push(result);
  }

  // 3. Compute summary
  const summary = computeTargetSummary(results);

  return NextResponse.json({ targets: results, summary });
}

/**
 * Fetch activity rows for a specific stage + floor range.
 * Paginates to handle >1000 rows (Supabase PostgREST limit).
 *
 * Only selects 5 narrow columns — not the full row.
 */
async function fetchScopeActivities(
  projectId: string,
  stage: string,
  floorFrom: number,
  floorTo: number,
): Promise<RawActivityRow[]> {
  const PAGE = 1000;
  const all: RawActivityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('floor, flat_number, status, actual_end, delay_reason, remarks')
      .eq('project_id', projectId)
      .eq('stage', stage)
      .gte('floor', floorFrom)
      .lte('floor', floorTo)
      .neq('status', 'not_applicable')
      .range(from, from + PAGE - 1);

    if (error) {
      console.error('[achievement] query error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    all.push(...(data as RawActivityRow[]));

    // If we got fewer than PAGE rows, we've fetched everything
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}
