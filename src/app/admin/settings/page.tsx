'use client';

import { useState, useEffect, useCallback } from 'react';
import { getReasons, createReason, updateReason, deleteReason, Reason } from '@/lib/supabase-data';
import { getSupervisors, resetUserPassword } from '@/repositories/supervisor-repo';
import { getBackdateLimit, setBackdateLimit } from '@/repositories/settings-repo';
import { useDataLoader } from '@/hooks/use-data-loader';
import { useProject } from '@/lib/project-context';
import { useAuth } from '@/lib/auth-context';
import TargetSetter from '@/components/admin/TargetSetter';
import RccHandover from '@/components/admin/RccHandover';

export default function SettingsPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const { data: reasons, loading, refresh: loadReasons } = useDataLoader(() => getReasons(), [] as Reason[]);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setError('');
    const result = await createReason(newLabel.trim(), reasons.length + 1);
    if (result.error) {
      setError(result.error);
    } else {
      setNewLabel('');
      await loadReasons();
    }
  }

  async function handleToggleActive(reason: Reason) {
    const result = await updateReason(reason.id, { is_active: !reason.is_active });
    if (result.error) setError(result.error);
    else await loadReasons();
  }

  async function handleDelete(reason: Reason) {
    if (!confirm(`Delete "${reason.label}"? This cannot be undone.`)) return;
    const result = await deleteReason(reason.id);
    if (result.error) setError(result.error);
    else await loadReasons();
  }

  async function handleSaveEdit(id: string) {
    if (!editLabel.trim()) return;
    const result = await updateReason(id, { label: editLabel.trim() });
    if (result.error) setError(result.error);
    else {
      setEditingId(null);
      await loadReasons();
    }
  }

  // ---- Password Reset state ----
  const [supervisors, setSupervisors] = useState<Array<{ id: string; full_name: string; email: string | null }>>([]);
  const [supervisorsLoading, setSupervisorsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  // ---- Backdate limit state ----
  const [backdateDays, setBackdateDays] = useState(3);
  const [backdateInput, setBackdateInput] = useState('3');
  const [backdateSaving, setBackdateSaving] = useState(false);
  const [backdateMsg, setBackdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getBackdateLimit().then(days => {
      setBackdateDays(days);
      setBackdateInput(String(days));
    });
  }, []);

  async function handleSaveBackdateLimit() {
    const days = parseInt(backdateInput, 10);
    if (isNaN(days) || days < 1 || days > 30) {
      setBackdateMsg({ type: 'error', text: 'Enter a value between 1 and 30 days.' });
      return;
    }
    if (days === backdateDays) {
      setBackdateMsg({ type: 'error', text: 'No change to save.' });
      return;
    }
    setBackdateSaving(true);
    setBackdateMsg(null);
    try {
      await setBackdateLimit(days, user?.id || '');
      setBackdateDays(days);
      setBackdateMsg({ type: 'success', text: `Back-date limit updated from ${backdateDays} to ${days} days.` });
    } catch {
      setBackdateMsg({ type: 'error', text: 'Failed to save. Please try again.' });
    }
    setBackdateSaving(false);
  }

  // ---- Load supervisors + weights in parallel (single round-trip) ----
  const loadSupervisors = useCallback(async () => {
    setSupervisorsLoading(true);
    try {
      const data = await getSupervisors();
      setSupervisors(data.map(s => ({ id: s.id, full_name: s.full_name, email: s.email })));
    } catch {
      // ignore
    }
    setSupervisorsLoading(false);
  }, []);

  useEffect(() => { loadSupervisors(); }, [loadSupervisors]);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser || !newPassword || newPassword.length < 6) return;
    setResetting(true);
    setResetMsg(null);
    const { error: resetError } = await resetUserPassword(selectedUser, newPassword);
    if (resetError) {
      setResetMsg({ type: 'error', text: resetError });
    } else {
      const user = supervisors.find(s => s.id === selectedUser);
      setResetMsg({ type: 'success', text: `Password reset successfully for ${user?.full_name || 'user'}.` });
      setNewPassword('');
      setSelectedUser('');
    }
    setResetting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure global options used across all projects.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* Delay / On Hold Reasons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Delay / On Hold Reasons</h2>
          <p className="text-sm text-gray-500 mt-1">
            These appear as a dropdown for supervisors when they mark an activity as Delayed or On Hold.
            Supervisors can also select &ldquo;Other&rdquo; and type a custom remark.
          </p>
        </div>

        {/* Add new reason */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-5">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Material not available"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <button
            type="submit"
            disabled={!newLabel.trim()}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Reason
          </button>
        </form>

        {/* Reasons list */}
        {reasons.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No reasons configured yet. Add one above.
          </div>
        ) : (
          <div className="space-y-2">
            {reasons.map((reason, idx) => (
              <div
                key={reason.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                  reason.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <span className="text-xs text-gray-400 w-5">{idx + 1}.</span>

                {editingId === reason.id ? (
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(reason.id); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 px-2 py-1 border border-primary rounded text-sm focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className={`flex-1 text-sm ${reason.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                    {reason.label}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {editingId === reason.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(reason.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Save"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setEditingId(reason.id); setEditLabel(reason.label); }}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleActive(reason)}
                        className={`p-1.5 rounded-lg ${reason.is_active ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        title={reason.is_active ? 'Disable' : 'Enable'}
                      >
                        {reason.is_active ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(reason)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Supervisors will see these as a dropdown when marking activities as Delayed or On Hold.
          An &ldquo;Other&rdquo; option is always available — it enables a free-text remarks field.
        </div>
      </div>

      {/* ---- Project Targets ---- */}
      <TargetSetter />

      {/* ---- RCC Floor Handover ---- */}
      {currentProject && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <RccHandover projectId={currentProject.id} />
        </div>
      )}

      {/* ---- Data Entry Settings ---- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Data Entry Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control how far back supervisors can update activity entries. Admins are not restricted.
          </p>
        </div>

        {backdateMsg && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${backdateMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {backdateMsg.text}
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Back-date limit (days)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={backdateInput}
              onChange={e => { setBackdateInput(e.target.value); setBackdateMsg(null); }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <button
            onClick={handleSaveBackdateLimit}
            disabled={backdateSaving}
            className="px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {backdateSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Supervisors can only select actual start / end dates within the last <strong>{backdateDays} days</strong>.
            Dates older than this limit will be blocked in the date picker. Every change to this setting is logged with the admin who made it.
          </span>
        </div>
      </div>

      {/* ---- Reset User Password ---- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Reset User Password</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a supervisor and set a new password. The supervisor will need to use the new password on next login.
          </p>
        </div>

        {supervisorsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : supervisors.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No supervisors found.
          </div>
        ) : (
          <>
            {resetMsg && (
              <div className={`mb-4 rounded-lg p-3 text-sm ${resetMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {resetMsg.text}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select User</label>
                <select
                  value={selectedUser}
                  onChange={(e) => { setSelectedUser(e.target.value); setResetMsg(null); }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">Choose a supervisor...</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{s.email ? ` (${s.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setResetMsg(null); }}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {newPassword && newPassword.length < 6 && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedUser || !newPassword || newPassword.length < 6 || resetting}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>

            <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
              <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              The new password is set immediately. Inform the supervisor of their new password — there is no email notification sent.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
