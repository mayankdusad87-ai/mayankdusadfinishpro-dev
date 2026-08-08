import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { notifyReversalSchema } from '@/lib/validations';
import { STATUS_LABELS } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const parsed = notifyReversalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { adminEmails, projectName, floor, flatNumber, activity, stage, stageGate, oldStatus, newStatus } = parsed.data;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  const oldLabel = STATUS_LABELS[oldStatus] || oldStatus;
  const newLabel = STATUS_LABELS[newStatus] || newStatus;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #C8922A; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Status Reversal Alert</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151;">An activity status has been reversed in <strong>${projectName}</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #6b7280;">Floor</td><td style="padding: 6px 0; font-weight: 600;">${floor}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Flat</td><td style="padding: 6px 0; font-weight: 600;">${flatNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Stage</td><td style="padding: 6px 0;">${stage}${stageGate ? ` / ${stageGate}` : ''}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Activity</td><td style="padding: 6px 0;">${activity}</td></tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Status Change</td>
            <td style="padding: 6px 0;">
              <span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${oldLabel}</span>
              <span style="margin: 0 6px; color: #9ca3af;">&rarr;</span>
              <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${newLabel}</span>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">This is an automated notification from Finish Pro.</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Finish Pro <onboarding@resend.dev>',
        to: adminEmails,
        subject: `[Finish Pro] Status Reversal: ${activity} — Floor ${floor}, Flat ${flatNumber}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.message || 'Email send failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
