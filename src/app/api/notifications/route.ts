import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { applyRateLimit } from '@/lib/rate-limit';

/**
 * GET /api/notifications — fetch notifications for the authenticated user
 */
export async function GET(req: NextRequest) {
  const limited = applyRateLimit(req, 'read');
  if (limited) return limited;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get('limit') || '20');

  const [{ data: notifications }, { count }] = await Promise.all([
    supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ]);

  return NextResponse.json({
    notifications: notifications || [],
    unreadCount: count || 0,
  });
}

/**
 * PATCH /api/notifications — mark notifications as read
 * Body: { notificationId: string } or { markAll: true }
 */
export async function PATCH(req: NextRequest) {
  const limited = applyRateLimit(req, 'standard');
  if (limited) return limited;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { notificationId?: string; markAll?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (body.markAll) {
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  } else if (body.notificationId) {
    await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', body.notificationId)
      .eq('user_id', user.id);
  } else {
    return NextResponse.json({ error: 'notificationId or markAll required' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
