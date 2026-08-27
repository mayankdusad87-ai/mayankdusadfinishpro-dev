import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Verify the caller is an authenticated user (any role).
 * Reads token from Authorization header or Supabase auth cookie.
 */
async function verifyAuth(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.replace('Bearer ', '');

  if (!token) {
    const cookies = req.cookies.getAll();
    const sbCookie = cookies.find(c => c.name.includes('auth-token'));
    if (!sbCookie) return null;
    try {
      const parsed = JSON.parse(Buffer.from(sbCookie.value.replace('base64-', ''), 'base64').toString());
      token = parsed?.access_token;
    } catch { /* fall through */ }
  }

  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return { userId: user.id };
}

/**
 * POST /api/audit-log
 * Inserts an audit log entry using service role (bypasses RLS).
 * Called from updateActivityWithAudit so supervisors can create audit entries.
 * Requires authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const { error } = await supabaseAdmin.from('audit_log').insert({
      activity_id: body.activity_id || null,
      project_id: body.project_id || null,
      changed_by: body.changed_by || null,
      old_status: body.old_status || null,
      new_status: body.new_status || null,
      floor: body.floor ?? null,
      flat_number: body.flat_number ?? null,
      stage: body.stage || null,
      stage_gate: body.stage_gate || null,
      activity_name: body.activity_name || null,
      delay_reason: body.delay_reason || null,
    });

    if (error) {
      console.error('[audit-log] insert failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[audit-log] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
