import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createSupervisorSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, 'create');
  if (limited) return limited;

  const auth = await verifyAdmin(req, ['admin', 'finishing_team']);
  if (auth.error) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = createSupervisorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email, password, fullName, phone } = parsed.data;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'supervisor', full_name: fullName },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    await supabaseAdmin
      .from('profiles')
      .update({ phone, full_name: fullName, role: 'supervisor' })
      .eq('id', data.user.id);
  }

  return NextResponse.json({ userId: data.user?.id });
}
