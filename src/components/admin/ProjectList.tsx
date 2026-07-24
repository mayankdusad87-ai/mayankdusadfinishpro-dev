'use client';

import { useState } from 'react';
import { projects, floorsConfig } from '@/lib/mock-data';
import Modal from '@/components/shared/Modal';
import ProjectConfigModal from './ProjectConfigModal';

type ProjectDisplayStatus = 'not_started' | 'in_progress' | 'on_track' | 'at_risk' | 'delayed';

const displayStatusConfig: Record<ProjectDisplayStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  on_track: { label: 'On Track', bg: 'bg-green-100', text: 'text-green-700' },
  at_risk: { label: 'At Risk', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  delayed: { label: 'Delayed', bg: 'bg-red-100', text: 'text-red-700' },
};

const projectDisplayStatuses: ProjectDisplayStatus[] = [
  'on_track',
  'in_progress',
  'at_risk',
  'delayed',
  'not_started',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProjectList() {
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<typeof projects[0] | null>(null);

  function openConfig(project: typeof projects[0]) {
    setSelectedProject(project);
    setConfigModalOpen(true);
  }

  function closeConfig() {
    setConfigModalOpen(false);
    setSelectedProject(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Projects</h1>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Project Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Location</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Total Floors</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Total Flats</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-600">Created Date</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-600">Configure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((project, idx) => {
                const displayStatus = projectDisplayStatuses[idx % projectDisplayStatuses.length];
                const statusCfg = displayStatusConfig[displayStatus];
                return (
                  <tr
                    key={project.id}
                    onClick={() => openConfig(project)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4 font-medium text-gray-900">{project.name}</td>
                    <td className="px-5 py-4 text-gray-600">{project.location}</td>
                    <td className="px-5 py-4 text-center text-gray-700">{project.total_floors}</td>
                    <td className="px-5 py-4 text-center text-gray-700">{project.total_flats}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(project.created_at)}</td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfig(project);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                        aria-label={`Configure ${project.name}`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure Project Modal */}
      {selectedProject && (
        <Modal
          open={configModalOpen}
          onClose={closeConfig}
          title={`Configure Project: ${selectedProject.name}`}
          maxWidth="max-w-5xl"
        >
          <ProjectConfigModal project={selectedProject} onClose={closeConfig} />
        </Modal>
      )}
    </div>
  );
}
