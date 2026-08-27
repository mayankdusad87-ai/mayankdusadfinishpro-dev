import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  sendEmail,
  weeklyReportEmailHtml,
  type WeeklyTargetRow,
  type WeeklyBlocker,
} from '@/lib/email';
import {
  computeTargetStatus,
  aggregateScopeData,
  type TargetRow,
  type RawActivityRow,
} from '@/lib/target-engine';

const DASHBOARD_URL = 'https://finishpro-dev.vercel.app/login';

/**
 * GET /api/cron/weekly-report
 *
 * Sends a weekly management report email for each active project.
 * One email per project → TO all active management users, CC all active admins.
 *
 * Content:
 *  - Executive summary (on track / at risk / behind)
 *  - Monthly target pace with progress bars
 *  - Current blockers (delay reasons from non-completed activities)
 *
 * Protected by CRON_SECRET. Vercel Cron triggers every Tuesday 7 AM IST.
 */
export async function GET(req: NextRequest) {
  // ---- Auth ----
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/weekly-report] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Test override: ?to=email@example.com sends only to that address
    const testEmail = req.nextUrl.searchParams.get('to');

    // 1. Fetch active management users (or use test override)
    let mgmtEmails: string[];

    if (testEmail) {
      mgmtEmails = [testEmail];
      console.log(`[cron/weekly-report] TEST MODE: sending to ${testEmail} only`);
    } else {
      const { data: mgmtUsers } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('role', 'management')
        .eq('is_active', true);

      mgmtEmails = (mgmtUsers || [])
        .map(u => u.email)
        .filter((e): e is string => !!e);
    }

    if (mgmtEmails.length === 0) {
      return NextResponse.json({ message: 'No active management users', sent: 0 });
    }

    // 1b. Fetch active admin users for CC
    let adminEmails: string[] = [];
    if (!testEmail) {
      const { data: adminUsers } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('role', 'admin')
        .eq('is_active', true);

      adminEmails = (adminUsers || [])
        .map(u => u.email)
        .filter((e): e is string => !!e);
    }

    // 2. Fetch all projects
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .order('name');

    if (!projects || projects.length === 0) {
      return NextResponse.json({ message: 'No projects found', sent: 0 });
    }

    // Week range label
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - 1); // yesterday (Sunday)
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6); // 7-day window

    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const weekRange = `Week of ${fmt(weekStart)} – ${fmt(weekEnd)} ${weekEnd.getFullYear()}`;

    let totalSent = 0;
    const results: { project: string; sent: boolean; targets: number; blockers: number }[] = [];

    // 3. For each project, build and send the report
    for (const project of projects) {
      // 3a. Fetch targets
      const { data: rawTargets } = await supabaseAdmin
        .from('project_milestones')
        .select('*')
        .eq('project_id', project.id)
        .order('target_date', { ascending: true });

      const targetRows: WeeklyTargetRow[] = [];

      if (rawTargets && rawTargets.length > 0) {
        for (const target of rawTargets as TargetRow[]) {
          const activities = await fetchScopeActivities(
            project.id,
            target.stage,
            target.floor_from,
            target.floor_to,
          );
          const scopeData = aggregateScopeData(activities);
          const result = computeTargetStatus(target, scopeData, now);

          targetRows.push({
            stage: target.stage,
            floorFrom: target.floor_from,
            floorTo: target.floor_to,
            totalFlats: result.totalFlats,
            completedFlats: result.completedFlats,
            progressPct: result.progressPct,
            daysRemaining: result.daysRemaining,
            status: result.status,
          });
        }
      }

      // 3b. Fetch current blockers (delay reasons from non-completed activities)
      const blockers = await fetchBlockers(project.id);

      // 3c. Build email
      const html = weeklyReportEmailHtml(
        project.name,
        weekRange,
        targetRows,
        blockers,
        DASHBOARD_URL,
      );

      // 3d. Send (TO management, CC admins)
      const sent = await sendEmail({
        to: mgmtEmails,
        cc: adminEmails.length > 0 ? adminEmails : undefined,
        subject: `Finishing Pro Weekly — ${project.name} (${fmt(weekStart)} – ${fmt(weekEnd)})`,
        html,
      });

      if (sent) totalSent++;

      results.push({
        project: project.name,
        sent,
        targets: targetRows.length,
        blockers: blockers.length,
      });

      console.log(
        `[cron/weekly-report] ${project.name}: ${targetRows.length} targets, ${blockers.length} blockers, sent=${sent}`,
      );
    }

    return NextResponse.json({
      message: `Sent ${totalSent} of ${projects.length} project reports`,
      sent: totalSent,
      details: results,
    });
  } catch (err) {
    console.error('[cron/weekly-report] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---- Helpers ----

/**
 * Fetch activity rows for a target's scope (stage + floor range).
 * Paginates to handle >1000 rows.
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
      .select('floor, flat_number, status, actual_end, delay_reason')
      .eq('project_id', projectId)
      .eq('stage', stage)
      .gte('floor', floorFrom)
      .lte('floor', floorTo)
      .neq('status', 'not_applicable')
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;
    all.push(...(data as RawActivityRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

/**
 * Fetch top 5 blockers: delay reasons from activities that are NOT completed.
 * Groups by reason, counts activities and distinct floors.
 */
async function fetchBlockers(projectId: string): Promise<WeeklyBlocker[]> {
  const PAGE = 1000;
  const all: { delay_reason: string; floor: number }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('delay_reason, floor')
      .eq('project_id', projectId)
      .not('delay_reason', 'is', null)
      .neq('delay_reason', '')
      .not('status', 'in', '("completed","completed_delayed")')
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;
    all.push(...(data as { delay_reason: string; floor: number }[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Group by reason
  const grouped = new Map<string, { count: number; floors: Set<number> }>();
  for (const row of all) {
    const reason = row.delay_reason.trim();
    if (!reason) continue;
    const entry = grouped.get(reason) || { count: 0, floors: new Set() };
    entry.count++;
    entry.floors.add(row.floor);
    grouped.set(reason, entry);
  }

  return [...grouped.entries()]
    .map(([reason, { count, floors }]) => ({
      reason,
      activityCount: count,
      floorCount: floors.size,
    }))
    .sort((a, b) => b.activityCount - a.activityCount)
    .slice(0, 5);
}
