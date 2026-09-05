'use client';

import { useState, useEffect } from 'react';
import { UploadedActivity } from '@/lib/project-data-store';
import { uploadActivityPhoto, getPhotosForActivity, ActivityPhoto, deleteActivityPhoto } from '@/lib/supabase-data';
import type { Reason } from '@/lib/supabase-data';
import { saveActivityDetail } from '@/services/activity-service';
import { compressImage, generatePhotoPath } from '@/lib/image-compress';
import { normalizeStatus, toSelectableStatus, daysOverdue, formatDDMMYYYY, TODAY, SUPERVISOR_STATUS_OPTIONS, isDelayReasonRequired, isDelayReasonVisible } from './supervisor-utils';

interface ActivityDetailSheetProps {
  activity: UploadedActivity;
  reasons: Reason[];
  userId: string;
  projectId: string;
  projectName: string;
  backdateCutoff?: string; // ISO date — earliest date supervisor can pick for actual dates
  onClose: () => void;
  onSaved: () => void;
}

export default function ActivityDetailSheet({
  activity,
  reasons,
  userId,
  projectId,
  projectName,
  backdateCutoff,
  onClose,
  onSaved,
}: ActivityDetailSheetProps) {
  const [detailStatus, setDetailStatus] = useState<string>(toSelectableStatus(activity.status));
  const [detailActualStart, setDetailActualStart] = useState(activity.actual_start || '');
  const [detailActualEnd, setDetailActualEnd] = useState(activity.actual_end || '');
  const [detailError, setDetailError] = useState('');
  const [detailPhotos, setDetailPhotos] = useState<ActivityPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<{ file: Blob; preview: string; fileName: string }[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const existingReason = activity.delay_reason || '';
  const isPresetReason = reasons.some(r => r.label === existingReason);
  const [detailReason, setDetailReason] = useState(() => {
    if (existingReason && !isPresetReason) return '__other__';
    return existingReason;
  });
  const [detailRemarks, setDetailRemarks] = useState(() => {
    if (existingReason && !isPresetReason) return existingReason;
    return activity.remarks || '';
  });

  useEffect(() => {
    getPhotosForActivity(activity.id).then(setDetailPhotos);
  }, [activity.id]);

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const totalCount = detailPhotos.length + pendingPhotos.length + files.length;
    if (totalCount > 3) {
      setPhotoError('Maximum 3 photos per activity.');
      e.target.value = '';
      return;
    }

    setPhotoError('');
    const newPending: typeof pendingPhotos = [];

    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const preview = URL.createObjectURL(compressed);
        newPending.push({
          file: compressed,
          preview,
          fileName: file.name || `photo_${detailPhotos.length + pendingPhotos.length + newPending.length}.jpg`,
        });
      } catch {
        setPhotoError('Failed to compress photo. Please try again.');
      }
    }

    setPendingPhotos(prev => [...prev, ...newPending]);
    e.target.value = '';
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos(prev => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleDeletePhoto(photo: ActivityPhoto) {
    const result = await deleteActivityPhoto(photo.id, photo.storage_path);
    if (!result.error) {
      setDetailPhotos(prev => prev.filter(p => p.id !== photo.id));
    } else {
      setPhotoError(result.error);
    }
  }

  async function saveDetail() {
    if (saving) return; // prevent double-tap
    setSaving(true);
    setDetailError('');
    setPhotoError('');

    // Upload pending photos first
    if (pendingPhotos.length > 0) {
      setPhotoUploading(true);
      for (let i = 0; i < pendingPhotos.length; i++) {
        const pending = pendingPhotos[i];
        try {
          const path = generatePhotoPath(projectId, activity.id, detailPhotos.length + i);
          const uploadResult = await uploadActivityPhoto(pending.file, path, {
            activityId: activity.id,
            projectId,
            fileName: pending.fileName,
            floor: activity.floor,
            stage: activity.stage,
            stageGate: activity.stage_gate,
            activityName: activity.activity,
            flatNumber: activity.flat_number,
            uploadedBy: userId,
          });
          if (uploadResult.error) {
            setPhotoError(uploadResult.error);
            setPhotoUploading(false);
            setSaving(false);
            return;
          }
        } catch {
          setPhotoError('Failed to upload photo. Please try again.');
          setPhotoUploading(false);
          setSaving(false);
          return;
        }
      }
      // Clean up preview URLs
      pendingPhotos.forEach(p => URL.revokeObjectURL(p.preview));
      setPendingPhotos([]);
      setPhotoUploading(false);
    }

    const totalPhotos = detailPhotos.length + pendingPhotos.length;
    const result = await saveActivityDetail({
      activityId: activity.id,
      status: detailStatus,
      expectedEnd: activity.expected_end || null,
      oldStatus: activity.status,
      actualStart: detailActualStart,
      actualEnd: detailActualEnd,
      delayReason: detailReason,
      delayReasonIsOther: detailReason === '__other__',
      remarks: detailRemarks,
      photoCount: totalPhotos,
      projectId,
      projectName,
      userId,
      floor: activity.floor,
      flatNumber: activity.flat_number,
      stage: activity.stage,
      stageGate: activity.stage_gate,
      activityName: activity.activity,
      backdateCutoff: backdateCutoff || undefined,
    });

    if (result.error) {
      setDetailError(result.error);
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end max-w-md md:max-w-3xl mx-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header with navy accent */}
        <div className="bg-gradient-to-r from-navy to-navy-light px-5 pt-5 pb-4 rounded-t-3xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white font-heading">{activity.activity}</h2>
              <p className="text-xs md:text-sm text-gray-400 mt-1">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2 20h20M5 20V8l7-5 7 5v12M9 20v-4h6v4" /></svg>
                  Floor {activity.floor} · Flat {activity.flat_number} · {activity.stage}
                </span>
              </p>
              <p className="text-xs md:text-sm text-primary font-medium mt-0.5">Sub Stage: {activity.stage_gate}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-5 pt-4 pb-24">

          {normalizeStatus(activity.status) !== 'completed' && activity.expected_end && activity.expected_end < TODAY && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span className="text-sm font-semibold text-red-700">
                {daysOverdue(activity.expected_end)} days overdue
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] md:text-xs text-gray-500 uppercase tracking-wide">Expected Start</div>
              <div className="text-sm md:text-base font-medium text-gray-900 mt-1">{formatDDMMYYYY(activity.expected_start)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-[11px] md:text-xs text-gray-500 uppercase tracking-wide">Expected End</div>
              <div className="text-sm md:text-base font-medium text-gray-900 mt-1">{formatDDMMYYYY(activity.expected_end)}</div>
            </div>
          </div>

          {(activity.revised_start || activity.revised_end) && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <div className="text-[11px] md:text-xs text-indigo-600 uppercase tracking-wide">Revised Start</div>
                <div className="text-sm md:text-base font-medium text-indigo-900 mt-1">{formatDDMMYYYY(activity.revised_start)}</div>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                <div className="text-[11px] md:text-xs text-indigo-600 uppercase tracking-wide">Revised End</div>
                <div className="text-sm md:text-base font-medium text-indigo-900 mt-1">{formatDDMMYYYY(activity.revised_end)}</div>
              </div>
            </div>
          )}

          {detailError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span className="text-xs font-medium text-red-700">{detailError}</span>
            </div>
          )}

          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {/* 1. Status (primary action) */}
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={detailStatus}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setDetailStatus(newStatus);
                  setDetailError('');
                  // Clear actual dates when reverting to not_started
                  if (newStatus === 'not_started') {
                    setDetailActualStart('');
                    setDetailActualEnd('');
                  }
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                {SUPERVISOR_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* 2. Delay reason (right after status) */}
            {isDelayReasonVisible(detailStatus, activity.expected_end) && (
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  {detailStatus === 'not_started'
                    ? <>Reason for Non-Start {isDelayReasonRequired(detailStatus, activity.expected_end) ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}</>
                    : detailStatus === 'on_hold'
                      ? <>Hold Reason <span className="text-red-500">*</span></>
                      : <>Delay Reason <span className="text-red-500">*</span></>
                  }
                </label>
                <select
                  value={detailReason}
                  onChange={(e) => { setDetailReason(e.target.value); setDetailError(''); if (e.target.value !== '__other__' && e.target.value !== 'Previous Activity Pending') setDetailRemarks(''); }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary"
                >
                  <option value="">-- Select reason --</option>
                  {reasons.map(r => (
                    <option key={r.id} value={r.label}>{r.label}</option>
                  ))}
                  <option value="__other__">Other (specify in remarks)</option>
                </select>
              </div>
            )}

            {(detailReason === '__other__' || detailReason === 'Previous Activity Pending') && (
              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                  {detailReason === 'Previous Activity Pending' ? 'Which activity is pending?' : 'Remarks'} <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={detailRemarks}
                  onChange={(e) => { setDetailRemarks(e.target.value); setDetailError(''); }}
                  placeholder={detailReason === 'Previous Activity Pending' ? 'e.g. Waterproofing not done yet...' : 'Describe the reason...'}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
                {detailRemarks.trim().length === 0 && (
                  <p className="text-[11px] text-red-500 mt-1">Remarks are required</p>
                )}
              </div>
            )}

            {/* 3. Actual dates */}
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Actual Start</label>
                <input
                  type="date"
                  value={detailActualStart}
                  min={backdateCutoff || undefined}
                  max={TODAY}
                  onChange={(e) => { setDetailActualStart(e.target.value); setDetailError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {backdateCutoff && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Earliest: {backdateCutoff.split('-').reverse().join('-')}</p>
                )}
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Actual End</label>
                <input
                  type="date"
                  value={detailActualEnd}
                  min={detailActualStart || backdateCutoff || undefined}
                  max={TODAY}
                  onChange={(e) => { setDetailActualEnd(e.target.value); setDetailError(''); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {backdateCutoff && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Earliest: {backdateCutoff.split('-').reverse().join('-')}</p>
                )}
              </div>
            </div>

            {/* 4. Vendor (read-only) */}
            <div className="md:col-span-2">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <input type="text" defaultValue={activity.vendor} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" readOnly />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Photo Evidence <span className="text-gray-400 font-normal">({detailPhotos.length + pendingPhotos.length}/3)</span>
                {pendingPhotos.length > 0 && (
                  <span className="text-amber-600 font-normal ml-1">• {pendingPhotos.length} unsaved</span>
                )}
              </label>

              {photoError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 mb-2">
                  {photoError}
                </div>
              )}

              {(detailPhotos.length > 0 || pendingPhotos.length > 0) && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {/* Existing saved photos */}
                  {detailPhotos.map(photo => (
                    <div key={photo.id} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={photo.url}
                        alt={photo.file_name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightboxUrl(photo.url || null)}
                      />
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {/* Pending (unsaved) photos */}
                  {pendingPhotos.map((pending, idx) => (
                    <div key={`pending-${idx}`} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-amber-300">
                      <img
                        src={pending.preview}
                        alt={pending.fileName}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightboxUrl(pending.preview)}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-[9px] text-center py-0.5 font-medium">
                        Unsaved
                      </div>
                      <button
                        onClick={() => removePendingPhoto(idx)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {detailPhotos.length + pendingPhotos.length < 3 && (
                <div className="flex gap-2">
                  <label className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-lg text-sm transition-colors cursor-pointer ${
                    photoUploading ? 'border-gray-200 text-gray-400 pointer-events-none' : 'border-gray-300 text-gray-500 hover:border-primary hover:text-primary'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handlePhotoCapture}
                      disabled={photoUploading}
                      className="hidden"
                    />
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                    Take Photo
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-lg text-sm transition-colors cursor-pointer ${
                    photoUploading ? 'border-gray-200 text-gray-400 pointer-events-none' : 'border-gray-300 text-gray-500 hover:border-primary hover:text-primary'
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoCapture}
                      disabled={photoUploading}
                      className="hidden"
                    />
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                    Gallery
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-5 py-3">
          <button
            onClick={saveDetail}
            disabled={photoUploading || saving}
            className={`w-full py-3.5 text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg text-sm tracking-wide ${
              photoUploading || saving
                ? 'bg-gray-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-primary to-primary-dark hover:shadow-primary/30 hover:shadow-xl active:scale-[0.98]'
            }`}
          >
            {photoUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading photos...
              </>
            ) : saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              `Save Changes${pendingPhotos.length > 0 ? ` (${pendingPhotos.length} photo${pendingPhotos.length > 1 ? 's' : ''})` : ''}`
            )}
          </button>
        </div>
      </div>

      {/* Photo lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Photo"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
