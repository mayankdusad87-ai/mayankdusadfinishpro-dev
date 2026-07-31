'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import { getPhotosForProject, ActivityPhoto, getProjectDataFromSupabase } from '@/lib/supabase-data';

export default function PhotoReviewPage() {
  const { currentProject } = useProject();
  const [photos, setPhotos] = useState<ActivityPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [floorFilter, setFloorFilter] = useState<number | ''>('');
  const [stageFilter, setStageFilter] = useState('');
  const [subStageFilter, setSubStageFilter] = useState('');
  const [floors, setFloors] = useState<number[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [stageGates, setStageGates] = useState<Record<string, string[]>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<ActivityPhoto | null>(null);

  const loadPhotos = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    const filters: { floor?: number; stage?: string; stageGate?: string } = {};
    if (floorFilter) filters.floor = floorFilter;
    if (stageFilter) filters.stage = stageFilter;
    if (subStageFilter) filters.stageGate = subStageFilter;
    const list = await getPhotosForProject(currentProject.id, filters);
    setPhotos(list);
    setLoading(false);
  }, [currentProject, floorFilter, stageFilter, subStageFilter]);

  useEffect(() => {
    if (!currentProject) return;
    getProjectDataFromSupabase(currentProject.id).then(data => {
      if (data) {
        setFloors(data.floors);
        setStages(data.stages);
        setStageGates(data.stageGates);
      }
    });
  }, [currentProject]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const subStageOptions = stageFilter ? (stageGates[stageFilter] || []) : [];

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p>Select a project first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Photo Review</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review photos uploaded by supervisors for {currentProject.name}.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={floorFilter}
          onChange={(e) => setFloorFilter(e.target.value ? Number(e.target.value) : '')}
          className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
        >
          <option value="">All Floors</option>
          {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => { setStageFilter(e.target.value); setSubStageFilter(''); }}
          className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700"
        >
          <option value="">All Stages</option>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={subStageFilter}
          onChange={(e) => setSubStageFilter(e.target.value)}
          disabled={!stageFilter}
          className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-50"
        >
          <option value="">All Sub-Stages</option>
          {subStageOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="flex items-center text-sm text-gray-500">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Photo Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">No photos yet</h3>
          <p className="text-sm text-gray-500 mt-1">Photos uploaded by supervisors will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map(photo => (
            <div
              key={photo.id}
              onClick={() => setLightboxPhoto(photo)}
              className="group cursor-pointer rounded-xl overflow-hidden border border-gray-200 hover:border-primary hover:shadow-md transition-all"
            >
              <div className="aspect-square bg-gray-100 relative">
                <img
                  src={photo.url}
                  alt={photo.activity_name || 'Activity photo'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="px-3 py-2 bg-white">
                <div className="text-xs font-semibold text-gray-900 truncate">{photo.activity_name}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  Floor {photo.floor} &bull; Flat {photo.flat_number}
                </div>
                <div className="text-[11px] text-gray-400 truncate">{photo.stage} &bull; {photo.stage_gate}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(photo.created_at || '').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightboxPhoto(null)}>
          <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 text-white text-sm font-medium flex items-center gap-1 hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Close
            </button>

            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.activity_name || 'Photo'}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />

            <div className="bg-white rounded-lg mt-3 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Activity</div>
                  <div className="font-medium text-gray-900">{lightboxPhoto.activity_name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Location</div>
                  <div className="font-medium text-gray-900">Floor {lightboxPhoto.floor}, Flat {lightboxPhoto.flat_number}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Stage</div>
                  <div className="font-medium text-gray-900">{lightboxPhoto.stage}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Sub-Stage</div>
                  <div className="font-medium text-gray-900">{lightboxPhoto.stage_gate}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                Uploaded: {new Date(lightboxPhoto.created_at || '').toLocaleString('en-IN')} &bull; Size: {Math.round((lightboxPhoto.file_size ?? 0) / 1024)} KB
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
