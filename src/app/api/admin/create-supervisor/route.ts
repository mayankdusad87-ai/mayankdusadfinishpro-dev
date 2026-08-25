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

  // Try to create the auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'supervisor', full_name: fullName },
  });

  if (error) {
    // If user already exists, look them up and return their ID
    // so the frontend can assign them to the new project
    if (error.message?.toLowerCase().includes('already') || error.status === 422) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (existing) {
        // Update profile in case name/phone changed
        await supabaseAdmin
          .from('profiles')
          .update({ phone, full_name: fullName })
          .eq('id', existing.id);
        return NextResponse.json({ userId: existing.id, existing: true });
      }
    }
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
