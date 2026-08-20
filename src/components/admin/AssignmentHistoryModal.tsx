'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import { getAssignmentHistory } from '@/repositories/assignment-history-repo';
import type { AssignmentHistoryEntry } from '@/repositories/assignment-history-repo';

interface Props {
  open: boolean;
  onClose: () => void;
  supervisorId: string;
  supervisorName: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  assigned: { label: 'Assigned', color: 'bg-green-100 text-green-700' },
  updated: { label: 'Updated', color: 'bg-blue-100 text-blue-700' },
  unassigned: { label: 'Unassigned', color: 'bg-red-100 text-red-700' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function FloorBadges({ floors, label }: { floors: number[] | null; label?: string }) {
  if (!floors || floors.length === 0) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {label && <span className="text-xs text-gray-400 mr-0.5">{label}</span>}
      {floors.map(f => (
        <span key={f} className="inline-flex items-center justify-center min-w-[24px] px-1 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded">
          {f}
        </span>
      ))}
    </div>
  );
}

export default function AssignmentHistoryModal({ open, onClose, supervisorId, supervisorName }: Props) {
  const [history, setHistory] = useState<AssignmentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supervisorId) return;
    let cancelled = false;
    setLoading(true);
    getAssignmentHistory({ supervisorId })
      .then(data => { if (!cancelled) setHistory(data); })
      .catch(() => { if (!cancelled) setHistory([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, supervisorId]);

  return (
    <Modal open={open} onClose={onClose} title={`Assignment History — ${supervisorName}`} maxWidth="max-w-xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <p className="text-center text-gray-400 py-10 text-sm">
          No assignment history recorded yet.
        </p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-200" />

          <div className="space-y-4">
            {history.map((entry) => {
              const info = ACTION_LABELS[entry.action] || ACTION_LABELS.assigned;
              return (
                <div key={entry.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className="absolute left-[10px] top-1.5 w-[11px] h-[11px] rounded-full border-2 border-white bg-gray-300 ring-2 ring-gray-200" />

                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
                        {info.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(entry.created_at)} · {formatTime(entry.created_at)}
                      </span>
                    </div>

                    <p className="text-gray-700 text-sm mb-1">
                      <span className="font-medium">{entry.project_name}</span>
                    </p>

                    {entry.action === 'updated' && entry.previous_floors && entry.assigned_floors ? (
                      <div className="space-y-1">
                        <FloorBadges floors={entry.previous_floors} label="From:" />
                        <FloorBadges floors={entry.assigned_floors} label="To:" />
                      </div>
                    ) : (
                      <FloorBadges floors={entry.assigned_floors || entry.previous_floors} label="Floors:" />
                    )}

                    <p className="text-xs text-gray-400 mt-1.5">
                      By {entry.performed_by_name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
