import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth-guard';

/**
 * GET /api/debug/check-activities?projectId=xxx&floor=21&stageGate=Door+Locks
 *
 * Diagnostic: compares what supabaseAdmin sees vs what a supervisor would see.
 * Temporary debug endpoint — authenticated users only.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (auth.error) return auth.error;

    const projectId = req.nextUrl.searchParams.get('projectId');
    const floor = req.nextUrl.searchParams.get('floor');
    const stageGate = req.nextUrl.searchParams.get('stageGate');

    if (!projectId || !floor) {
      return NextResponse.json({ error: 'projectId and floor are required' }, { status: 400 });
    }

    // 1. Admin view (service role, bypasses RLS)
    let adminQuery = supabaseAdmin
      .from('activities')
      .select('id, floor, flat_number, stage, stage_gate, activity, status, delay_reason, project_id')
      .eq('project_id', projectId)
      .eq('floor', parseInt(floor, 10))
      .order('flat_number');

    if (stageGate) {
      adminQuery = adminQuery.eq('stage_gate', stageGate);
    }

    const { data: adminRows, error: adminErr } = await adminQuery;

    // 2. Check supervisor assignments for this project
    const { data: assignments } = await supabaseAdmin
      .from('supervisor_assignments')
      .select('supervisor_id, assigned_floors')
      .eq('project_id', projectId);

    return NextResponse.json({
      adminRowCount: adminRows?.length || 0,
      adminRows: adminRows?.map(r => ({
        id: r.id,
        flat: r.flat_number,
        stage_gate: r.stage_gate,
        activity: r.activity,
        status: r.status,
        delay_reason: r.delay_reason,
        project_id: r.project_id,
      })),
      adminError: adminErr?.message || null,
      supervisorAssignments: assignments?.map(a => ({
        supervisor_id: a.supervisor_id,
        assigned_floors: a.assigned_floors,
        hasFloor: (a.assigned_floors as number[])?.includes(parseInt(floor, 10)) ?? 'no assigned_floors',
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Internal error', detail: message }, { status: 500 });
  }
}
