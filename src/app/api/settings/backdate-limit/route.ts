import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_BACKDATE_DAYS = 3;

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
 * GET /api/settings/backdate-limit
 * Returns the backdate limit (days) using service role to bypass RLS.
 * Requires authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await verifyAuth(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'backdate_limit_days')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ days: DEFAULT_BACKDATE_DAYS });
    }

    return NextResponse.json({ days: data.value as number });
  } catch {
    return NextResponse.json({ days: DEFAULT_BACKDATE_DAYS });
  }
}
