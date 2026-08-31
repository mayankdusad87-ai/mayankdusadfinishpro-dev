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

// ---- Weekly Management Report (V3 — executive brief) ----

export interface WeeklyTargetRow {
  stage: string;
  floorFrom: number;
  floorTo: number;
  totalFlats: number;
  completedFlats: number;
  progressPct: number;
  daysRemaining: number;
  status: 'achieved' | 'delayed' | 'missed' | 'on_track' | 'at_risk' | 'not_started' | 'behind';
}

export interface WeeklyPipelineStage {
  stage: string;
  completedFlats: number;
  totalFlats: number;
  pct: number;
  pendingFloors: number[];       // floor numbers with incomplete work
  isBottleneck: boolean;
}

export interface WeeklyBlocker {
  reason: string;
  activityCount: number;
  floorCount: number;
}

const TARGET_BADGE: Record<string, { label: string; bg: string; color: string; borderColor: string; bgCard: string; timingColor: string }> = {
  achieved:    { label: 'ACHIEVED',    bg: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', bgCard: '#f0fdf4', timingColor: '#166534' },
  on_track:    { label: 'ON TRACK',    bg: '#dcfce7', color: '#166534', borderColor: '#bbf7d0', bgCard: '#f0fdf4', timingColor: '#166534' },
  at_risk:     { label: 'AT RISK',     bg: '#fef3c7', color: '#92400e', borderColor: '#fed7aa', bgCard: '#fffbf5', timingColor: '#92400e' },
  delayed:     { label: 'DELAYED',     bg: '#fef3c7', color: '#92400e', borderColor: '#fed7aa', bgCard: '#fffbf5', timingColor: '#92400e' },
  missed:      { label: 'MISSED',      bg: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', bgCard: '#fff5f5', timingColor: '#991b1b' },
  not_started: { label: 'NOT STARTED', bg: '#f3f4f6', color: '#4b5563', borderColor: '#e5e7eb', bgCard: '#f9fafb', timingColor: '#6b7280' },
  behind:      { label: 'BEHIND',      bg: '#fee2e2', color: '#991b1b', borderColor: '#fecaca', bgCard: '#fff5f5', timingColor: '#991b1b' },
};

function floorRangeLabel(from: number, to: number): string {
  return from === to ? `Fl ${from}` : `Fl ${from}–${to}`;
}

/** Compress [1,2,3,5,6,8] → "1–3, 5–6, 8" */
function compressFloors(floors: number[]): string {
  if (floors.length === 0) return '—';
  const sorted = [...floors].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i]; }
    else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return 'Fl ' + ranges.join(', ');
}

/** Build timing text like the dashboard: "22d left · no progress" */
function targetTimingText(t: WeeklyTargetRow): string {
  const d = Math.abs(t.daysRemaining);
  const ds = d === 1 ? 'day' : 'days';
  if (t.status === 'achieved') return 'Completed on time';
  if (t.status === 'delayed') return `${d} ${ds} late`;
  if (t.status === 'missed') return `${d}d overdue`;
  if (t.status === 'behind') return `${d}d left · no progress`;
  if (t.status === 'not_started') return `${d}d left · not started`;
  if (t.status === 'at_risk') return t.completedFlats === 0 ? `${d}d left · not started` : `${d}d left · pace slow`;
  if (t.status === 'on_track') return `${d}d remaining`;
  return '';
}

export function weeklyReportEmailHtml(
  projectName: string,
  weekRange: string,
  targets: WeeklyTargetRow[],
  pipeline: WeeklyPipelineStage[],
  blockers: WeeklyBlocker[],
  dashboardUrl: string,
): string {
  // ---- Verdict ----
  const behindTargets = targets.filter(t => t.status === 'missed' || t.status === 'behind');
  const atRiskTargets = targets.filter(t => t.status === 'at_risk' || t.status === 'delayed' || t.status === 'not_started');
  const bottleneck = pipeline.find(s => s.isBottleneck);
  const totalAffectedFloors = new Set(blockers.flatMap(b => Array.from({ length: b.floorCount }, (_, i) => i))).size;
  const totalBlockerFloors = blockers.reduce((sum, b) => sum + b.floorCount, 0);

  let verdictTitle: string;
  let verdictDesc: string;
  let verdictBg: string;
  let verdictBorder: string;
  let verdictColor: string;
  let verdictIcon: string;

  if (behindTargets.length > 0 || blockers.length > 0) {
    verdictTitle = 'Project needs attention';
    const parts: string[] = [];
    if (behindTargets.length > 0) parts.push(`${behindTargets.length} target${behindTargets.length > 1 ? 's' : ''} behind pace`);
    if (bottleneck) parts.push(`${bottleneck.stage} is a bottleneck`);
    if (blockers.length > 0) parts.push(`${totalBlockerFloors} floor${totalBlockerFloors !== 1 ? 's' : ''} blocked`);
    verdictDesc = parts.join('. ') + '.';
    verdictBg = '#fef2f2'; verdictBorder = '#fecaca'; verdictColor = '#991b1b'; verdictIcon = '⚠';
  } else if (atRiskTargets.length > 0) {
    verdictTitle = 'Some targets at risk';
    verdictDesc = `${atRiskTargets.length} target${atRiskTargets.length > 1 ? 's need' : ' needs'} a push to stay on track.`;
    verdictBg = '#fffbeb'; verdictBorder = '#fde68a'; verdictColor = '#92400e'; verdictIcon = '⚠';
  } else {
    verdictTitle = 'Project on track';
    verdictDesc = targets.length > 0
      ? `All ${targets.length} targets are on pace. No blockers.`
      : 'No active blockers. Pipeline progressing normally.';
    verdictBg = '#f0fdf4'; verdictBorder = '#bbf7d0'; verdictColor = '#166534'; verdictIcon = '✓';
  }

  // ---- Target rows (stacked two-line cards — readable on mobile) ----
  const targetRows = targets.map(t => {
    const badge = TARGET_BADGE[t.status] || TARGET_BADGE.on_track;
    const timing = targetTimingText(t);
    return `
      <table style="width: 100%; margin-bottom: 8px;"><tr>
        <td style="background: ${badge.bgCard}; border: 1px solid ${badge.borderColor}; border-radius: 8px; padding: 14px 16px;">
          <table style="width: 100%;"><tr>
            <td style="font-size: 15px; font-weight: 700; color: #1e293b;">${t.stage}</td>
            <td style="text-align: right;">
              <span style="background: ${badge.bg}; color: ${badge.color}; padding: 3px 10px; border-radius: 10px; font-weight: 700; font-size: 11px; letter-spacing: 0.3px;">${badge.label}</span>
            </td>
          </tr></table>
          <div style="margin-top: 6px; font-size: 13px; color: #64748b; line-height: 1.5;">
            ${floorRangeLabel(t.floorFrom, t.floorTo)} · <strong style="color: #475569;">${t.completedFlats}/${t.totalFlats}</strong> flats · <span style="color: ${badge.timingColor}; font-weight: 600;">${timing}</span>
          </div>
        </td>
      </tr></table>`;
  }).join('');

  // ---- Pipeline + pending floors table ----
  const totalFlats = pipeline.length > 0 ? pipeline[0].totalFlats : 0;
  const pipelineRows = pipeline.map((s, i) => {
    const isLast = i === pipeline.length - 1;
    const bb = isLast ? '' : 'border-bottom: 1px solid #f1f5f9;';
    const rowBg = s.isBottleneck ? 'background: #fffbeb;' : '';
    const nameColor = s.isBottleneck ? 'color: #92400e;' : 'color: #1e293b;';
    const flatsColor = s.isBottleneck ? 'color: #92400e; font-weight: 600;' : 'color: #475569;';
    const floorsColor = s.isBottleneck ? 'color: #92400e; font-weight: 600;' : 'color: #64748b;';
    const bnIcon = s.isBottleneck ? ' <span style="font-size: 10px; vertical-align: middle;">⚠</span>' : '';
    const floorsText = s.pendingFloors.length > 0
      ? `${compressFloors(s.pendingFloors)} <span style="color: ${s.isBottleneck ? '#b45309' : '#94a3b8'};">(${s.pendingFloors.length})</span>`
      : '<span style="color: #22c55e;">✓ All done</span>';

    return `
      <tr style="${rowBg}">
        <td style="padding: 12px 14px; font-size: 14px; font-weight: 600; ${nameColor} ${bb}">${s.stage}${bnIcon}</td>
        <td style="padding: 12px 14px; font-size: 14px; text-align: center; ${bb} font-variant-numeric: tabular-nums; ${flatsColor}"><strong>${s.completedFlats}</strong>/${s.totalFlats}</td>
        <td style="padding: 12px 14px; font-size: 13px; text-align: right; ${bb} ${floorsColor}">${floorsText}</td>
      </tr>`;
  }).join('');

  // ---- What needs attention (narrative) ----
  const attentionItems: string[] = [];

  if (bottleneck) {
    const prevIdx = pipeline.indexOf(bottleneck) - 1;
    const prevStage = prevIdx >= 0 ? pipeline[prevIdx] : null;
    const drop = prevStage ? prevStage.completedFlats - bottleneck.completedFlats : 0;
    if (drop > 0 && prevStage) {
      attentionItems.push(`
        <tr>
          <td style="width: 5px; background: #f59e0b; border-radius: 4px 0 0 4px;"></td>
          <td style="background: #fffbeb; padding: 14px 16px; border-radius: 0 8px 8px 0;">
            <div style="font-size: 15px; font-weight: 700; color: #1e293b;">${bottleneck.stage} is the bottleneck</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px; line-height: 1.5;">${drop} flats dropped between ${prevStage.stage} → ${bottleneck.stage}. Only ${bottleneck.pct}% complete vs ${prevStage.pct}% at ${prevStage.stage}.</div>
          </td>
        </tr>`);
    }
  }

  if (blockers.length > 0) {
    const topReasons = blockers.slice(0, 3).map(b => `${b.reason} (${b.floorCount} floor${b.floorCount !== 1 ? 's' : ''})`).join(', ');
    attentionItems.push(`
      <tr>
        <td style="width: 5px; background: #ef4444; border-radius: 4px 0 0 4px;"></td>
        <td style="background: #fef2f2; padding: 14px 16px; border-radius: 0 8px 8px 0;">
          <div style="font-size: 15px; font-weight: 700; color: #1e293b;">${totalBlockerFloors} floor${totalBlockerFloors !== 1 ? 's have' : ' has'} unresolved blockers</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; line-height: 1.5;">Top reasons: ${topReasons}.</div>
        </td>
      </tr>`);
  }

  // ---- Assemble ----
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <div style="background: #162032; padding: 28px 28px 24px; border-radius: 8px 8px 0 0;">
        <table style="width: 100%;"><tr>
          <td style="font-size: 15px; font-weight: 600; color: #C8922A; letter-spacing: 1.5px; text-transform: uppercase;">Finishing Pro</td>
          <td style="text-align: right; font-size: 12px; color: #64748b; letter-spacing: 0.5px;">WEEKLY REPORT</td>
        </tr></table>
        <div style="height: 1px; background: linear-gradient(to right, #C8922A, transparent); margin: 16px 0 18px;"></div>
        <div style="font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px;">${projectName}</div>
        <div style="font-size: 14px; color: #94a3b8; margin-top: 6px;">${weekRange}</div>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 28px; border-radius: 0 0 8px 8px; background: #ffffff;">

        <div style="background: ${verdictBg}; border: 1px solid ${verdictBorder}; border-radius: 10px; padding: 18px 20px; margin-bottom: 28px;">
          <table style="width: 100%;"><tr>
            <td style="width: 40px; vertical-align: top;">
              <div style="width: 36px; height: 36px; background: ${verdictBorder}; border-radius: 50%; text-align: center; line-height: 36px; font-size: 18px;">${verdictIcon}</div>
            </td>
            <td style="padding-left: 14px;">
              <div style="font-size: 17px; font-weight: 700; color: ${verdictColor}; line-height: 1.3;">${verdictTitle}</div>
              <div style="font-size: 14px; color: #64748b; margin-top: 5px; line-height: 1.5;">${verdictDesc}</div>
            </td>
          </tr></table>
        </div>

        ${targets.length > 0 ? `
        <div style="margin-bottom: 28px;">
          <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px;">Targets · ${targets.filter(t => t.status === 'achieved' || t.status === 'delayed').length} of ${targets.length} achieved</div>
          ${targetRows}
        </div>` : ''}

        ${attentionItems.length > 0 ? `
        <div style="margin-bottom: 28px;">
          <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px;">What needs attention</div>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
            ${attentionItems.join('')}
          </table>
        </div>` : ''}

        <div style="margin-bottom: 28px;">
          <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 12px;">Pipeline · ${totalFlats} total flats</div>
          <table style="width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: separate; border-spacing: 0; overflow: hidden;">
            <tr style="background: #f8fafc;">
              <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Stage</td>
              <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; text-align: center; width: 80px;">Flats</td>
              <td style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; text-align: right;">Floors Pending</td>
            </tr>
            ${pipelineRows}
          </table>
        </div>

        <div style="text-align: center; margin: 32px 0 8px;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #162032; color: #C8922A; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px;">View full dashboard &rarr;</a>
        </div>
        <div style="border-top: 1px solid #e2e8f0; margin-top: 28px; padding-top: 16px;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6;">
            Automated weekly report · Finishing Pro<br>
            Sent every Tuesday to management users · Admins in CC
          </p>
        </div>
      </div>
    </div>
  `;
}
