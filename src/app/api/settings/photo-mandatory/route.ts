import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Verify the caller is an authenticated user (any role).
 */
async function verifyAuth(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.replace('Bearer ', '');

  if (!token) {
    const cookies = req.cookies.getAll();
    const sbCookie = cookies.find(c => c.name.includes('auth-token'));
    if (!sbCookie) return false;
    try {
      const parsed = JSON.parse(Buffer.from(sbCookie.value.replace('base64-', ''), 'base64').toString());
      token = parsed?.access_token;
    } catch { return false; }
  }

  if (!token) return false;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  return !error && !!user;
}

/**
 * GET /api/settings/photo-mandatory?projectId=xxx
 * Returns the list of activity names that require mandatory photos.
 * Uses service role to bypass RLS so supervisors can read it.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await verifyAuth(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ activities: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', `photo_mandatory_${projectId}`)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ activities: [] });
    }

    return NextResponse.json({ activities: (data.value as string[]) || [] });
  } catch {
    return NextResponse.json({ activities: [] });
  }
}
