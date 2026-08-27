/**
 * What's New — code-managed changelog entries.
 *
 * To announce new features:
 *  1. Add a new entry at the TOP of the CHANGELOG array
 *  2. Give it a unique `version` string (use date: "2026.08.16")
 *  3. Tag each feature with `roles` (omit to show to all)
 *  4. Deploy — users see all entries they missed, filtered by role
 *
 * The modal compares CURRENT_VERSION against localStorage.
 * Users who haven't seen the latest version see ALL missed entries,
 * with features filtered to their role.
 */

/** Roles that can be targeted by a changelog feature */
export type ChangelogRole = 'supervisor' | 'admin' | 'management' | 'finishing_team';

export interface ChangelogFeature {
  emoji: string;
  title: string;
  description: string;
  /** Which roles see this feature. Omit = shown to all roles. */
  roles?: ChangelogRole[];
}

export interface ChangelogEntry {
  version: string;
  headline: string;
  date: string;
  features: ChangelogFeature[];
}

// Newest entry first
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2026.08.27e',
    headline: 'Supervisor UX & Weekly Report',
    date: 'August 27, 2026',
    features: [
      {
        emoji: '⏸️',
        title: 'On Hold — Delay Reason Display',
        description: 'Activities on hold now show the delay reason directly on the card instead of action buttons. Tap the reason to open the detail sheet.',
        roles: ['supervisor'],
      },
      {
        emoji: '🔴',
        title: 'Overdue Split View',
        description: 'Overdue activities are now split into "Needs Attention" (no reason yet) and "Reason Captured" (collapsed). Focus on what needs action first.',
        roles: ['supervisor'],
      },
      {
        emoji: '☑️',
        title: 'Select All in Bulk Mode',
        description: 'Bulk mode now includes a Select All checkbox to check/uncheck all visible activities at once. Completed activities are skipped automatically.',
        roles: ['supervisor'],
      },
      {
        emoji: '📧',
        title: 'Weekly Report — Admin CC',
        description: 'Tuesday weekly report emails are now sent to management with all admins in CC.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.27d',
    headline: 'Audit Log Security & Delay Reasons',
    date: 'August 27, 2026',
    features: [
      {
        emoji: '🔒',
        title: 'Secured API Endpoints',
        description: 'Audit log and backdate settings API routes now require authenticated sessions — unauthenticated requests are rejected.',
        roles: ['admin'],
      },
      {
        emoji: '⚠️',
        title: 'Delay Reasons in Audit Log',
        description: 'When a supervisor captures a delay reason, it now appears as an amber subtitle in the audit log under the status change. You can also search audit entries by delay reason text.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.27c',
    headline: 'Active Blockers & Extended Backdate',
    date: 'August 27, 2026',
    features: [
      {
        emoji: '🚧',
        title: 'Active Blockers Dashboard',
        description: 'Management view now shows currently stuck activities — overdue (not started) and on hold — grouped by delay reason with a proportional bar chart. Tap any reason to see affected stages, floors, and units.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '💊',
        title: 'Compact Material Stores',
        description: 'Material Stores section in Management view now uses a compact pill format to save space.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '📅',
        title: 'Extended Backdate Limit',
        description: 'Admins can now set the back-date limit up to 365 days (previously capped at 30).',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.27b',
    headline: 'Backdate Controls & Dashboard Milestones',
    date: 'August 27, 2026',
    features: [
      {
        emoji: '📅',
        title: 'Back-Date Limit for Supervisors',
        description: 'Supervisors can only select actual start/end dates within a configurable window (default 3 days). Dates older than the limit are blocked in the date picker and enforced server-side.',
        roles: ['admin', 'supervisor'],
      },
      {
        emoji: '✏️',
        title: 'Admin Actual Date Edit',
        description: 'Admins can now edit actual start and end dates directly from the activity table — click the pencil icon on any Act. Start or Act. End cell to open the edit modal.',
        roles: ['admin'],
      },
      {
        emoji: '⚙️',
        title: 'Configurable Back-Date Window',
        description: 'Set how many days back supervisors can update entries (1–30 days) from the new Data Entry Settings section. Every change is audit-logged.',
        roles: ['admin'],
      },
      {
        emoji: '🏗️',
        title: 'Milestone Demarcation on Dashboard',
        description: 'The dashboard heatmap now visually separates Milestone 1 (Pre-Tiling → 1st Coat Paint) and Milestone 2 (Post First Coat Paint → Lobby Flooring) with labeled header rows and a thick border divider.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '📐',
        title: 'Equal-Width Dashboard Tiles',
        description: 'Fully Ready and Lobby Readiness tiles are now the same width for a cleaner, more balanced look.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.27',
    headline: 'Smarter Target Tracking & Bug Fixes',
    date: 'August 27, 2026',
    features: [
      {
        emoji: '🎯',
        title: 'Honest Target Status',
        description: 'Targets at 0% progress no longer show "On Track". New statuses: "Not Started" (gray) when work hasn\'t begun, escalating to "At Risk" and "Behind" as time passes. Velocity-based tracking kicks in once work starts.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '🔢',
        title: 'Accurate In-Progress Unit Counts',
        description: 'Floor-level drill-down in Operations now shows distinct flats (e.g. 7 units) instead of inflated activity-row counts (e.g. 21 units for 7 flats × 3 activities).',
        roles: ['admin', 'management'],
      },
      {
        emoji: '📧',
        title: 'Weekly Report on Tuesdays',
        description: 'Management weekly email now arrives every Tuesday at 7 AM IST instead of Monday.',
        roles: ['management'],
      },
    ],
  },
  {
    version: '2026.08.26b',
    headline: 'Accurate Site Activity & Faster Re-upload',
    date: 'August 26, 2026',
    features: [
      {
        emoji: '📊',
        title: 'Accurate Site Activity',
        description: 'Site Activity (Insights → Operations) now uses actual start/end dates instead of audit log entries. No more false "272 started today" after an Excel re-upload — only real supervisor activity counts.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '🕐',
        title: 'Timezone-Safe Date Filters',
        description: 'Today / This Week / This Month filters now use local IST dates instead of UTC — no more off-by-one errors near midnight. Future dates from Excel are also excluded.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '⚡',
        title: 'Faster Template Re-upload',
        description: 'Smart Merge now completes in seconds instead of 30+ seconds — updates are batched instead of sent one-by-one.',
        roles: ['admin'],
      },
      {
        emoji: '🛡️',
        title: 'Re-upload Safety Warning',
        description: 'If impact analysis fails during re-upload, a clear red warning now shows instead of silently deleting data. You\'ll see exactly how many supervisor-modified activities are at risk before proceeding.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.25c',
    headline: 'Weekly Report & Audit Improvements',
    date: 'August 25, 2026',
    features: [
      {
        emoji: '📧',
        title: 'Weekly Management Report',
        description: 'Every Monday at 7 AM, active management users receive a project snapshot — monthly target pace with progress bars, executive summary, and current blockers. One email per project.',
        roles: ['management'],
      },
      {
        emoji: '🏠',
        title: 'Flat-Level Target Breakdown',
        description: 'Target Achievement now shows flat-level status counts (e.g. "7 flats not started") instead of individual activity counts — clearer at a glance.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '🔧',
        title: 'Delay Reason Fix',
        description: 'Delay reasons entered by supervisors for overdue not-started activities are now saved correctly and recorded in the audit log.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.25b',
    headline: 'Audit Log Search & Date Fix',
    date: 'August 25, 2026',
    features: [
      {
        emoji: '🔍',
        title: 'Audit Log Search',
        description: 'Search the audit log by supervisor name, activity, floor, flat, or status — find any change instantly.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '📅',
        title: 'Date Filter Fix',
        description: 'Date filters in the audit log now correctly match your local timezone — no more missing entries near midnight.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.25',
    headline: 'Tablet Optimization & Target Insights',
    date: 'August 25, 2026',
    features: [
      {
        emoji: '📱',
        title: 'Samsung Galaxy Tab Optimization',
        description: 'Supervisor app is now optimized for Samsung Galaxy Tab S10 FE 5G — wider layout, 3-column cards in landscape, larger touch targets, and better-spaced filters on tablet screens.',
        roles: ['supervisor'],
      },
      {
        emoji: '📊',
        title: 'Target Achievement Insights',
        description: 'Missed or at-risk targets now show activity status breakdowns (not started, in progress, on hold) and a smart explanation of why the target is behind — plus a quick link to the Fix This section for details.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '🔧',
        title: 'Fix This — Smarter Blockers',
        description: 'Blockers are now grouped by problem (stage + vendor) instead of individual floors — 22 floor cards become 3 actionable issue cards. Each card shows affected floors, flats impacted, and auto-links to the relevant target with status and deadline.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '⏸️',
        title: 'Bulk On Hold',
        description: 'Put entire flats or floors on hold with one tap — select activities, tap On Hold, pick a reason, done. Completed work stays untouched, in-progress activities show a warning before pausing.',
        roles: ['supervisor'],
      },
    ],
  },
  {
    version: '2026.08.24',
    headline: 'Smart Excel Re-upload',
    date: 'August 24, 2026',
    features: [
      {
        emoji: '🛡️',
        title: 'Smart Merge on Re-upload',
        description: 'Re-uploading an Excel template now protects supervisor work by default. Status changes, actual dates, remarks, and photos are preserved while template fields (vendor, expected dates) are updated.',
        roles: ['admin'],
      },
      {
        emoji: '⚙️',
        title: 'Upload Mode Selection',
        description: 'Choose between Smart Merge (default — protects supervisor work), Force Overwrite (replaces everything), or Delete All & Re-upload (clean slate) when re-uploading a template.',
        roles: ['admin'],
      },
      {
        emoji: '📊',
        title: 'Re-upload Impact Analysis',
        description: 'Before saving, see exactly how many activities will be added, updated, protected, or orphaned — with a detailed breakdown of which rows have supervisor work.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.22b',
    headline: 'Automated Daily Backups',
    date: 'August 22, 2026',
    features: [
      {
        emoji: '☁️',
        title: 'Daily Cloud Backup',
        description: 'All database tables and activity photos are now automatically backed up to Cloudflare R2 every night at 2:30 AM IST with 30-day retention.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.22a',
    headline: 'RCC Floor Handover Tracking',
    date: 'August 22, 2026',
    features: [
      {
        emoji: '🏗️',
        title: 'RCC Handover Dates',
        description: 'Track when each floor is handed over by the civil/RCC team. Enter planned and actual dates in Settings — status is auto-computed.',
        roles: ['admin'],
      },
      {
        emoji: '⚠️',
        title: 'Handover Alerts in Insights',
        description: 'Floors not yet handed over by RCC are highlighted in the stage drill-down with a red warning banner and planned date.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '🧹',
        title: 'Cleaner Settings Page',
        description: 'Removed Stage Weights configuration from Settings for a lighter, less cluttered page.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.21e',
    headline: 'Premium Visual Refresh',
    date: 'August 21, 2026',
    features: [
      {
        emoji: '✨',
        title: 'Professional Typography',
        description:
          'New DM Sans headings and Inter body text give the app a sharper, more polished look throughout.',
      },
      {
        emoji: '🎨',
        title: 'Warm, Refined Background',
        description:
          'The page background is now a warm neutral tone instead of cold blue-gray — easier on the eyes during long sessions.',
      },
      {
        emoji: '🏷️',
        title: 'Branded Favicon',
        description:
          'A new navy-and-gold "F" icon appears in your browser tab for quick identification.',
      },
      {
        emoji: '👁️',
        title: 'Better Text Contrast',
        description:
          'Faint gray text across the app has been darkened for WCAG AA readability — labels, subtitles, and metadata are all easier to read.',
      },
    ],
  },
  {
    version: '2026.08.21d',
    headline: 'Site Pulse Drill-Downs',
    date: 'August 21, 2026',
    features: [
      {
        emoji: '🔍',
        title: 'Weekly Completions Drill-Down',
        description:
          'Tap the weekly progress strip to see exactly which activities were completed — floor, flat, activity name, stage, and completion date.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '📊',
        title: 'Floor-Level Stage Progress',
        description:
          'Pending work now shows floor-level progress (e.g. 14/22 floors) instead of sub-stage totals — a floor counts as done only when all its sub-stages are complete.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.21',
    headline: 'UI Polish & Rate Limiting',
    date: 'August 21, 2026',
    features: [
      {
        emoji: '🎨',
        title: 'Improved Readability',
        description:
          'Text across the app is now larger and easier to read — sidebar labels, status badges, priority cards, and dashboard strips all got a bump.',
      },
      {
        emoji: '📱',
        title: 'Better Mobile Status Grid',
        description:
          'The floor-view status grid now wraps to two rows on mobile instead of cramming six columns into a narrow screen.',
        roles: ['supervisor'],
      },
      {
        emoji: '✨',
        title: 'Polished Empty States',
        description:
          'Empty-state screens now use clean SVG icons instead of emoji for a more professional look.',
        roles: ['supervisor'],
      },
      {
        emoji: '🛡️',
        title: 'API Rate Limiting',
        description:
          'Added two-layer rate limiting — a global ceiling at the proxy level and per-route limits — to protect against abuse.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.20b',
    headline: 'Bug Fixes & Assignment History',
    date: 'August 20, 2026',
    features: [
      {
        emoji: '🔧',
        title: 'Finishing Team Login Fix',
        description:
          'Finishing Team users now correctly land on the Admin Panel after logging in via the Head Office Portal.',
        roles: ['admin', 'finishing_team'],
      },
      {
        emoji: '📜',
        title: 'Supervisor Assignment History',
        description:
          'Track every floor assignment change — who was assigned, updated, or unassigned, when, and by whom. Click the clock icon on any supervisor row to view the timeline.',
        roles: ['admin', 'finishing_team'],
      },
      {
        emoji: '🔒',
        title: 'Role-Aware Login Routing',
        description:
          'Both login pages now detect your role and send you to the right place — no more landing on the wrong dashboard.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.20',
    headline: 'Finishing Team Role',
    date: 'August 20, 2026',
    features: [
      {
        emoji: '👥',
        title: 'New Finishing Team Role',
        description:
          'Admin can now create Finishing Team accounts with dedicated permissions — access to projects, supervisors, dashboard, photo review, insights, and exports.',
        roles: ['admin'],
      },
      {
        emoji: '🔑',
        title: 'Finishing Team Login',
        description:
          'Finishing Team members log in via the Head Office Portal and see all projects across the system.',
        roles: ['finishing_team'],
      },
      {
        emoji: '📧',
        title: 'Welcome Email for Finishing Team',
        description:
          'New Finishing Team users receive a branded welcome email with their login credentials.',
        roles: ['admin'],
      },
      {
        emoji: '✏️',
        title: 'Full Target Editing',
        description:
          'All target fields are now editable — stage, floor range, target date, and notes — directly from the Insights view.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.19b',
    headline: 'Smoother, Faster Experience',
    date: 'August 19, 2026',
    features: [
      {
        emoji: '📱',
        title: 'Load More Activities',
        description:
          'No more hidden activities — floors with 20+ items now show a "Load More" button so you can see every activity without filtering.',
        roles: ['supervisor'],
      },
      {
        emoji: '⚡',
        title: 'Quick Action Feedback',
        description:
          'Tapping Start or Complete now shows a spinner and success toast, so you always know the action went through. Double-tap protection prevents accidental duplicates.',
        roles: ['supervisor'],
      },
      {
        emoji: '🔄',
        title: 'Refresh & Photo Lightbox',
        description:
          'Tap the refresh icon to pull latest data instantly. Photo thumbnails now open full-size when tapped for easier inspection.',
        roles: ['supervisor'],
      },
      {
        emoji: '📌',
        title: 'Sidebar Memory',
        description:
          'The admin sidebar now remembers whether you collapsed or expanded it — no more re-collapsing every page load.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.19',
    headline: "Here's what's new in FinishPro",
    date: 'August 19, 2026',
    features: [
      {
        emoji: '🎯',
        title: 'Target Achievement',
        description:
          'Set monthly targets per stage and floor range from Settings, then track live achievement on the Insights page — circular progress rings, status badges (Achieved, At Risk, Missed), and delay reasons at a glance.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '⚙️',
        title: 'Target Setter in Settings',
        description:
          'Create, edit, and delete project targets from the Settings page. Supports non-contiguous floors by creating separate targets.',
        roles: ['admin'],
      },
      {
        emoji: '🎨',
        title: 'Refreshed Insights UI',
        description:
          'The Management Insights page now features a navy gradient header, colored percentage badges, and a more professional look across Pipeline, Site Pulse, and Fix This sections.',
        roles: ['admin', 'management'],
      },
      {
        emoji: '📧',
        title: 'Supervisor Inactivity Alerts',
        description:
          'A daily automated check detects supervisors who haven\'t updated any activity for 2+ days and sends an escalation email to all admins, with the inactive supervisors in CC.',
        roles: ['admin'],
      },
    ],
  },
  {
    version: '2026.08.18',
    headline: "Here's what's new in FinishPro",
    date: 'August 18, 2026',
    features: [
      {
        emoji: '✉️',
        title: 'Welcome Email',
        description:
          'New management users now receive a welcome email with their login credentials automatically when their account is created.',
        roles: ['admin'],
      },
      {
        emoji: '⚡',
        title: 'Faster Insights',
        description:
          'The Insights page now loads significantly faster — data is cached so returning visits are instant, and Operations data loads only when you need it.',
        roles: ['admin', 'management'],
      },
    ],
  },
  {
    version: '2026.08.16',
    headline: "Here's what's new in FinishPro",
    date: 'August 16, 2026',
    features: [
      {
        emoji: '🏗️',
        title: 'Site Command Center',
        description:
          'New KPI tiles showing Started, Completed, and In Progress activities. Click any tile to drill down to Floor → Activity → Unit level.',
        roles: ['admin'],
      },
      {
        emoji: '🔐',
        title: 'Forgot Password',
        description:
          'Supervisors and admins can now reset their password directly from the login page — no more manual resets.',
      },
      {
        emoji: '🔔',
        title: 'Status Reversal Alerts',
        description:
          'Admins automatically receive email and in-app notifications when a supervisor reverses an activity status.',
        roles: ['admin'],
      },
      {
        emoji: '📊',
        title: 'Supervisor Pulse',
        description:
          'Track how active each supervisor is — updates this week, last update time, and activity status at a glance.',
        roles: ['admin'],
      },
    ],
  },
];

/** The version string the modal checks against localStorage */
export const CURRENT_VERSION = CHANGELOG[0].version;

/** localStorage key */
export const WHATS_NEW_KEY = 'finishpro_whats_new_seen';

/**
 * Returns all changelog entries the user hasn't seen yet,
 * with features filtered to only those relevant to their role.
 * Entries with zero matching features are excluded.
 */
export function getUnseenEntries(
  lastSeenVersion: string | null,
  userRole: string
): ChangelogEntry[] {
  // Determine which entries are unseen
  let unseenEntries: ChangelogEntry[];

  if (!lastSeenVersion) {
    // First time ever — show only the latest entry
    unseenEntries = CHANGELOG.slice(0, 1);
  } else if (lastSeenVersion === CURRENT_VERSION) {
    // Already up to date
    return [];
  } else {
    const seenIdx = CHANGELOG.findIndex((e) => e.version === lastSeenVersion);
    if (seenIdx === -1) {
      // Version was removed or unrecognised — show only latest
      unseenEntries = CHANGELOG.slice(0, 1);
    } else {
      // Everything newer than the last seen version
      unseenEntries = CHANGELOG.slice(0, seenIdx);
    }
  }

  // Filter features by role
  return unseenEntries
    .map((entry) => ({
      ...entry,
      features: entry.features.filter(
        (f) =>
          !f.roles ||
          f.roles.length === 0 ||
          f.roles.includes(userRole as ChangelogRole)
      ),
    }))
    .filter((entry) => entry.features.length > 0);
}
