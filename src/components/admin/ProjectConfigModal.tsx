'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import ExcelUpload from '@/components/admin/ExcelUpload';

type ConfigTab = 'floors' | 'stages' | 'stage_gates' | 'activities' | 'rooms';

const tabs: { key: ConfigTab; label: string; disabled?: boolean; badge?: string }[] = [
  { key: 'floors', label: 'Floors & Flats' },
  { key: 'stages', label: 'Stages' },
  { key: 'stage_gates', label: 'Stage Gates' },
  { key: 'activities', label: 'Finishing Activities' },
  { key: 'rooms', label: 'Room / Location', disabled: true, badge: 'Coming in v2' },
];

interface ProjectConfigModalProps {
  project: Project;
  onClose: () => void;
}

interface FloorSummary {
  floor: number;
  flats: number[];
  configurations: string[];
}

export default function ProjectConfigModal({ project, onClose }: ProjectConfigModalProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('floors');

  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
        <span className="text-primary font-medium">Project</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        <span>Stage</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        <span>Stage Gate</span>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        <span>Activity</span>
      </nav>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && setActiveTab(tab.key)}
            disabled={tab.disabled}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : tab.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.badge && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">{tab.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'floors' && <FloorsFlatsTab projectId={project.id} />}
      {activeTab === 'stages' && <StagesTab projectId={project.id} />}
      {activeTab === 'stage_gates' && <StageGatesTab projectId={project.id} />}
      {activeTab === 'activities' && <ExcelUpload />}
      {activeTab === 'rooms' && <RoomLocationTab onClose={onClose} />}
    </div>
  );
}

function FloorsFlatsTab({ projectId }: { projectId: string }) {
  const [floors, setFloors] = useState<FloorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('activities')
        .select('floor, flat_number, configuration')
        .eq('project_id', projectId);
      if (!data) { setLoading(false); return; }

      const map = new Map<number, { flats: Set<number>; configs: Set<string> }>();
      for (const row of data) {
        let entry = map.get(row.floor);
        if (!entry) { entry = { flats: new Set(), configs: new Set() }; map.set(row.floor, entry); }
        entry.flats.add(row.flat_number);
        if (row.configuration) entry.configs.add(row.configuration);
      }

      const result: FloorSummary[] = [...map.entries()]
        .sort(([a], [b]) => a - b)
        .map(([floor, entry]) => ({
          floor,
          flats: [...entry.flats].sort((a, b) => a - b),
          configurations: [...entry.configs].sort(),
        }));

      setFloors(result);
      setLoading(false);
    }
    load();
  }, [projectId]);

  const totalFlats = floors.reduce((sum, f) => sum + f.flats.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (floors.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Template Uploaded</h3>
        <p className="text-sm text-gray-500">Upload an Excel template in the Finishing Activities tab first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Floor</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Start Flat</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">End Flat</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Flats Count</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Configurations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {floors.map((f) => (
                <tr key={f.floor} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">Floor {f.floor}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{f.flats[0]}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{f.flats[f.flats.length - 1]}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{f.flats.length}</td>
                  <td className="px-4 py-3 text-gray-600">{f.configurations.join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">{totalFlats}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function StagesTab({ projectId }: { projectId: string }) {
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('activities')
        .select('stage')
        .eq('project_id', projectId);
      if (!data) { setLoading(false); return; }
      const set = new Set(data.map((r: { stage: string }) => r.stage).filter(Boolean));
      setStages([...set].sort());
      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (stages.length === 0) return <EmptyState title="No Stages" description="Upload a template to see stages." />;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
          <th className="text-left px-4 py-3 font-semibold text-gray-600">Stage Name</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {stages.map((s, i) => (
            <tr key={s} className="hover:bg-gray-50"><td className="px-4 py-3 text-gray-500">{i + 1}</td><td className="px-4 py-3 text-gray-900">{s}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageGatesTab({ projectId }: { projectId: string }) {
  const [gates, setGates] = useState<{ stage: string; stageGate: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('activities')
        .select('stage, stage_gate')
        .eq('project_id', projectId);
      if (!data) { setLoading(false); return; }
      const set = new Set<string>();
      const result: { stage: string; stageGate: string }[] = [];
      for (const r of data) {
        const key = `${r.stage}||${r.stage_gate}`;
        if (!set.has(key)) { set.add(key); result.push({ stage: r.stage, stageGate: r.stage_gate || '' }); }
      }
      result.sort((a, b) => a.stage.localeCompare(b.stage) || a.stageGate.localeCompare(b.stageGate));
      setGates(result);
      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (gates.length === 0) return <EmptyState title="No Stage Gates" description="Upload a template to see stage gates." />;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
          <th className="text-left px-4 py-3 font-semibold text-gray-600">Stage</th>
          <th className="text-left px-4 py-3 font-semibold text-gray-600">Stage Gate</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {gates.map((g, i) => (
            <tr key={i} className="hover:bg-gray-50"><td className="px-4 py-3 text-gray-500">{i + 1}</td><td className="px-4 py-3 text-gray-900">{g.stage}</td><td className="px-4 py-3 text-gray-600">{g.stageGate || '-'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function RoomLocationTab({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Room / Location Coming in v2</h3>
      <p className="text-sm text-gray-500 mb-8">Room-level tracking planned for a future release.</p>
      <button onClick={onClose} className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors text-sm">Close</button>
    </div>
  );
}
