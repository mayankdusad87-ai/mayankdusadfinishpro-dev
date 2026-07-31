'use client';

import { memo } from 'react';
import { ActivityStatus } from '@/lib/types';

interface HealthScoreProps {
  total: number;
  completed: number;
  completedDelayed: number;
  inProgress: number;
  inProgressDelayed: number;
  onHold: number;
  notStarted: number;
  activeFilter: ActivityStatus | null;
  onFilterChange: (status: ActivityStatus | null) => void;
}

function computeHealth(props: HealthScoreProps) {
  const { total, completed, completedDelayed, inProgressDelayed, onHold } = props;
  if (total === 0) return { score: 0, progress: 0, onTime: 100, risk: 100 };

  const totalCompleted = completed + completedDelayed;
  const progress = (totalCompleted / total) * 100;
  const onTime = totalCompleted > 0 ? (completed / totalCompleted) * 100 : 100;
  const risk = 100 - ((inProgressDelayed + onHold) / total) * 100;

  const score = Math.round(progress * 0.4 + onTime * 0.3 + risk * 0.3);
  return { score, progress, onTime, risk };
}

function getScoreColor(score: number) {
  if (score >= 80) return { ring: 'text-green-500', bg: 'bg-green-50', label: 'Healthy', text: 'text-green-700' };
  if (score >= 60) return { ring: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Needs Attention', text: 'text-yellow-700' };
  if (score >= 40) return { ring: 'text-orange-500', bg: 'bg-orange-50', label: 'At Risk', text: 'text-orange-700' };
  return { ring: 'text-red-500', bg: 'bg-red-50', label: 'Critical', text: 'text-red-700' };
}

const STATUS_CHIPS: { key: ActivityStatus; label: string; dot: string }[] = [
  { key: 'not_started', label: 'Not Started', dot: 'bg-gray-400' },
  { key: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { key: 'completed', label: 'Completed', dot: 'bg-green-500' },
  { key: 'on_hold', label: 'On Hold', dot: 'bg-orange-500' },
];

function HealthScore(props: HealthScoreProps) {
  const { total, completed, completedDelayed, inProgress, inProgressDelayed, onHold, notStarted, activeFilter, onFilterChange } = props;
  const { score, progress, onTime, risk } = computeHealth(props);
  const colors = getScoreColor(score);

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  function getCount(key: ActivityStatus): number {
    if (key === 'not_started') return notStarted;
    if (key === 'in_progress') return inProgress + inProgressDelayed;
    if (key === 'completed') return completed + completedDelayed;
    if (key === 'on_hold') return onHold;
    return 0;
  }

  const factors = [
    { label: 'Progress', value: progress, desc: `${completed + completedDelayed} / ${total} done` },
    { label: 'On-Time', value: onTime, desc: totalCompletedLabel(completed, completedDelayed) },
    { label: 'Low Risk', value: risk, desc: `${inProgressDelayed + onHold} items at risk` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5">
        {/* Score Gauge */}
        <div className={`${colors.bg} rounded-xl p-5 flex items-center gap-5 min-w-[280px]`}>
          <div className="relative w-[128px] h-[128px] flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-200" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                className={colors.ring}
                style={{ strokeDasharray: circumference, strokeDashoffset, transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{score}</span>
              <span className="text-[11px] text-gray-500 font-medium">/ 100</span>
            </div>
          </div>
          <div>
            <div className={`text-sm font-bold ${colors.text}`}>{colors.label}</div>
            <div className="text-xs text-gray-500 mt-1">{total.toLocaleString()} total activities</div>
            <div className="mt-3 space-y-2">
              {factors.map(f => (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-gray-700">{f.label}</span>
                    <span className="text-gray-500">{f.value.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${f.value >= 80 ? 'bg-green-500' : f.value >= 60 ? 'bg-yellow-500' : f.value >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, f.value)}%`, transition: 'width 0.8s ease' }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status chips for filtering */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
          {STATUS_CHIPS.map(chip => {
            const count = getCount(chip.key);
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
            const isActive = activeFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => onFilterChange(isActive ? null : chip.key)}
                className={`bg-white rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                  isActive ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${chip.dot}`} />
                  <span className="text-[11px] font-medium text-gray-500">{chip.label}</span>
                </div>
                <div className="text-lg font-bold text-gray-900">{count.toLocaleString()}</div>
                <div className="text-[10px] text-gray-400">{pct}%</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function totalCompletedLabel(onTime: number, delayed: number): string {
  const total = onTime + delayed;
  if (total === 0) return 'No completions yet';
  if (delayed === 0) return `All ${total} on time`;
  return `${delayed} of ${total} were delayed`;
}

export default memo(HealthScore);
