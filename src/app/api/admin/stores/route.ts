import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * POST /api/admin/stores — mark a unit as store
 * Body: { projectId, floor, flatNumber, notes? }
 */
export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, 'standard');
  if (limited) return limited;

  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  let body: { projectId?: string; floor?: number; flatNumber?: number; notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { projectId, floor, flatNumber, notes } = body;
  if (!projectId || floor === undefined || flatNumber === undefined) {
    return NextResponse.json({ error: 'projectId, floor, and flatNumber are required' }, { status: 400 });
  }

  // Check if already active store
  const { data: existing } = await supabaseAdmin
    .from('unit_stores')
    .select('id')
    .eq('project_id', projectId)
    .eq('floor', floor)
    .eq('flat_number', flatNumber)
    .is('unmarked_at', null)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Unit is already marked as a store' }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from('unit_stores').insert({
    project_id: projectId,
    floor,
    flat_number: flatNumber,
    marked_by: auth.userId,
    notes: notes || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/admin/stores — unmark a unit store
 * Body: { storeId }
 */
export async function PATCH(req: NextRequest) {
  const limited = applyRateLimit(req, 'standard');
  if (limited) return limited;

  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  let body: { storeId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  if (!body.storeId) {
    return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('unit_stores')
    .update({
      unmarked_at: new Date().toISOString(),
      unmarked_by: auth.userId,
    })
    .eq('id', body.storeId)
    .is('unmarked_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
