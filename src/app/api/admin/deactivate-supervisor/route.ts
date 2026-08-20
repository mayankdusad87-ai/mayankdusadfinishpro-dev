import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { deactivateSupervisorSchema } from '@/lib/validations';

async function sendStatusEmail(email: string, fullName: string, role: string, activated: boolean) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !email) return; // silently skip if not configured

  const action = activated ? 'Activated' : 'Deactivated';
  const roleLabel = role === 'management' ? 'Management' : role === 'finishing_team' ? 'Finishing Team' : 'Supervisor';
  const statusColor = activated ? '#16a34a' : '#dc2626';
  const statusBg = activated ? '#f0fdf4' : '#fef2f2';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #162032; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Account ${action}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151;">Hello <strong>${fullName}</strong>,</p>
        <p style="margin: 0 0 20px; color: #374151;">
          Your <strong>${roleLabel}</strong> account on Finish Pro has been
          <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 10px; border-radius: 4px; font-weight: 600;">${action}</span>
          by the administrator.
        </p>
        ${activated
          ? '<p style="margin: 0 0 16px; color: #374151;">You can now log in and access the application.</p>'
          : '<p style="margin: 0 0 16px; color: #374151;">Your access to the application has been suspended. Please contact the administrator if you believe this is an error.</p>'
        }
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">This is an automated notification from Finish Pro.</p>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Finish Pro <onboarding@resend.dev>',
        to: [email],
        subject: `[Finish Pro] Your account has been ${action.toLowerCase()}`,
        html,
      }),
    });
  } catch {
    // Email failure should not block the toggle operation
    console.error(`Failed to send ${action} email to ${email}`);
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req, ['admin', 'finishing_team']);
  if (auth.error) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = deactivateSupervisorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { userId, isActive } = parsed.data;

  // Fetch user profile before updating (need email + name for notification)
  const { data: userProfile } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', userId)
    .single();

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!isActive) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  } else {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  // Send activation/deactivation email (non-blocking)
  if (userProfile?.email) {
    sendStatusEmail(
      userProfile.email,
      userProfile.full_name || 'User',
      userProfile.role || 'supervisor',
      isActive,
    );
  }

  return NextResponse.json({ success: true });
}
