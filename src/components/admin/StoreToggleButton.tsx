'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/shared/Modal';
import { getActiveStores } from '@/repositories/store-repo';
import type { UnitStore } from '@/repositories/store-repo';
import { useAuth } from '@/lib/auth-context';

interface Props {
  projectId: string;
  /** Available floors from the project data */
  floors: number[];
  /** Available flats from the project data */
  flats: number[];
  /** Callback after store changes so parent can refresh data */
  onStoreChanged?: () => void;
}

export default function StoreToggleButton({ projectId, floors, flats, onStoreChanged }: Props) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [activeStores, setActiveStores] = useState<UnitStore[]>([]);
  const [loading, setLoading] = useState(false);

  // Mark form state
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('');
  const [selectedFlat, setSelectedFlat] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStores = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const stores = await getActiveStores(projectId);
      setActiveStores(stores);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [projectId]);

  // Load on mount so badge count is visible without opening modal
  useEffect(() => {
    loadStores();
  }, [loadStores]);

  // Reload when modal opens (in case stores changed elsewhere)
  useEffect(() => {
    if (showModal) {
      loadStores();
    }
  }, [showModal, loadStores]);

  const handleMark = async () => {
    if (selectedFloor === '' || selectedFlat === '') {
      setError('Please select both floor and flat number');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          floor: selectedFloor,
          flatNumber: selectedFlat,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to mark as store');
      } else {
        setSuccess(`F${selectedFloor}-${selectedFlat} marked as store`);
        setSelectedFloor('');
        setSelectedFlat('');
        setNotes('');
        loadStores();
        onStoreChanged?.();
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  const handleUnmark = async (storeId: string) => {
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (res.ok) {
        loadStores();
        onStoreChanged?.();
        setSuccess('Store cleared successfully');
      }
    } catch {
      /* ignore */
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
        title="Manage material stores"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
        <span className="hidden sm:inline">Stores</span>
        {activeStores.length > 0 && !showModal && (
          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums min-w-[18px] text-center">
            {activeStores.length}
          </span>
        )}
      </button>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setError('');
          setSuccess('');
          setSelectedFloor('');
          setSelectedFlat('');
          setNotes('');
        }}
        title="Manage Material Stores"
      >
        <div className="space-y-5">
          {/* Mark new store */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3">Mark Unit as Store</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                <select
                  value={selectedFloor}
                  onChange={e => setSelectedFloor(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select floor</option>
                  {floors.map(f => (
                    <option key={f} value={f}>Floor {f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Flat</label>
                <select
                  value={selectedFlat}
                  onChange={e => setSelectedFlat(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select flat</option>
                  {flats.map(f => (
                    <option key={f} value={f}>Flat {f}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Tiles and plumbing material"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              onClick={handleMark}
              disabled={saving || selectedFloor === '' || selectedFlat === ''}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Marking...' : 'Mark as Store'}
            </button>

            {error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {success}
              </div>
            )}
          </div>

          {/* Active stores */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">
              Active Stores
              {activeStores.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">({activeStores.length})</span>
              )}
            </h4>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeStores.length === 0 ? (
              <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg">
                No units currently marked as stores
              </div>
            ) : (
              <div className="space-y-2">
                {activeStores.map(store => (
                  <div key={store.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        F{store.floor}-{store.flatNumber}
                      </span>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Since {new Date(store.markedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {store.notes && <span className="text-gray-400"> · {store.notes}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnmark(store.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
