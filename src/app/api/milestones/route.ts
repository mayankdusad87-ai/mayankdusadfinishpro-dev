import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Verify the caller is admin or management.
 * Returns userId on success, or a NextResponse error.
 */
async function verifyAdminOrManagement(req: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || req.cookies.get('sb-access-token')?.value;

  if (!token) {
    // Try extracting from supabase auth cookie
    const cookies = req.cookies.getAll();
    const sbCookie = cookies.find(c => c.name.includes('auth-token'));
    if (!sbCookie) {
      return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
    }
    // Parse the base64 cookie
    try {
      const parsed = JSON.parse(Buffer.from(sbCookie.value.replace('base64-', ''), 'base64').toString());
      const accessToken = parsed?.access_token;
      if (accessToken) {
        return verifyToken(accessToken);
      }
    } catch { /* fall through */ }
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  return verifyToken(token);
}

async function verifyToken(token: string): Promise<{ userId: string } | { error: NextResponse }> {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'management')) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }

  return { userId: user.id };
}

/**
 * POST /api/milestones — create a milestone
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminOrManagement(req);
  if ('error' in auth) return auth.error;

  let body: {
    projectId?: string;
    title?: string;
    stage?: string;
    stageGate?: string;
    floorFrom?: number;
    floorTo?: number;
    targetDate?: string;
    notes?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { projectId, title, stage, stageGate, floorFrom, floorTo, targetDate, notes } = body;
  if (!projectId || !title || !stage || floorFrom === undefined || floorTo === undefined || !targetDate) {
    return NextResponse.json({ error: 'projectId, title, stage, floorFrom, floorTo, and targetDate are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .insert({
      project_id: projectId,
      title,
      stage,
      stage_gate: stageGate || null,
      floor_from: floorFrom,
      floor_to: floorTo,
      target_date: targetDate,
      notes: notes || null,
      created_by: auth.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}

/**
 * PATCH /api/milestones — update a milestone (title, targetDate, notes)
 */
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminOrManagement(req);
  if ('error' in auth) return auth.error;

  let body: { id?: string; title?: string; targetDate?: string; notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: {
    updated_at: string;
    title?: string;
    target_date?: string;
    notes?: string | null;
  } = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.targetDate !== undefined) updates.target_date = body.targetDate;
  if (body.notes !== undefined) updates.notes = body.notes || null;

  const { error } = await supabaseAdmin
    .from('project_milestones')
    .update(updates)
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/milestones — delete a milestone (admin only)
 */
export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminOrManagement(req);
  if ('error' in auth) return auth.error;

  let body: { id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('project_milestones')
    .delete()
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
