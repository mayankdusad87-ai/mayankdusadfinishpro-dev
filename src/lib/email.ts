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

// ---- Weekly Management Report ----

export interface WeeklyTargetRow {
  stage: string;
  floorFrom: number;
  floorTo: number;
  totalFlats: number;
  completedFlats: number;
  progressPct: number;
  daysRemaining: number;
  status: 'achieved' | 'delayed' | 'missed' | 'on_track' | 'at_risk';
}

export interface WeeklyBlocker {
  reason: string;
  activityCount: number;
  floorCount: number;
}

const PACE_BADGE: Record<string, { label: string; bg: string; color: string; barColor: string }> = {
  achieved: { label: 'ACHIEVED', bg: '#dcfce7', color: '#166534', barColor: '#22c55e' },
  on_track: { label: 'ON TRACK', bg: '#dcfce7', color: '#166534', barColor: '#22c55e' },
  at_risk: { label: 'AT RISK', bg: '#fef3c7', color: '#92400e', barColor: '#f59e0b' },
  delayed: { label: 'DELAYED', bg: '#fef3c7', color: '#92400e', barColor: '#f59e0b' },
  missed: { label: 'BEHIND', bg: '#fee2e2', color: '#991b1b', barColor: '#ef4444' },
};

function floorRangeLabel(from: number, to: number): string {
  return from === to ? `Floor ${from}` : `Floors ${from}–${to}`;
}

export function weeklyReportEmailHtml(
  projectName: string,
  weekRange: string,
  targets: WeeklyTargetRow[],
  blockers: WeeklyBlocker[],
  dashboardUrl: string,
): string {
  // Executive summary
  const onTrackCount = targets.filter(t => t.status === 'achieved' || t.status === 'on_track').length;
  const behindTargets = targets.filter(t => t.status === 'missed');
  const atRiskTargets = targets.filter(t => t.status === 'at_risk' || t.status === 'delayed');

  let summaryText: string;
  if (targets.length === 0) {
    summaryText = 'No monthly targets have been set for this project yet.';
  } else if (behindTargets.length > 0) {
    const worstStage = behindTargets[0].stage;
    summaryText = `<strong style="color: #162032;">${onTrackCount} of ${targets.length}</strong> targets are on track this month. <span style="color: #991b1b; font-weight: 600;">${worstStage}</span> is significantly behind pace and needs attention.`;
  } else if (atRiskTargets.length > 0) {
    summaryText = `<strong style="color: #162032;">${onTrackCount} of ${targets.length}</strong> targets are on track. <span style="color: #92400e; font-weight: 600;">${atRiskTargets[0].stage}</span> is at risk and may need a push.`;
  } else {
    summaryText = `All <strong style="color: #162032;">${targets.length}</strong> targets are on track this month. Great progress!`;
  }

  // Target cards
  const targetCards = targets.map(t => {
    const badge = PACE_BADGE[t.status] || PACE_BADGE.on_track;
    const isBehind = t.status === 'missed';
    const cardBorder = isBehind ? '#fecaca' : '#e2e8f0';
    const cardBg = isBehind ? '#fff5f5' : '#ffffff';
    const trackBg = isBehind ? '#fecaca' : '#e2e8f0';
    const pctWidth = Math.max(t.progressPct, 2);

    return `
      <div style="border: 1px solid ${cardBorder}; border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; background: ${cardBg};">
        <table style="width: 100%;"><tr>
          <td style="font-size: 14px; font-weight: 600; color: #1e293b;">${t.stage}</td>
          <td style="text-align: right;"><span style="background: ${badge.bg}; color: ${badge.color}; padding: 2px 10px; border-radius: 10px; font-weight: 600; font-size: 11px; letter-spacing: 0.3px;">${badge.label}</span></td>
        </tr></table>
        <table style="width: 100%; margin-top: 8px;"><tr>
          <td style="font-size: 12px; color: #64748b;">${t.completedFlats} of ${t.totalFlats} flats</td>
          <td style="text-align: right; font-size: 12px; color: #64748b;">${t.progressPct}%</td>
        </tr></table>
        <div style="height: 6px; background: ${trackBg}; border-radius: 3px; margin-top: 6px;">
          <div style="width: ${pctWidth}%; height: 6px; background: ${badge.barColor}; border-radius: 3px;"></div>
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">${t.daysRemaining >= 0 ? `${t.daysRemaining} days remaining` : `${Math.abs(t.daysRemaining)} days overdue`} · ${floorRangeLabel(t.floorFrom, t.floorTo)}</div>
      </div>`;
  }).join('');

  // Blocker rows
  const blockerRows = blockers.length > 0
    ? blockers.map((b, i) => {
        const severity = i === 0 ? '#ef4444' : '#f59e0b';
        const borderBottom = i < blockers.length - 1 ? 'border-bottom: 1px solid #f1f5f9;' : '';
        return `
          <tr>
            <td style="width: 16px; padding: 12px 0 12px 12px; vertical-align: middle;">
              <div style="width: 4px; height: 28px; background: ${severity}; border-radius: 2px;"></div>
            </td>
            <td style="padding: 12px 16px 12px 12px; ${borderBottom}">
              <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${b.reason}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">Affecting ${b.activityCount} activit${b.activityCount === 1 ? 'y' : 'ies'} across ${b.floorCount} floor${b.floorCount !== 1 ? 's' : ''}</div>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td style="padding: 16px; text-align: center; font-size: 13px; color: #94a3b8;">No active blockers — all clear!</td></tr>';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #162032; padding: 24px 28px 20px; border-radius: 8px 8px 0 0;">
        <table style="width: 100%;"><tr>
          <td style="font-size: 14px; font-weight: 600; color: #C8922A; letter-spacing: 1.5px; text-transform: uppercase;">Finishing Pro</td>
          <td style="text-align: right; font-size: 11px; color: #64748b; letter-spacing: 0.5px;">WEEKLY REPORT</td>
        </tr></table>
        <div style="height: 1px; background: linear-gradient(to right, #C8922A, transparent); margin: 14px 0 16px;"></div>
        <div style="font-size: 24px; font-weight: 600; color: #ffffff; letter-spacing: -0.3px;">${projectName}</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;">${weekRange}</div>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 28px; border-radius: 0 0 8px 8px;">
        <div style="background: #f8fafc; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px; border-left: 3px solid #C8922A;">
          <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">${summaryText}</p>
        </div>
        ${targets.length > 0 ? `
        <div style="margin-bottom: 28px;">
          <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px;">Monthly target pace</div>
          ${targetCards}
        </div>` : ''}
        <div style="margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 14px;">Current blockers</div>
          <table style="width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: collapse;">
            ${blockerRows}
          </table>
        </div>
        <div style="text-align: center; margin: 28px 0 8px;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #162032; color: #C8922A; text-decoration: none; padding: 11px 32px; border-radius: 6px; font-weight: 600; font-size: 13px; letter-spacing: 0.3px;">View full dashboard &rarr;</a>
        </div>
        <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px;">
          <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
            Automated weekly report · Finishing Pro<br>
            Sent every Monday to active management users
          </p>
        </div>
      </div>
    </div>
  `;
}
