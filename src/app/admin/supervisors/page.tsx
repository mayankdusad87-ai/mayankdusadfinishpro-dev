'use client';

import { useState } from 'react';
import SupervisorTable from '@/components/admin/SupervisorTable';
import SupervisorModal, { SupervisorFormData } from '@/components/admin/SupervisorModal';
import { supervisors as initialSupervisors, floorCoverage } from '@/lib/mock-data';
import { Supervisor } from '@/lib/types';

export default function SupervisorsPage() {
  const [supervisors] = useState<Supervisor[]>(initialSupervisors);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null);

  function handleAdd() {
    setEditingSupervisor(null);
    setModalOpen(true);
  }

  function handleEdit(supervisor: Supervisor) {
    setEditingSupervisor(supervisor);
    setModalOpen(true);
  }

  function handleDelete(supervisor: Supervisor) {
    alert(`Delete supervisor: ${supervisor.full_name} (demo only)`);
  }

  function handleSave(data: SupervisorFormData) {
    alert(`Saved supervisor: ${data.full_name} (demo only)`);
    setModalOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Supervisors</h1>
        <p className="mt-1 text-sm text-gray-500">Assign supervisors to projects and floors.</p>
      </div>

      <SupervisorTable
        supervisors={supervisors}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Floor Coverage Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Floor Coverage <span className="text-sm font-normal text-gray-500">(3rd – 18th Floor)</span>
          </h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Assigned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Multiple
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Unassigned
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {floorCoverage.map((floor) => (
            <div
              key={floor.floor_number}
              className="border border-gray-200 rounded-lg p-3 text-center"
            >
              <div className="text-sm font-semibold text-gray-900 mb-2">{floor.floor_label}</div>
              <div className="flex flex-wrap justify-center gap-1">
                {floor.supervisors.map((sup) => (
                  <span
                    key={sup.name}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: sup.color }}
                  >
                    {sup.name.split(' ')[0]}
                  </span>
                ))}
                {floor.supervisors.length > 1 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
                    +{floor.supervisors.length - 1}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Unassigned warning */}
        <div className="mt-4 flex items-center gap-2 text-sm text-orange-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          2 floors unassigned (1st, 2nd)
        </div>
      </div>

      <SupervisorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        supervisor={editingSupervisor}
        onSave={handleSave}
      />
    </div>
  );
}
