import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { createManagementSchema } from '@/lib/validations';

function authErrorMessage(error: { message: string; status?: number; code?: string }): string {
  if (error.code === 'email_exists' || error.message?.includes('already been registered'))
    return 'A user with this email already exists.';
  if (error.code === 'weak_password')
    return 'Password is too weak. Use at least 6 characters.';
  if (error.status === 401 || error.status === 403)
    return 'Service role key is invalid or expired. Contact admin.';
  const msg = error.message?.replace(/^\{?\}?$/, '').trim();
  if (msg) return msg;
  return `Auth error (${error.status ?? 'unknown'}). Please try again or contact admin.`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req);
    if (auth.error) return auth.error;

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const parsed = createManagementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password, fullName, phone } = parsed.data;

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'management', full_name: fullName },
    });

    if (error) {
      const code = 'code' in error ? String((error as unknown as { code: string }).code) : undefined;
      const raw = JSON.stringify({ message: error.message, status: error.status, code, name: error.name, cause: error.cause });
      console.error('[create-management] Auth error:', raw);
      return NextResponse.json({ error: authErrorMessage({ message: error.message, status: error.status, code }), debug: raw }, { status: 400 });
    }

    if (data.user) {
      await supabaseAdmin
        .from('profiles')
        .update({ phone, full_name: fullName, role: 'management' })
        .eq('id', data.user.id);
    }

    return NextResponse.json({ userId: data.user?.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[create-management] Unhandled:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
