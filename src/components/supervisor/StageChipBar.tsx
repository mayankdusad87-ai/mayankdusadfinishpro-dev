'use client';

import { useState, memo } from 'react';

interface StageChipBarProps {
  stages: string[];
  stageCounts: Record<string, number>;
  totalCount: number;
  activeStage: string;
  onStageChange: (stage: string) => void;
}

function StageChipBar({
  stages,
  stageCounts,
  totalCount,
  activeStage,
  onStageChange,
}: StageChipBarProps) {
  const [expanded, setExpanded] = useState(false);

  function selectStage(stage: string) {
    onStageChange(stage);
    setExpanded(false);
  }

  /* Collapsed — single pill */
  if (!expanded) {
    return (
      <div className="flex items-center gap-2 mt-1.5 mb-0.5">
        <button
          onClick={() => setExpanded(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeStage
              ? 'bg-primary text-white'
              : 'bg-white/8 text-gray-300 hover:bg-white/12 border border-white/10'
          }`}
        >
          {activeStage ? (
            <>
              {activeStage}
              <span className="bg-white/20 rounded-full min-w-[18px] h-4 px-1.5 text-[10px] font-bold inline-flex items-center justify-center">
                {stageCounts[activeStage] || 0}
              </span>
            </>
          ) : (
            <>
              All stages
              <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </>
          )}
        </button>
        {activeStage && (
          <button
            onClick={() => onStageChange('')}
            className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  /* Expanded — scrollable chips */
  return (
    <div className="relative mt-1.5 mb-0.5">
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
        <button
          onClick={() => selectStage('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
            !activeStage ? 'bg-primary text-white' : 'bg-primary/10 text-primary border border-primary/20'
          }`}
        >
          All
          <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-4 rounded-full px-1 text-[10px] font-bold ${
            !activeStage ? 'bg-white/20' : 'bg-primary/15'
          }`}>
            {totalCount}
          </span>
        </button>
        {stages.map(stage => (
          <button
            key={stage}
            onClick={() => selectStage(stage)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
              activeStage === stage ? 'bg-primary text-white' : 'bg-primary/10 text-primary border border-primary/20'
            }`}
          >
            {stage}
            <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-4 rounded-full px-1 text-[10px] font-bold ${
              activeStage === stage ? 'bg-white/20' : 'bg-primary/15'
            }`}>
              {stageCounts[stage] || 0}
            </span>
          </button>
        ))}
      </div>
      {stages.length > 4 && (
        <div className="absolute right-0 top-0 bottom-1.5 w-8 bg-gradient-to-l from-navy-dark to-transparent pointer-events-none" />
      )}
    </div>
  );
}

export default memo(StageChipBar);
