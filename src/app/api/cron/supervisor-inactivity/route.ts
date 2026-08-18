import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, inactivityEscalationEmailHtml } from '@/lib/email';

const INACTIVITY_THRESHOLD_DAYS = 2;

/**
 * Cron endpoint: checks for supervisors inactive for 2+ days.
 *
 * "Inactive" = no status updates in audit_log for 2+ days.
 * This is the real activity signal — a supervisor may stay logged
 * in via session cookie but if they haven't updated any activity
 * status, they're not doing their job on site.
 *
 * Sends a single consolidated escalation email TO all admins,
 * with inactive supervisors in CC.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 * Vercel Cron calls this daily at 7 AM IST (see vercel.json).
 */
export async function GET(req: NextRequest) {
  // ---- Auth: only Vercel Cron or manual call with secret ----
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/supervisor-inactivity] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all active supervisors with their project assignments
    const { data: supervisors, error: supErr } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        supervisor_assignments(
          project_id,
          projects(name)
        )
      `)
      .eq('role', 'supervisor')
      .eq('is_active', true);

    if (supErr) {
      console.error('[cron/supervisor-inactivity] Failed to fetch supervisors:', supErr.message);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!supervisors || supervisors.length === 0) {
      return NextResponse.json({ message: 'No active supervisors', sent: false });
    }

    // 2. For each supervisor, find their most recent audit_log entry
    //    audit_log.changed_by = supervisor's profile ID
    //    This is more accurate than last_sign_in_at because it tracks
    //    actual work (status updates), not just password entry.
    const now = new Date();
    const inactiveSupervisors: Array<{
      name: string;
      email: string;
      project: string;
      lastLogin: string;      // relabeled as "Last Activity" in email
      daysSinceLogin: number;  // days since last activity
    }> = [];

    for (const sup of supervisors) {
      // Get the most recent audit_log entry for this supervisor
      const { data: lastAudit } = await supabaseAdmin
        .from('audit_log')
        .select('created_at')
        .eq('changed_by', sup.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let daysSinceActivity: number;
      let lastActivityText: string;

      if (!lastAudit?.created_at) {
        // No audit entries — never made any updates
        daysSinceActivity = 999;
        lastActivityText = 'No activity recorded';
      } else {
        const lastDate = new Date(lastAudit.created_at);
        daysSinceActivity = Math.floor(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        lastActivityText = lastDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      if (daysSinceActivity >= INACTIVITY_THRESHOLD_DAYS && sup.email) {
        const assignments = (sup.supervisor_assignments as Array<{
          project_id: string;
          projects: { name: string } | null;
        }>) || [];
        const projectName = assignments[0]?.projects?.name || 'Unassigned';

        inactiveSupervisors.push({
          name: sup.full_name,
          email: sup.email,
          project: projectName,
          lastLogin: lastActivityText,
          daysSinceLogin: Math.min(daysSinceActivity, 999),
        });
      }
    }

    if (inactiveSupervisors.length === 0) {
      return NextResponse.json({ message: 'All supervisors active', sent: false });
    }

    // 3. Fetch admin emails (all admins get the escalation)
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true);

    const adminEmails = (admins || [])
      .map(a => a.email)
      .filter((e): e is string => !!e);

    if (adminEmails.length === 0) {
      console.warn('[cron/supervisor-inactivity] No admin emails found');
      return NextResponse.json({ message: 'No admin emails configured', sent: false });
    }

    // 4. Send consolidated email — TO: admins, CC: inactive supervisors
    const supervisorEmails = inactiveSupervisors.map(s => s.email);
    const supervisorCount = inactiveSupervisors.length;

    const emailSent = await sendEmail({
      to: adminEmails,
      cc: supervisorEmails,
      subject: `[Finishing Pro] ⚠️ ${supervisorCount} supervisor${supervisorCount === 1 ? '' : 's'} inactive for ${INACTIVITY_THRESHOLD_DAYS}+ days`,
      html: inactivityEscalationEmailHtml(inactiveSupervisors),
    });

    console.log(
      `[cron/supervisor-inactivity] ${supervisorCount} inactive supervisor(s). Email sent: ${emailSent}`,
      inactiveSupervisors.map(s => `${s.name} (${s.daysSinceLogin}d)`).join(', '),
    );

    return NextResponse.json({
      message: `Found ${supervisorCount} inactive supervisor(s)`,
      sent: emailSent,
      supervisors: inactiveSupervisors.map(s => ({
        name: s.name,
        daysSinceActivity: s.daysSinceLogin,
      })),
    });
  } catch (err) {
    console.error('[cron/supervisor-inactivity] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
