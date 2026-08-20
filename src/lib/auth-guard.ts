import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

function createRequestClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );
}

/** Verify caller has one of the allowed roles. Defaults to admin-only. */
export async function verifyAdmin(
  req: NextRequest,
  allowedRoles: string[] = ['admin'],
): Promise<
  { userId: string; role: string; error?: never } | { userId?: never; role?: never; error: NextResponse }
> {
  const supabase = createRequestClient(req);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId: user.id, role: profile.role };
}

/** Verify caller is any authenticated user. Returns userId on success, NextResponse error on failure. */
export async function verifyAuth(req: NextRequest): Promise<
  { userId: string; error?: never } | { userId?: never; error: NextResponse }
> {
  const supabase = createRequestClient(req);

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { userId: user.id };
}
