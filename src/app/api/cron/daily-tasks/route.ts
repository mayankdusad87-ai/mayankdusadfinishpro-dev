import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cron/daily-tasks
 *
 * Orchestrator that runs daily cron tasks in sequence:
 *  1. Supervisor inactivity check (every day)
 *  2. Weekly management report   (Tuesdays only — UTC day 2)
 *
 * Each sub-task is a separate API route that still works independently
 * for manual triggering. This orchestrator exists solely to stay within
 * the Vercel Hobby plan's 2-cron-job limit.
 *
 * Schedule: 30 1 * * * (daily at 01:30 UTC / 7:00 AM IST)
 * Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/daily-tasks] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const protocol = process.env.VERCEL ? 'https' : 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  const baseUrl = `${protocol}://${host}`;
  const headers = { Authorization: `Bearer ${cronSecret}` };

  const results: Record<string, unknown> = {};

  // 1. Supervisor inactivity — runs every day
  try {
    console.log('[cron/daily-tasks] Running supervisor-inactivity...');
    const res = await fetch(`${baseUrl}/api/cron/supervisor-inactivity`, { headers });
    results.supervisorInactivity = await res.json();
    console.log('[cron/daily-tasks] supervisor-inactivity done, status:', res.status);
  } catch (err) {
    console.error('[cron/daily-tasks] supervisor-inactivity failed:', err);
    results.supervisorInactivity = { error: String(err) };
  }

  // 2. Weekly report — Tuesdays only (UTC day 2)
  const utcDay = new Date().getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, ...
  if (utcDay === 2) {
    try {
      console.log('[cron/daily-tasks] Tuesday — running weekly-report...');
      const res = await fetch(`${baseUrl}/api/cron/weekly-report`, { headers });
      results.weeklyReport = await res.json();
      console.log('[cron/daily-tasks] weekly-report done, status:', res.status);
    } catch (err) {
      console.error('[cron/daily-tasks] weekly-report failed:', err);
      results.weeklyReport = { error: String(err) };
    }
  } else {
    results.weeklyReport = { skipped: true, reason: `Today is day ${utcDay}, not Tuesday (2)` };
  }

  return NextResponse.json({
    message: 'Daily tasks completed',
    utcDay,
    ...results,
  });
}
