'use client';

import { ActivityStatus } from '@/lib/types';

const statusConfig: Record<ActivityStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  delayed: { label: 'Delayed', bg: 'bg-red-100', text: 'text-red-700' },
  on_hold: { label: 'On Hold', bg: 'bg-orange-100', text: 'text-orange-700' },
};

export default function StatusPill({ status, size = 'sm' }: { status: ActivityStatus; size?: 'sm' | 'md' }) {
  const config = statusConfig[status];
  const sizeClass = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClass}`}>
      {config.label}
    </span>
  );
}
