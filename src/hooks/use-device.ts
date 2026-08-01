import { useState, useEffect } from 'react';
import type { Device } from '@/lib/permissions';

const MOBILE_BREAKPOINT = 768;

export function useDevice(): Device {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setDevice(mql.matches ? 'mobile' : 'desktop');

    function onChange(e: MediaQueryListEvent) {
      setDevice(e.matches ? 'mobile' : 'desktop');
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return device;
}
