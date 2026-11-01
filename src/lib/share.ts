/**
 * Share utilities — capture DOM elements as images and share via WhatsApp.
 *
 * Usage:
 *   import { captureAndShare, shareText } from '@/lib/share';
 *   captureAndShare(element, 'blockers-tiling', 'Fallback text...');
 *   shareText('Hello from FinishPro');
 */

/** Capture a DOM element as PNG and share via native Share API (mobile) or download (desktop). */
export async function captureAndShare(
  element: HTMLElement,
  filename: string,
  fallbackText?: string,
): Promise<void> {
  const { toPng } = await import('html-to-image');

  const dataUrl = await toPng(element, {
    quality: 0.95,
    backgroundColor: '#ffffff',
    pixelRatio: 2,
  });

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], `${filename}.png`, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: fallbackText });
    return;
  }

  // Desktop fallback: download the image
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Open WhatsApp with pre-filled text (no image). */
export function shareText(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
