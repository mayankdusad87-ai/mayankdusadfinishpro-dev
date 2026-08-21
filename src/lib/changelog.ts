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
