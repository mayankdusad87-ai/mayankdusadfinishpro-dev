'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import { Supervisor } from '@/lib/types';
import { ManagedProject } from '@/lib/project-store';
import { getProjectsFromSupabase } from '@/lib/supabase-data';

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
  project: string;
  assigned_floors: number[];
  allow_vendor_reassignment: boolean;
}

const FLOORS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function SupervisorModal({ open, onClose, supervisor, onSave }: SupervisorModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [project, setProject] = useState('');
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  const [allowReassignment, setAllowReassignment] = useState(false);
  const [realProjects, setRealProjects] = useState<ManagedProject[]>([]);

  useEffect(() => {
    if (open) {
      getProjectsFromSupabase().then(list => {
        setRealProjects(list);
        if (!supervisor && list.length > 0 && !project) {
          setProject(list[0].name);
        }
      });
    }
  }, [open]);

  useEffect(() => {
    if (supervisor) {
      setName(supervisor.full_name);
      setPhone(supervisor.phone || '');
      setEmail(supervisor.email || '');
      setProject(supervisor.project_name || '');
      setSelectedFloors([...supervisor.assigned_floors]);
      setAllowReassignment(false);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setProject(realProjects.length > 0 ? realProjects[0].name : '');
      setSelectedFloors([]);
      setAllowReassignment(false);
    }
  }, [supervisor, open]);

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
      project,
      assigned_floors: selectedFloors.sort((a, b) => a - b),
      allow_vendor_reassignment: allowReassignment,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Add / Edit Supervisor" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit}>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-white"
              >
                {realProjects.length === 0 && (
                  <option value="">No projects — create one first</option>
                )}
                {realProjects.map((p) => (
                  <option key={p.id} value={p.name}>
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
                {FLOORS.map((floor) => {
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
                        className="accent-[#E67E22] w-4 h-4"
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
            className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
          >
            Save Supervisor
          </button>
        </div>
      </form>
    </Modal>
  );
}
