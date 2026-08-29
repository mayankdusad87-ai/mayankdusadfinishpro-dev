'use client';

import { memo, useState } from 'react';
import type { UnitStore } from '@/repositories/store-repo';

interface Props {
  stores: UnitStore[];
  onUnmark?: (storeId: string) => Promise<void>;
  showActions?: boolean;
  compact?: boolean; // pill format for management view
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function MaterialStores({ stores, onUnmark, showActions = false, compact = false }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  const activeStores = stores.filter(s => s.unmarkedAt === null);
  const clearedStores = stores.filter(s => s.unmarkedAt !== null);

  // Compact colored-pill format for management view
  if (compact) {
    // Color-code pills based on notes/purpose
    const pillColor = (notes: string | null | undefined) => {
      const n = (notes || '').toLowerCase();
      if (n.includes('show flat') || n.includes('showflat') || n.includes('display'))
        return { bg: 'bg-emerald-50', border: 'border-emerald-200', unit: 'text-emerald-800', type: 'text-emerald-600' };
      if (n.includes('labour') || n.includes('labor') || n.includes('camp'))
        return { bg: 'bg-amber-50', border: 'border-amber-200', unit: 'text-amber-800', type: 'text-amber-600' };
      if (n.includes('godown') || n.includes('storage') || n.includes('store'))
        return { bg: 'bg-blue-50', border: 'border-blue-200', unit: 'text-blue-800', type: 'text-blue-600' };
      // Default
      return { bg: 'bg-gray-50', border: 'border-gray-200', unit: 'text-gray-800', type: 'text-gray-500' };
    };

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-200">
          <h4 className="text-sm font-bold text-gray-900">Material Stores</h4>
          <span className="text-xs text-gray-500">{activeStores.length} active location{activeStores.length !== 1 ? 's' : ''}</span>
        </div>
        {activeStores.length === 0 ? (
          <p className="text-sm text-gray-500 px-3.5 py-4">No units currently marked as stores</p>
        ) : (
          <div className="px-3.5 py-3 max-h-[200px] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeStores.map(store => {
                const c = pillColor(store.notes);
                return (
                  <div
                    key={store.id}
                    className={`flex flex-col items-center py-2 px-1.5 rounded-lg border ${c.bg} ${c.border}`}
                  >
                    <span className={`text-xs font-bold tabular-nums ${c.unit}`}>
                      F{store.floor}-{store.flatNumber}
                    </span>
                    {store.notes && (
                      <span className={`text-[10px] font-medium mt-0.5 ${c.type}`}>{store.notes}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleUnmark = async (storeId: string) => {
    if (!onUnmark) return;
    setClearing(storeId);
    try {
      await onUnmark(storeId);
    } finally {
      setClearing(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900">Material Stores</h3>
            <p className="text-xs text-gray-400">Units designated for material storage</p>
          </div>
        </div>
        {activeStores.length > 0 && (
          <span className="text-sm font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full tabular-nums">
            {activeStores.length} active
          </span>
        )}
      </div>

      {/* Active Stores */}
      {activeStores.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">No units currently marked as stores</p>
          <p className="text-xs text-gray-400 mt-1">Mark units from the Dashboard → Stores button</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeStores.map(store => (
            <div
              key={store.id}
              className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3.5"
            >
              {/* Unit + purpose as headline */}
              <div className="text-sm font-bold text-gray-900">
                F{store.floor}-{store.flatNumber}
                {store.notes && (
                  <span className="text-gray-600 font-semibold"> — {store.notes}</span>
                )}
              </div>

              {/* Date only */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <span>Marked {formatDate(store.markedAt)}</span>
              </div>

              {/* Clear button (admin only) */}
              {showActions && onUnmark && (
                <button
                  onClick={() => handleUnmark(store.id)}
                  disabled={clearing === store.id}
                  className="mt-3 w-full text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md py-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {clearing === store.id ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                      Clearing...
                    </span>
                  ) : (
                    'Clear Store'
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History Toggle */}
      {clearedStores.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-gray-500 font-medium hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            {showHistory ? 'Hide' : 'View'} cleared stores ({clearedStores.length})
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {clearedStores.map(store => (
                <div
                  key={store.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-500">
                      F{store.floor}-{store.flatNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-400">Cleared</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {formatDate(store.markedAt)} → {store.unmarkedAt ? formatDate(store.unmarkedAt) : '—'}
                    </div>
                    {store.unmarkedByName && (
                      <div className="text-[11px] text-gray-400">
                        cleared by {store.unmarkedByName}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(MaterialStores);
