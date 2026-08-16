/**
 * What's New — code-managed changelog entries.
 *
 * To announce new features:
 *  1. Add a new entry at the TOP of the CHANGELOG array
 *  2. Give it a unique `version` string (use date: "2026.08.16")
 *  3. Update CURRENT_VERSION to match
 *  4. Deploy — every user sees the modal once
 *
 * The modal compares CURRENT_VERSION against localStorage.
 * Users who have already seen this version won't see it again.
 */

export interface ChangelogFeature {
  emoji: string;
  title: string;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  headline: string;
  date: string;
  features: ChangelogFeature[];
}

// Newest entry first — the modal always shows CHANGELOG[0]
export const CHANGELOG: ChangelogEntry[] = [
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
      },
      {
        emoji: '📊',
        title: 'Supervisor Pulse',
        description:
          'Track how active each supervisor is — updates this week, last update time, and activity status at a glance.',
      },
    ],
  },
];

/** The version string the modal checks against localStorage */
export const CURRENT_VERSION = CHANGELOG[0].version;

/** localStorage key */
export const WHATS_NEW_KEY = 'finishpro_whats_new_seen';
