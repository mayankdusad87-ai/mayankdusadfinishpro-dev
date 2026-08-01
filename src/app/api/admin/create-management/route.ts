import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { createManagementSchema } from '@/lib/validations';

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

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'management', full_name: fullName },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
