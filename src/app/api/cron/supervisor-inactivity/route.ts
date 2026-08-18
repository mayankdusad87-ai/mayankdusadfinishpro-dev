import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, inactivityEscalationEmailHtml } from '@/lib/email';

const INACTIVITY_THRESHOLD_DAYS = 2;

/**
 * Cron endpoint: checks for supervisors inactive for 2+ days.
 * Sends a single consolidated escalation email to all admins,
 * with inactive supervisors in CC.
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 * Vercel Cron calls this daily (see vercel.json).
 */
export async function GET(req: NextRequest) {
  // ---- Auth: only Vercel Cron or manual call with secret ----
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
        is_active,
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

    // 2. Fetch last_sign_in_at from Supabase Auth for each supervisor
    const now = new Date();
    const inactiveSupervisors: Array<{
      name: string;
      email: string;
      project: string;
      lastLogin: string;
      daysSinceLogin: number;
    }> = [];

    // Fetch auth users in batches (Supabase listUsers returns paginated)
    const supervisorIds = supervisors.map(s => s.id);
    const authUsersMap = new Map<string, string | null>();

    let page = 1;
    const perPage = 50;
    let hasMore = true;

    while (hasMore) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (authErr || !authData?.users) {
        console.error('[cron/supervisor-inactivity] Failed to fetch auth users:', authErr?.message);
        break;
      }

      for (const user of authData.users) {
        if (supervisorIds.includes(user.id)) {
          authUsersMap.set(user.id, user.last_sign_in_at || null);
        }
      }

      // Check if there are more pages
      if (authData.users.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // 3. Find supervisors inactive for 2+ days
    for (const sup of supervisors) {
      const lastSignIn = authUsersMap.get(sup.id);

      let daysSinceLogin: number;
      let lastLoginText: string;

      if (!lastSignIn) {
        // Never logged in
        daysSinceLogin = 999;
        lastLoginText = 'Never logged in';
      } else {
        const lastDate = new Date(lastSignIn);
        daysSinceLogin = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        lastLoginText = lastDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      if (daysSinceLogin >= INACTIVITY_THRESHOLD_DAYS && sup.email) {
        // Get project name from assignment
        const assignments = (sup.supervisor_assignments as Array<{
          project_id: string;
          projects: { name: string } | null;
        }>) || [];
        const projectName = assignments[0]?.projects?.name || 'Unassigned';

        inactiveSupervisors.push({
          name: sup.full_name,
          email: sup.email,
          project: projectName,
          lastLogin: lastLoginText,
          daysSinceLogin: Math.min(daysSinceLogin, 999), // cap display
        });
      }
    }

    if (inactiveSupervisors.length === 0) {
      return NextResponse.json({ message: 'All supervisors active', sent: false });
    }

    // 4. Fetch admin emails (all admins get the escalation)
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

    // 5. Send consolidated email — TO: admins, CC: inactive supervisors
    const supervisorEmails = inactiveSupervisors.map(s => s.email);
    const supervisorCount = inactiveSupervisors.length;

    const emailSent = await sendEmail({
      to: adminEmails,
      cc: supervisorEmails,
      subject: `[Finishing Pro] ⚠️ ${supervisorCount} supervisor${supervisorCount === 1 ? '' : 's'} inactive for ${INACTIVITY_THRESHOLD_DAYS}+ days`,
      html: inactivityEscalationEmailHtml(inactiveSupervisors),
    });

    console.log(
      `[cron/supervisor-inactivity] ${supervisorCount} inactive supervisor(s) found. Email sent: ${emailSent}`,
      inactiveSupervisors.map(s => `${s.name} (${s.daysSinceLogin}d)`).join(', '),
    );

    return NextResponse.json({
      message: `Found ${supervisorCount} inactive supervisor(s)`,
      sent: emailSent,
      supervisors: inactiveSupervisors.map(s => ({
        name: s.name,
        daysSinceLogin: s.daysSinceLogin,
      })),
    });
  } catch (err) {
    console.error('[cron/supervisor-inactivity] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
