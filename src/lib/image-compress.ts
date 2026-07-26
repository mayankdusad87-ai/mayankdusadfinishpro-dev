const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.7;
const MAX_FILE_SIZE = 300 * 1024; // 300 KB

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = QUALITY;
  let blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  while (blob.size > MAX_FILE_SIZE && quality > 0.3) {
    quality -= 0.1;
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  }

  return blob;
}

export function generatePhotoPath(projectId: string, activityId: string, index: number): string {
  const timestamp = Date.now();
  return `${projectId}/${activityId}/${timestamp}_${index}.jpg`;
}
