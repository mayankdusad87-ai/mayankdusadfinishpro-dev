import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { createManagementSchema } from '@/lib/validations';

function gotrueHeaders() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
    'apikey': serviceKey,
  };
}

function gotrueUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!}/auth/v1${path}`;
}

async function findAndDeleteOrphanedAuthUser(email: string): Promise<boolean> {
  const listRes = await fetch(gotrueUrl('/admin/users?page=1&per_page=50'), {
    method: 'GET',
    headers: gotrueHeaders(),
  });
  if (!listRes.ok) return false;
  const listJson = await listRes.json();
  const users = listJson.users || [];
  const match = users.find(
    (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!match?.id) return false;

  const delRes = await fetch(gotrueUrl(`/admin/users/${match.id}`), {
    method: 'DELETE',
    headers: gotrueHeaders(),
  });
  return delRes.ok;
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

    let authRes = await fetch(gotrueUrl('/admin/users'), {
      method: 'POST',
      headers: gotrueHeaders(),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { target_role: 'management', full_name: fullName },
      }),
    });

    let authJson = await authRes.json();

    if (!authRes.ok) {
      const msg = authJson.msg || authJson.message || authJson.error || '';
      const isDuplicate =
        typeof msg === 'string' &&
        msg.toLowerCase().includes('already been registered');

      if (isDuplicate) {
        const deleted = await findAndDeleteOrphanedAuthUser(email);
        if (!deleted) {
          console.error('[create-management] Could not delete orphaned auth user:', email);
          return NextResponse.json({
            error: 'Could not clean up orphaned auth user. Please delete from Supabase Auth dashboard (Authentication > Users) and retry.',
          }, { status: 400 });
        }

        authRes = await fetch(gotrueUrl('/admin/users'), {
          method: 'POST',
          headers: gotrueHeaders(),
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { target_role: 'management', full_name: fullName },
          }),
        });
        authJson = await authRes.json();

        if (!authRes.ok) {
          const retryMsg = authJson.msg || authJson.message || authJson.error || '';
          console.error('[create-management] Retry after delete failed:', authRes.status, retryMsg);
          return NextResponse.json({
            error: typeof retryMsg === 'string' && retryMsg.length > 0 ? retryMsg : `Auth service error (${authRes.status})`,
          }, { status: 400 });
        }
      } else {
        console.error('[create-management] GoTrue error:', authRes.status, msg);
        return NextResponse.json({
          error: typeof msg === 'string' && msg.length > 0 ? msg : `Auth service error (${authRes.status})`,
        }, { status: 400 });
      }
    }

    const userId = authJson.id;
    if (!userId) {
      return NextResponse.json({ error: 'User created but no ID returned' }, { status: 500 });
    }

    if (phone) {
      await supabaseAdmin
        .from('profiles')
        .update({ phone })
        .eq('id', userId);
    }

    return NextResponse.json({ userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[create-management] Unhandled:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
