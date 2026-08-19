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
export type ChangelogRole = 'supervisor' | 'admin' | 'management';

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
