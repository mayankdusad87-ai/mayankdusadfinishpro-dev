'use client';

import { useState, useEffect } from 'react';
import { ManagedProject, generateProjectId } from '@/lib/project-store';
import { useProject } from '@/lib/project-context';
import { getProjectsFromSupabase, saveProjectToSupabase, deleteProjectFromSupabase } from '@/lib/supabase-data';
import { useAuth } from '@/lib/auth-context';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: 'Completed', bg: 'bg-blue-100', text: 'text-blue-700' },
  on_hold: { label: 'On Hold', bg: 'bg-orange-100', text: 'text-orange-700' },
};

export default function ProjectList() {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<ManagedProject | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [totalFlats, setTotalFlats] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { refreshProjects } = useProject();
  const { user } = useAuth();

  async function loadProjects() {
    try {
      const list = await getProjectsFromSupabase();
      setProjects(list);
    } catch {
      setProjects([]);
    }
  }

  useEffect(() => { loadProjects(); }, []);

  function openNew() {
    setEditProject(null);
    setName('');
    setLocation('');
    setTotalFloors('');
    setTotalFlats('');
    setShowForm(true);
  }

  function openEdit(p: ManagedProject) {
    setEditProject(p);
    setName(p.name);
    setLocation(p.location);
    setTotalFloors(String(p.totalFloors));
    setTotalFlats(String(p.totalFlats));
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim() || !location.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      const project: ManagedProject = {
        id: editProject?.id || generateProjectId(),
        name: name.trim(),
        location: location.trim(),
        status: editProject?.status || 'active',
        totalFloors: parseInt(totalFloors) || 0,
        totalFlats: parseInt(totalFlats) || 0,
        createdAt: editProject?.createdAt || new Date().toISOString(),
        hasTemplate: editProject?.hasTemplate || false,
      };
      const savedId = await saveProjectToSupabase(project, user?.id);
      project.id = savedId;
      await loadProjects();
      await refreshProjects();
      setShowForm(false);
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      const msg = e?.message || e?.details || 'Failed to save project';
      setFormError(msg + (e?.hint ? ` (${e.hint})` : '') + (e?.code ? ` [${e.code}]` : ''));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: ManagedProject) {
    if (!confirm(`Delete project "${p.name}"? This will also remove any uploaded template data.`)) return;
    await deleteProjectFromSupabase(p.id);
    await loadProjects();
    await refreshProjects();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Projects</h1>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {projects.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first project to start uploading templates and tracking progress.</p>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create First Project
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Project Name</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Location</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Floors</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Flats</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Status</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Template</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Created</th>
                  <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map(p => {
                  const sc = STATUS_CONFIG[p.status];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-gray-900">{p.name}</td>
                      <td className="px-5 py-4 text-gray-600">{p.location}</td>
                      <td className="px-5 py-4 text-center text-gray-700">{p.totalFloors || '-'}</td>
                      <td className="px-5 py-4 text-center text-gray-700">{p.totalFlats || '-'}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.bg} ${sc.text}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {p.hasTemplate ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not uploaded</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-600">{formatDate(p.createdAt)}</td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-primary"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Project Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {editProject ? 'Edit Project' : 'Create New Project'}
            </h2>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {formError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ananta Tower A"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Pune, Maharashtra"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Floors</label>
                  <input
                    type="number"
                    value={totalFloors}
                    onChange={e => setTotalFloors(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Flats</label>
                  <input
                    type="number"
                    value={totalFlats}
                    onChange={e => setTotalFlats(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || !location.trim() || saving}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editProject ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
