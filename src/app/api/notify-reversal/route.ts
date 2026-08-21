import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { notifyReversalSchema } from '@/lib/validations';
import { STATUS_LABELS } from '@/lib/constants';
import { createNotificationForUsers, getAdminUserIds } from '@/lib/notify';
import { sendEmail, reversalAlertEmailHtml } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const limited = applyRateLimit(req, 'standard');
  if (limited) return limited;

  // Any authenticated user (supervisor or admin) can trigger reversal notifications
  const auth = await verifyAuth(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = notifyReversalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { projectName, floor, flatNumber, activity, stage, stageGate, oldStatus, newStatus } = parsed.data;

  // Fetch admin emails server-side (bypasses RLS)
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('role', 'admin');
  const adminEmails = (admins || []).map(r => r.email).filter((e): e is string => Boolean(e));

  if (adminEmails.length === 0) {
    return NextResponse.json({ success: true, emailSent: false, reason: 'No admin emails found' });
  }

  const oldLabel = STATUS_LABELS[oldStatus] || oldStatus;
  const newLabel = STATUS_LABELS[newStatus] || newStatus;

  // Send email notification via Resend
  const emailSent = await sendEmail({
    to: adminEmails,
    subject: `[Finishing Pro] Status Reversal: ${activity} — Floor ${floor}, Flat ${flatNumber}`,
    html: reversalAlertEmailHtml(projectName, floor, flatNumber, activity, stage, stageGate, oldLabel, newLabel),
  });

  // Always create in-app notification for all admins (works without Resend)
  try {
    const adminIds = await getAdminUserIds();
    await createNotificationForUsers(
      adminIds,
      'reversal',
      `Status Reversal — Floor ${floor}, Flat ${flatNumber}`,
      `${activity} (${stage}${stageGate ? ` / ${stageGate}` : ''}) reversed from ${oldLabel} → ${newLabel} in ${projectName}`,
      { projectName, floor, flatNumber, activity, stage, stageGate, oldStatus, newStatus },
    );
  } catch {
    // best-effort, don't fail the request
  }

  return NextResponse.json({ success: true, emailSent });
}
