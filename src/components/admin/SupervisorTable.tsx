'use client';

import { Supervisor } from '@/lib/types';

const statusStyles: Record<string, { bg: string; text: string }> = {
  'On Site': { bg: 'bg-green-100', text: 'text-green-700' },
  'Busy': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Inactive': { bg: 'bg-gray-100', text: 'text-gray-600' },
  'Suspended': { bg: 'bg-red-100', text: 'text-red-700' },
};

function relativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

interface SupervisorTableProps {
  supervisors: Supervisor[];
  onAdd: () => void;
  onEdit: (supervisor: Supervisor) => void;
  onDelete: (supervisor: Supervisor) => void;
}

export default function SupervisorTable({ supervisors, onAdd, onEdit, onDelete }: SupervisorTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Supervisors</h2>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Supervisor
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Project</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Assigned Floors</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Last Login</th>
              <th className="text-left px-5 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {supervisors.map((sup) => {
              const style = statusStyles[sup.status_label || 'Inactive'] || statusStyles['Inactive'];
              return (
                <tr key={sup.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{sup.full_name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sup.phone || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sup.email || '-'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{sup.project_name || '-'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {sup.assigned_floors.map((floor) => (
                        <span
                          key={floor}
                          className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-md"
                        >
                          {floor}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                      {sup.status_label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{relativeTime(sup.last_login_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(sup)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit supervisor"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDelete(sup)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete supervisor"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
  );
}
