'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/shared/Modal';
import { Supervisor } from '@/lib/types';
import { ManagedProject } from '@/lib/project-store';
import { getProjectsFromSupabase, getProjectFloors, getSupervisorAssignments } from '@/lib/supabase-data';

interface SupervisorModalProps {
  open: boolean;
  onClose: () => void;
  supervisor?: Supervisor | null;
  onSave: (data: SupervisorFormData) => void;
}

export interface SupervisorFormData {
  full_name: string;
  phone: string;
  email: string;
  password?: string;
  project_id: string;
  assigned_floors: number[];
  allow_vendor_reassignment: boolean;
  /** True when editing and the project was changed (transfer) */
  isProjectTransfer?: boolean;
  /** Name of the old project (for confirmation dialog) */
  oldProjectName?: string;
  /** Floors on the old project (for confirmation dialog) */
  oldFloors?: number[];
}

export default function SupervisorModal({ open, onClose, supervisor, onSave }: SupervisorModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  const [allowReassignment, setAllowReassignment] = useState(false);
  const [realProjects, setRealProjects] = useState<ManagedProject[]>([]);
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);
  const isEditing = !!supervisor;

  // Track original project for detecting transfers
  const originalProjectId = useRef<string>('');
  const originalFloors = useRef<number[]>([]);

  const isProjectTransfer = isEditing && originalProjectId.current !== '' && projectId !== originalProjectId.current;

  // Get project name by ID
  function getProjectName(pid: string): string {
    const p = realProjects.find(pr => pr.id === pid);
    return p ? `${p.name} — ${p.location}` : 'Unknown';
  }

  useEffect(() => {
    if (!open) return;
    getProjectsFromSupabase().then(async (list) => {
      setRealProjects(list);
      if (supervisor) {
        setName(supervisor.full_name);
        setPhone(supervisor.phone || '');
        setEmail(supervisor.email || '');
        setPassword('');
        setAllowReassignment(false);
        const assignments = await getSupervisorAssignments(supervisor.id || '');
        if (assignments.length > 0) {
          setProjectId(assignments[0].project_id);
          setSelectedFloors(assignments[0].assigned_floors || []);
          originalProjectId.current = assignments[0].project_id;
          originalFloors.current = assignments[0].assigned_floors || [];
        } else if (list.length > 0) {
          setProjectId(list[0].id);
          setSelectedFloors([]);
          originalProjectId.current = '';
          originalFloors.current = [];
        }
      } else {
        setName('');
        setPhone('');
        setEmail('');
        setPassword('');
        setProjectId(list.length > 0 ? list[0].id : '');
        setSelectedFloors([]);
        setAllowReassignment(false);
        originalProjectId.current = '';
        originalFloors.current = [];
      }
    });
  }, [supervisor, open]);

  useEffect(() => {
    if (projectId) {
      getProjectFloors(projectId).then(setAvailableFloors);
    } else {
      setAvailableFloors([]);
    }
  }, [projectId]);

  function handleProjectChange(newProjectId: string) {
    setProjectId(newProjectId);
    // Clear floor selections when project changes (floors belong to the project)
    if (newProjectId !== originalProjectId.current) {
      setSelectedFloors([]);
    } else {
      // Switching back to original project — restore original floors
      setSelectedFloors(originalFloors.current);
    }
  }

  function toggleFloor(floor: number) {
    setSelectedFloors((prev) =>
      prev.includes(floor) ? prev.filter((f) => f !== floor) : [...prev, floor]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      full_name: name,
      phone,
      email,
      password: isEditing ? undefined : password,
      project_id: projectId,
      assigned_floors: selectedFloors.sort((a, b) => a - b),
      allow_vendor_reassignment: allowReassignment,
      isProjectTransfer,
      oldProjectName: isProjectTransfer ? getProjectName(originalProjectId.current) : undefined,
      oldFloors: isProjectTransfer ? originalFloors.current : undefined,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add / Edit Supervisor" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit}>
        {/* Project transfer warning banner */}
        {isProjectTransfer && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-amber-800">Project Transfer</p>
              <p className="text-amber-700 mt-0.5">
                This will remove <strong>{supervisor?.full_name}</strong> from{' '}
                <strong>{getProjectName(originalProjectId.current)}</strong>{' '}
                (Floors {originalFloors.current.join(', ')}). Those floors will have no supervisor until reassigned.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971 55 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            {!isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required={!isEditing}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">Supervisor will use this to log in</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white ${
                  isProjectTransfer ? 'border-amber-400' : 'border-gray-300'
                }`}
              >
                {realProjects.length === 0 && (
                  <option value="">No projects — create one first</option>
                )}
                {realProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.location}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Floors (Select one or more) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1">
                {availableFloors.length === 0 && (
                  <p className="col-span-3 text-sm text-gray-400 py-4 text-center">Upload a template for this project first</p>
                )}
                {availableFloors.map((floor) => {
                  const checked = selectedFloors.includes(floor);
                  return (
                    <label
                      key={floor}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'border-primary bg-orange-50 text-primary-dark'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFloor(floor)}
                        className="accent-[#C8922A] w-4 h-4"
                      />
                      Floor {floor}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Vendor reassignment toggle */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-700">Allow vendor reassignment</span>
              <button
                type="button"
                role="switch"
                aria-checked={allowReassignment}
                onClick={() => setAllowReassignment(!allowReassignment)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  allowReassignment ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                    allowReassignment ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Info text */}
            <p className="text-xs text-gray-500 flex items-start gap-1.5 mt-1">
              <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              A floor can be assigned to more than one supervisor for redundancy
            </p>
          </div>
        </div>

        {/* Floor validation warning */}
        {availableFloors.length > 0 && selectedFloors.length === 0 && (
          <p className="text-sm text-red-600 mt-4 flex items-center gap-1.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Select at least one floor before saving.
          </p>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={selectedFloors.length === 0}
            className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              selectedFloors.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : isProjectTransfer
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {isProjectTransfer ? 'Transfer & Save' : 'Save Supervisor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
