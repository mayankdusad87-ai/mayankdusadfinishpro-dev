'use client';

import { ActivityStatus } from '@/lib/types';

interface StatusCardsProps {
  counts: {
    total: number;
    not_started: number;
    in_progress: number;
    completed: number;
    delayed: number;
    on_hold: number;
  };
  activeFilter: ActivityStatus | null;
  onFilterChange: (status: ActivityStatus | null) => void;
}

interface CardConfig {
  key: ActivityStatus | 'total';
  label: string;
  icon: React.ReactNode;
  iconBg: string;
}

export default function StatusCards({ counts, activeFilter, onFilterChange }: StatusCardsProps) {
  const cards: CardConfig[] = [
    {
      key: 'total',
      label: 'Total Activities',
      iconBg: 'bg-gray-100',
      icon: (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      key: 'not_started',
      label: 'Not Started',
      iconBg: 'bg-gray-100',
      icon: (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
        </svg>
      ),
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      iconBg: 'bg-blue-50',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.5} strokeDasharray="40 16" />
        </svg>
      ),
    },
    {
      key: 'completed',
      label: 'Completed',
      iconBg: 'bg-green-50',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      key: 'delayed',
      label: 'Delayed',
      iconBg: 'bg-red-50',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.59A1 1 0 0120.66 21H3.34a1 1 0 01-.87-1.41L12 3z" />
        </svg>
      ),
    },
    {
      key: 'on_hold',
      label: 'On Hold',
      iconBg: 'bg-orange-50',
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
        </svg>
      ),
    },
  ];

  function getCount(key: ActivityStatus | 'total'): number {
    if (key === 'total') return counts.total;
    return counts[key];
  }

  function handleClick(key: ActivityStatus | 'total') {
    if (key === 'total') {
      onFilterChange(null);
    } else {
      onFilterChange(activeFilter === key ? null : key);
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const isActive =
          (card.key === 'total' && activeFilter === null) ||
          activeFilter === card.key;

        return (
          <button
            key={card.key}
            onClick={() => handleClick(card.key)}
            className={`bg-white rounded-lg shadow-sm p-4 text-left transition-all hover:shadow-md cursor-pointer ${
              isActive ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                {card.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {getCount(card.key).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{card.label}</span>
              {card.key !== 'total' && counts.total > 0 && (
                <span className="text-xs text-gray-400">
                  {((getCount(card.key) / counts.total) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
