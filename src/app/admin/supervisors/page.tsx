'use client';

import { useState, useEffect, useCallback } from 'react';
import SupervisorModal, { SupervisorFormData } from '@/components/admin/SupervisorModal';
import {
  getSupervisors,
  createSupervisor,
  deactivateSupervisor,
  resetUserPassword,
  assignSupervisorToProject,
} from '@/lib/supabase-data';

interface SupervisorRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export default function SupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SupervisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<SupervisorRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<SupervisorRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const loadSupervisors = useCallback(async () => {
    try {
      const list = await getSupervisors();
      setSupervisors(list);
    } catch {
      setError('Failed to load supervisors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisors();
  }, [loadSupervisors]);

  function handleAdd() {
    setEditingSupervisor(null);
    setError('');
    setModalOpen(true);
  }

  function handleEdit(sup: SupervisorRow) {
    setEditingSupervisor(sup);
    setError('');
    setModalOpen(true);
  }

  async function handleSave(data: SupervisorFormData) {
    setSaving(true);
    setError('');
    try {
      if (editingSupervisor) {
        if (data.project_id && data.assigned_floors.length > 0) {
          await assignSupervisorToProject(editingSupervisor.id, data.project_id, data.assigned_floors);
        }
      } else {
        const result = await createSupervisor(data.email, data.password!, data.full_name, data.phone);
        if (result.error) {
          setError(result.error);
          setSaving(false);
          return;
        }
        if (result.userId && data.project_id && data.assigned_floors.length > 0) {
          await assignSupervisorToProject(result.userId, data.project_id, data.assigned_floors);
        }
      }
      setModalOpen(false);
      await loadSupervisors();
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || 'Failed to save supervisor');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(sup: SupervisorRow) {
    const action = sup.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${sup.full_name}?`)) return;
    const result = await deactivateSupervisor(sup.id, !sup.is_active);
    if (result.error) {
      setError(result.error);
    } else {
      await loadSupervisors();
    }
  }

  function openResetPassword(sup: SupervisorRow) {
    setResetTarget(sup);
    setNewPassword('');
    setResetError('');
    setResetSuccess('');
    setResetModalOpen(true);
  }

  async function handleResetPassword() {
    if (!resetTarget || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    const result = await resetUserPassword(resetTarget.id, newPassword);
    if (result.error) {
      setResetError(result.error);
    } else {
      setResetSuccess(`Password reset for ${resetTarget.full_name}`);
      setTimeout(() => setResetModalOpen(false), 1500);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Supervisors</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create supervisor accounts, assign to projects & floors.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Supervisor
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                    No supervisors yet. Click &ldquo;Add Supervisor&rdquo; to create one.
                  </td>
                </tr>
              )}
              {supervisors.map((sup) => (
                <tr key={sup.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{sup.full_name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sup.email || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sup.phone || '-'}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sup.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {sup.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(sup)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit / Assign floors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openResetPassword(sup)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Reset password"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleActive(sup)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          sup.is_active
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={sup.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {sup.is_active ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Modal */}
      <SupervisorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setError(''); }}
        supervisor={editingSupervisor ? {
          id: editingSupervisor.id,
          tenant_id: '',
          role: 'supervisor',
          full_name: editingSupervisor.full_name,
          email: editingSupervisor.email || undefined,
          phone: editingSupervisor.phone || undefined,
          is_active: editingSupervisor.is_active,
          assigned_projects: [],
          assigned_floors: [],
        } : null}
        onSave={handleSave}
      />
      {saving && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-700">Saving supervisor...</span>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Reset Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              Set a new password for {resetTarget?.full_name}
            </p>
            {resetError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 mb-3">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700 mb-3">
                {resetSuccess}
              </div>
            )}
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
