import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';

// ---- Auth helper (reusable) ----

async function verifyAdmin(req: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.replace('Bearer ', '');

  if (!token) {
    const cookies = req.cookies.getAll();
    const sbCookie = cookies.find(c => c.name.includes('auth-token'));
    if (!sbCookie) {
      return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
    }
    try {
      const parsed = JSON.parse(Buffer.from(sbCookie.value.replace('base64-', ''), 'base64').toString());
      token = parsed?.access_token;
    } catch { /* fall through */ }
  }

  if (!token) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Only admin can manage targets
  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Only admins can manage targets' }, { status: 403 }) };
  }

  return { userId: user.id };
}

// ---- Zod schemas ----

const CreateTargetSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  stage: z.string().min(1, 'Stage is required').max(200),
  floorFrom: z.number().int().min(0, 'Floor must be ≥ 0').max(200, 'Floor must be ≤ 200'),
  floorTo: z.number().int().min(0, 'Floor must be ≥ 0').max(200, 'Floor must be ≤ 200'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().max(500).optional(),
}).refine(d => d.floorTo >= d.floorFrom, {
  message: '"Floor To" must be ≥ "Floor From"',
  path: ['floorTo'],
});

const UpdateTargetSchema = z.object({
  id: z.string().uuid('Invalid target ID'),
  projectId: z.string().uuid('Invalid project ID').optional(),
  stage: z.string().min(1).max(200).optional(),
  floorFrom: z.number().int().min(0).max(200).optional(),
  floorTo: z.number().int().min(0).max(200).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  notes: z.string().max(500).optional(),
}).refine(d => {
  if (d.floorFrom !== undefined && d.floorTo !== undefined) return d.floorTo >= d.floorFrom;
  return true;
}, { message: '"Floor To" must be ≥ "Floor From"', path: ['floorTo'] });

const DeleteTargetSchema = z.object({
  id: z.string().uuid('Invalid target ID'),
});

// ---- POST: Create target ----

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = CreateTargetSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(e => e.message).join('; ');
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { projectId, stage, floorFrom, floorTo, targetDate, notes } = parsed.data;

  // Verify project exists
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check for duplicate (same project + stage + floor range + same month)
  const monthDate = new Date(targetDate);
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

  const { count: dupCount } = await supabaseAdmin
    .from('project_milestones')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('stage', stage)
    .eq('floor_from', floorFrom)
    .eq('floor_to', floorTo)
    .gte('target_date', monthStart)
    .lte('target_date', monthEnd);

  if ((dupCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `A target for "${stage}" (Floor ${floorFrom}–${floorTo}) already exists this month` },
      { status: 409 },
    );
  }

  // Auto-generate title
  const title = floorFrom === floorTo
    ? `${stage} — Floor ${floorFrom}`
    : `${stage} — Floors ${floorFrom}–${floorTo}`;

  const { data, error } = await supabaseAdmin
    .from('project_milestones')
    .insert({
      project_id: projectId,
      title,
      stage,
      stage_gate: null,
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

// ---- PATCH: Update target (all fields) ----

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = UpdateTargetSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(e => e.message).join('; ');
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { id, projectId, stage, floorFrom, floorTo, targetDate, notes } = parsed.data;

  // If stage or floor range changed, check for duplicates (exclude self)
  if (projectId && stage && floorFrom !== undefined && floorTo !== undefined && targetDate) {
    const monthDate = new Date(targetDate);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

    const { count: dupCount } = await supabaseAdmin
      .from('project_milestones')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('stage', stage)
      .eq('floor_from', floorFrom)
      .eq('floor_to', floorTo)
      .gte('target_date', monthStart)
      .lte('target_date', monthEnd)
      .neq('id', id);

    if ((dupCount ?? 0) > 0) {
      return NextResponse.json(
        { error: `A target for "${stage}" (Floor ${floorFrom}–${floorTo}) already exists this month` },
        { status: 409 },
      );
    }
  }

  // Fetch current values so we can merge and regenerate the title
  const { data: existing } = await supabaseAdmin
    .from('project_milestones')
    .select('stage, floor_from, floor_to, target_date, notes')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }

  const finalStage = stage ?? existing.stage;
  const finalFrom = floorFrom ?? existing.floor_from;
  const finalTo = floorTo ?? existing.floor_to;
  const finalDate = targetDate ?? existing.target_date;
  const finalNotes = notes !== undefined ? (notes || null) : existing.notes;
  const finalTitle = finalFrom === finalTo
    ? `${finalStage} — Floor ${finalFrom}`
    : `${finalStage} — Floors ${finalFrom}–${finalTo}`;

  const { error } = await supabaseAdmin
    .from('project_milestones')
    .update({
      stage: finalStage,
      floor_from: finalFrom,
      floor_to: finalTo,
      target_date: finalDate,
      notes: finalNotes,
      title: finalTitle,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ---- DELETE: Remove target ----

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = DeleteTargetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid target ID' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('project_milestones')
    .delete()
    .eq('id', parsed.data.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
