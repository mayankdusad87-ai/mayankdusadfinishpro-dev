import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/auth-guard';
import { resetPasswordSchema } from '@/lib/validations';
import { sendEmail, passwordResetEmailHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { userId, newPassword } = parsed.data;

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Send email to the user with their new password
  let emailSent = false;
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (profile?.email) {
      emailSent = await sendEmail({
        to: profile.email,
        subject: '[Finishing Pro] Your password has been reset',
        html: passwordResetEmailHtml(profile.full_name || 'User', newPassword),
      });
    }
  } catch {
    // best-effort — password was already reset successfully
  }

  return NextResponse.json({ success: true, emailSent });
}
