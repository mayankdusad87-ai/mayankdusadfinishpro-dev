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
    version: '2026.08.19',
    headline: "Here's what's new in FinishPro",
    date: 'August 19, 2026',
    features: [
      {
        emoji: '🎯',
        title: 'Target Achievement',
        description:
          'Set monthly targets per stage and floor range from Settings, then track live achievement on the Insights page — circular progress rings, status badges (Achieved, At Risk, Missed), and delay reasons at a glance.',
      },
      {
        emoji: '⚙️',
        title: 'Target Setter in Settings',
        description:
          'Admins can create, edit, and delete project targets from the Settings page. Supports non-contiguous floors by creating separate targets.',
      },
      {
        emoji: '🎨',
        title: 'Refreshed Insights UI',
        description:
          'The Management Insights page now features a navy gradient header, colored percentage badges, and a more professional look across Pipeline, Site Pulse, and Fix This sections.',
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
      },
      {
        emoji: '⚡',
        title: 'Faster Insights',
        description:
          'The Insights page now loads significantly faster — data is cached so returning visits are instant, and Operations data loads only when you need it.',
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
