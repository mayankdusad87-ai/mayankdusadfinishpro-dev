import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { createManagementSchema } from '@/lib/validations';

async function gotrueRequest(path: string, method: string, body?: unknown) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return fetch(`${supabaseUrl}/auth/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const res = await gotrueRequest(`/admin/users?page=1&per_page=1`, 'GET');
  if (!res.ok) return null;
  const listRes = await gotrueRequest(
    `/admin/users?page=1&per_page=50`,
    'GET',
  );
  if (!listRes.ok) return null;
  const listJson = await listRes.json();
  const users = listJson.users || [];
  const match = users.find(
    (u: { email?: string }) =>
      u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id || null;
}

async function ensureProfile(
  userId: string,
  data: { full_name: string; phone?: string; email: string },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabaseAdmin.rpc as any)('set_profile_management', {
    p_user_id: userId,
    p_full_name: data.full_name,
    p_email: data.email,
    p_phone: data.phone || null,
  });
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

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();
    if (existingProfile?.role === 'management') {
      return NextResponse.json({ error: 'A management user with this email already exists.' }, { status: 400 });
    }

    const authRes = await gotrueRequest('/admin/users', 'POST', {
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'supervisor', full_name: fullName },
    });

    const authJson = await authRes.json();
    let userId: string | null = null;

    if (authRes.ok) {
      userId = authJson.id || null;
      if (!userId) {
        return NextResponse.json({ error: 'User created but no ID returned' }, { status: 500 });
      }
    } else {
      const msg = authJson.msg || authJson.message || authJson.error || '';
      const isDuplicate =
        typeof msg === 'string' &&
        msg.toLowerCase().includes('already been registered');

      if (!isDuplicate) {
        console.error('[create-management] GoTrue error:', authRes.status, msg);
        return NextResponse.json({
          error: typeof msg === 'string' && msg.length > 0 ? msg : `Auth service error (${authRes.status})`,
        }, { status: 400 });
      }

      userId = existingProfile?.id || (await findAuthUserByEmail(email));
      if (!userId) {
        return NextResponse.json({
          error: 'User exists in auth but could not be found. Please delete from Supabase Auth dashboard and retry.',
        }, { status: 400 });
      }
    }

    const { error: profileError } = await ensureProfile(userId, {
      full_name: fullName,
      phone,
      email,
    });

    if (profileError) {
      console.error('[create-management] Profile upsert failed:', profileError.message);
      return NextResponse.json({
        error: `User created but profile update failed: ${profileError.message}`,
      }, { status: 500 });
    }

    return NextResponse.json({ userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[create-management] Unhandled:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
