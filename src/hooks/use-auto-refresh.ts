import { useEffect, useRef } from 'react';

export function useAutoRefresh(
  callback: () => void,
  intervalMs: number,
  enabled: boolean,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => {
      // Only refresh when the tab is visible — prevents jarring updates
      // while the user is in another tab or the phone screen is off
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
