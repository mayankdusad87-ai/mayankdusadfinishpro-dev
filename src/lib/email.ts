import { Resend } from 'resend';

const FROM_ADDRESS = 'Finishing Pro <noreply@raghavgroup.in>';

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, cc, subject, html }: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email');
    return false;
  }

  const resend = new Resend(apiKey);

  // Retry up to 3 times with exponential backoff (handles cold-start socket errors)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: Array.isArray(to) ? to : [to],
        ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
        subject,
        html,
      });

      if (error) {
        console.error(`[email] Send failed (attempt ${attempt}):`, error.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1000));
          continue;
        }
        return false;
      }

      console.log('[email] Sent successfully, id:', data?.id);
      return true;
    } catch (err) {
      console.error(`[email] Send error (attempt ${attempt}/${3}):`, err);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }
  return false;
}

export function passwordResetEmailHtml(fullName: string, newPassword: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #162032; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px; color: #C8922A;">Finishing Pro</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi <strong>${fullName}</strong>,</p>
        <p style="margin: 0 0 16px; color: #374151;">Your password has been reset by the administrator. Here are your new login details:</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">New Password</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #111827; letter-spacing: 1px; font-family: monospace;">${newPassword}</p>
        </div>
        <p style="margin: 0 0 8px; color: #374151; font-size: 14px;">Please log in and change your password at your earliest convenience.</p>
        <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">This is an automated notification from Finishing Pro.</p>
      </div>
    </div>
  `;
}

export function welcomeManagementEmailHtml(fullName: string, email: string, password: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #162032; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px; color: #C8922A;">Welcome to Finishing Pro</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi <strong>${fullName}</strong>,</p>
        <p style="margin: 0 0 16px; color: #374151;">Your Finishing Pro management account has been created. You can now log in to view project dashboards, insights, and track progress.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Your Login Credentials</p>
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 4px 0; color: #6b7280; width: 80px;">Email</td><td style="padding: 4px 0; font-weight: 600; color: #111827;">${email}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Password</td><td style="padding: 4px 0; font-weight: 700; color: #111827; letter-spacing: 1px; font-family: monospace;">${password}</td></tr>
          </table>
        </div>
        <a href="https://finishpro-dev.vercel.app/login" style="display: inline-block; background: #C8922A; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Log In to Finishing Pro</a>
        <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">This is an automated notification from Finishing Pro. Please change your password after your first login.</p>
      </div>
    </div>
  `;
}

export function welcomeFinishingTeamEmailHtml(fullName: string, email: string, password: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #162032; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 20px; color: #C8922A;">Welcome to Finishing Pro</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151;">Hi <strong>${fullName}</strong>,</p>
        <p style="margin: 0 0 16px; color: #374151;">Your Finishing Team account has been created. You can now log in to manage projects, supervisors, review site photos, and track overall progress.</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Your Login Credentials</p>
          <table style="width: 100%; font-size: 14px;">
            <tr><td style="padding: 4px 0; color: #6b7280; width: 80px;">Email</td><td style="padding: 4px 0; font-weight: 600; color: #111827;">${email}</td></tr>
            <tr><td style="padding: 4px 0; color: #6b7280;">Password</td><td style="padding: 4px 0; font-weight: 700; color: #111827; letter-spacing: 1px; font-family: monospace;">${password}</td></tr>
          </table>
        </div>
        <a href="https://finishpro-dev.vercel.app/login" style="display: inline-block; background: #C8922A; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">Log In to Finishing Pro</a>
        <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">This is an automated notification from Finishing Pro. Please change your password after your first login.</p>
      </div>
    </div>
  `;
}

export function reversalAlertEmailHtml(
  projectName: string,
  floor: string | number,
  flatNumber: string | number,
  activity: string,
  stage: string,
  stageGate: string | null,
  oldLabel: string,
  newLabel: string,
): string {
  return `
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
        <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">This is an automated notification from Finishing Pro.</p>
      </div>
    </div>
  `;
}

export function inactivityEscalationEmailHtml(
  supervisors: Array<{
    name: string;
    email: string;
    project: string;
    lastLogin: string;       // human-readable
    daysSinceLogin: number;
  }>,
): string {
  const rows = supervisors
    .map(
      (s) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">${s.name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${s.project}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${s.lastLogin}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="background: ${s.daysSinceLogin >= 5 ? '#fee2e2' : '#fef3c7'}; color: ${s.daysSinceLogin >= 5 ? '#991b1b' : '#92400e'}; padding: 2px 10px; border-radius: 12px; font-weight: 700; font-size: 13px;">${s.daysSinceLogin} days</span>
        </td>
      </tr>`,
    )
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background: #162032; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px; color: #C8922A;">⚠️ Supervisor Inactivity Alert</h2>
        <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">The following supervisor(s) have not updated any activity for over 2 days</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151; font-size: 14px;">
          This is an automated escalation. Please follow up to ensure site supervision is not impacted.
        </p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Supervisor</th>
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Project</th>
              <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Last Activity</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Inactive</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <p style="margin: 20px 0 0; font-size: 13px; color: #6b7280;">
          <strong>Recommended action:</strong> Contact the supervisor(s) above and confirm their availability.
          If a supervisor is on leave, consider assigning a replacement for their floors.
        </p>

        <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">This is an automated escalation from Finishing Pro. The supervisor(s) listed above have been copied on this email.</p>
      </div>
    </div>
  `;
}
