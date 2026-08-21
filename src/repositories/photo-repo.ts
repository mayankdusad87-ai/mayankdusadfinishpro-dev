import { supabase } from '@/lib/supabase';
import type { ActivityPhotoRow } from '@/types/database.types';
import { MAX_PHOTO_SIZE, MAX_PHOTOS_PER_ACTIVITY, PHOTO_BUCKET, IMAGE_SIGNATURES } from '@/lib/constants';
import { friendlyError } from './errors';

export type ActivityPhoto = ActivityPhotoRow & { url?: string };

function detectImageType(header: Uint8Array): string | null {
  for (const sig of IMAGE_SIGNATURES) {
    if (sig.bytes.every((b, i) => header[i] === b)) return sig.type;
  }
  return null;
}

export async function uploadActivityPhoto(
  file: Blob,
  storagePath: string,
  metadata: {
    activityId: string;
    projectId: string;
    fileName: string;
    floor: number;
    stage: string;
    stageGate: string;
    activityName: string;
    flatNumber: number;
    uploadedBy: string;
  }
): Promise<{ error: string | null }> {
  if (file.size > MAX_PHOTO_SIZE) {
    return { error: 'Photo exceeds the 5 MB size limit.' };
  }

  const headerSlice = await file.slice(0, 12).arrayBuffer();
  const header = new Uint8Array(headerSlice);
  const detectedType = detectImageType(header);

  if (!detectedType) {
    return { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' };
  }

  const existing = await supabase
    .from('activity_photos')
    .select('id', { count: 'exact' })
    .eq('activity_id', metadata.activityId);

  if ((existing.count ?? 0) >= MAX_PHOTOS_PER_ACTIVITY) {
    return { error: `Maximum ${MAX_PHOTOS_PER_ACTIVITY} photos per activity reached.` };
  }

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, file, { contentType: detectedType, upsert: false });

  const photoCtx = { floor: metadata.floor, flat: metadata.flatNumber, activity: metadata.activityName, stage: metadata.stage };

  if (uploadError) return { error: friendlyError(uploadError.message, 'upload photo', photoCtx) };

  const { error: dbError } = await supabase.from('activity_photos').insert({
    activity_id: metadata.activityId,
    project_id: metadata.projectId,
    storage_path: storagePath,
    file_name: metadata.fileName,
    file_size: file.size,
    uploaded_by: metadata.uploadedBy,
    floor: metadata.floor,
    stage: metadata.stage,
    stage_gate: metadata.stageGate,
    activity_name: metadata.activityName,
    flat_number: metadata.flatNumber,
  });

  if (dbError) return { error: friendlyError(dbError.message, 'save photo record', photoCtx) };
  return { error: null };
}

export async function getPhotosForActivity(activityId: string): Promise<ActivityPhoto[]> {
  const { data, error } = await supabase
    .from('activity_photos')
    .select('*')
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) return [];

  // Batch: single request for all signed URLs instead of N sequential calls
  const paths = data.map(p => p.storage_path);
  const { data: urlData } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 3600);

  const urlMap = new Map<string, string>();
  if (urlData) {
    for (const entry of urlData) {
      if (entry.path && entry.signedUrl) urlMap.set(entry.path, entry.signedUrl);
    }
  }

  return data.map(photo => ({
    ...photo,
    url: urlMap.get(photo.storage_path) || '',
  }));
}

export async function getPhotosForProject(
  projectId: string,
  filters?: { floor?: number; stage?: string; stageGate?: string }
): Promise<ActivityPhoto[]> {
  let query = supabase
    .from('activity_photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (filters?.floor) query = query.eq('floor', filters.floor);
  if (filters?.stage) query = query.eq('stage', filters.stage);
  if (filters?.stageGate) query = query.eq('stage_gate', filters.stageGate);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return [];

  // Batch: single request for all signed URLs instead of N sequential calls
  const paths = data.map(p => p.storage_path);
  const { data: urlData } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 3600);

  const urlMap = new Map<string, string>();
  if (urlData) {
    for (const entry of urlData) {
      if (entry.path && entry.signedUrl) urlMap.set(entry.path, entry.signedUrl);
    }
  }

  return data.map(photo => ({
    ...photo,
    url: urlMap.get(photo.storage_path) || '',
  }));
}

export async function deleteActivityPhoto(photoId: string, storagePath: string): Promise<{ error: string | null }> {
  const { error: storageErr } = await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
  if (storageErr) return { error: friendlyError(storageErr.message, 'delete photo file') };

  const { error: dbErr } = await supabase.from('activity_photos').delete().eq('id', photoId);
  if (dbErr) return { error: friendlyError(dbErr.message, 'delete photo record') };
  return { error: null };
}
