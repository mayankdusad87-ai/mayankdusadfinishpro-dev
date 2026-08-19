'use client';

import { useState, useEffect } from 'react';
import {
  CURRENT_VERSION,
  WHATS_NEW_KEY,
  getUnseenEntries,
  type ChangelogEntry,
} from '@/lib/changelog';
import { useAuth } from '@/lib/auth-context';

export default function WhatsNewModal() {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.role) return;

    try {
      const seen = localStorage.getItem(WHATS_NEW_KEY);
      const unseen = getUnseenEntries(seen, profile.role);

      if (unseen.length > 0) {
        setEntries(unseen);
        // Small delay so the page finishes loading first
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage blocked — skip silently
    }
  }, [profile?.role]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(WHATS_NEW_KEY, CURRENT_VERSION);
    } catch {
      // localStorage blocked — skip
    }
  }

  if (!visible || entries.length === 0) return null;

  const isSingleEntry = entries.length === 1;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-[slideUp_300ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-[#162032] via-[#1a2840] to-[#0f1825]">
          {/* Decorative dots */}
          <div className="absolute top-3 right-3 flex gap-1.5 opacity-30">
            <span className="w-2 h-2 rounded-full bg-white/40" />
            <span className="w-2 h-2 rounded-full bg-white/30" />
            <span className="w-2 h-2 rounded-full bg-white/20" />
          </div>

          {/* Sparkle icon */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C8922A] to-[#e5aa3a] flex items-center justify-center mb-4 shadow-lg shadow-[#C8922A]/20">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white leading-tight">
            {isSingleEntry ? entries[0].headline : "What's New in FinishPro"}
          </h2>
          <p className="text-sm text-white/50 mt-1 font-medium">
            {isSingleEntry
              ? entries[0].date
              : `${entries[entries.length - 1].date} — ${entries[0].date}`}
          </p>
          {!isSingleEntry && (
            <p className="text-xs text-white/35 mt-1">
              You missed {entries.length} updates — here's what changed
            </p>
          )}
        </div>

        {/* Features list */}
        <div className="px-6 py-5 space-y-5 max-h-[50vh] overflow-y-auto">
          {entries.map((entry, entryIdx) => (
            <div key={entry.version}>
              {/* Section header for multi-entry view */}
              {!isSingleEntry && (
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {entry.headline}
                  </h3>
                  <span className="text-[10px] text-gray-300 font-medium">
                    {entry.date}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}

              {/* Features */}
              <div className="space-y-4">
                {entry.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-lg shrink-0">
                      {feature.emoji}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h3 className="text-sm font-bold text-gray-900 leading-snug">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider between entries (not after last) */}
              {!isSingleEntry && entryIdx < entries.length - 1 && (
                <div className="mt-5" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all cursor-pointer bg-gradient-to-r from-[#162032] to-[#1e2d45] hover:from-[#1e2d45] hover:to-[#283a55] active:scale-[0.98] shadow-lg shadow-[#162032]/20"
          >
            Got it
          </button>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
