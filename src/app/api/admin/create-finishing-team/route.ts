import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { createFinishingTeamSchema } from '@/lib/validations';
import { sendEmail, welcomeFinishingTeamEmailHtml } from '@/lib/email';

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
    const limited = applyRateLimit(req, 'create');
    if (limited) return limited;

    // Only admin can create finishing team users
    const auth = await verifyAdmin(req);
    if (auth.error) return auth.error;

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const parsed = createFinishingTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password, fullName, phone } = parsed.data;

    // Check if a finishing_team user with this email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();
    if (existingProfile?.role === 'finishing_team') {
      return NextResponse.json({ error: 'A finishing team user with this email already exists.' }, { status: 400 });
    }

    let authRes = await fetch(gotrueUrl('/admin/users'), {
      method: 'POST',
      headers: gotrueHeaders(),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'finishing_team', full_name: fullName },
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
          console.error('[create-finishing-team] Could not delete orphaned auth user:', email);
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
            user_metadata: { role: 'finishing_team', full_name: fullName },
          }),
        });
        authJson = await authRes.json();

        if (!authRes.ok) {
          const retryMsg = authJson.msg || authJson.message || authJson.error || '';
          console.error('[create-finishing-team] Retry after delete failed:', authRes.status, retryMsg);
          return NextResponse.json({
            error: typeof retryMsg === 'string' && retryMsg.length > 0 ? retryMsg : `Auth service error (${authRes.status})`,
          }, { status: 400 });
        }
      } else {
        console.error('[create-finishing-team] GoTrue error:', authRes.status, msg);
        return NextResponse.json({
          error: typeof msg === 'string' && msg.length > 0 ? msg : `Auth service error (${authRes.status})`,
        }, { status: 400 });
      }
    }

    const userId = authJson.id;
    if (!userId) {
      return NextResponse.json({ error: 'User created but no ID returned' }, { status: 500 });
    }

    // Update profile with finishing_team role
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'finishing_team', phone: phone || null, full_name: fullName })
      .eq('id', userId);

    if (updateError) {
      console.error('[create-finishing-team] Profile update failed:', updateError.message);

      // Fallback: direct REST PATCH
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const patchRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ role: 'finishing_team', phone: phone || null, full_name: fullName }),
        },
      );

      if (!patchRes.ok) {
        const patchErr = await patchRes.text();
        console.error('[create-finishing-team] Direct PATCH also failed:', patchErr);
        return NextResponse.json({
          error: `User created but role update failed: ${updateError.message}`,
        }, { status: 500 });
      }
    }

    // Send welcome email (non-blocking)
    sendEmail({
      to: email,
      subject: 'Welcome to Finishing Pro — Your Account is Ready',
      html: welcomeFinishingTeamEmailHtml(fullName, email, password),
    }).catch(err => console.error('[create-finishing-team] Welcome email failed:', err));

    return NextResponse.json({ userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[create-finishing-team] Unhandled:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
