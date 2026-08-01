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

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'supervisor', full_name: fullName },
      }),
    });

    const authJson = await authRes.json();

    if (!authRes.ok) {
      const msg = authJson.msg || authJson.message || authJson.error || JSON.stringify(authJson);
      console.error('[create-management] GoTrue error:', authRes.status, msg);
      return NextResponse.json({
        error: typeof msg === 'string' && msg.length > 0 ? msg : `Auth service error (${authRes.status})`,
        debug: JSON.stringify({ status: authRes.status, body: authJson }),
      }, { status: 400 });
    }

    const userId = authJson.id;
    if (!userId) {
      return NextResponse.json({ error: 'User created but no ID returned', debug: JSON.stringify(authJson) }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ phone, full_name: fullName, role: 'management' })
      .eq('id', userId);

    if (updateError) {
      console.error('[create-management] Profile update failed:', updateError.message);
      return NextResponse.json({
        error: `User created but role update failed: ${updateError.message}`,
        debug: JSON.stringify(updateError),
      }, { status: 500 });
    }

    return NextResponse.json({ userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[create-management] Unhandled:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
