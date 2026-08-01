const MAX_DIMENSION = 800;
const INITIAL_QUALITY = 0.6;
const TARGET_SIZE = 150 * 1024; // 150 KB
const MIN_QUALITY = 0.25;
const QUALITY_STEP = 0.08;

function supportsWebP(): boolean {
  if (typeof OffscreenCanvas === 'undefined') return false;
  try {
    const c = new OffscreenCanvas(1, 1);
    return typeof c.convertToBlob === 'function';
  } catch {
    return false;
  }
}

const USE_WEBP = supportsWebP();
const MIME = USE_WEBP ? 'image/webp' : 'image/jpeg';

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = INITIAL_QUALITY;
  let blob = await canvas.convertToBlob({ type: MIME, quality });

  while (blob.size > TARGET_SIZE && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await canvas.convertToBlob({ type: MIME, quality });
  }

  return blob;
}

const EXT = USE_WEBP ? 'webp' : 'jpg';

export function generatePhotoPath(projectId: string, activityId: string, index: number): string {
  const timestamp = Date.now();
  return `${projectId}/${activityId}/${timestamp}_${index}.${EXT}`;
}
