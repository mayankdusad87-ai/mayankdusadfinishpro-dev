import { useState, useEffect, useCallback, useRef } from 'react';

export interface DataLoaderResult<T> {
  data: T;
  loading: boolean;
  refresh: () => void;
}

export function useDataLoader<T>(
  fetchFn: () => Promise<T>,
  initialValue: T,
  deps: unknown[] = [],
): DataLoaderResult<T> {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch {
      // caller handles via initialValue
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => { mountedRef.current = false; };
  }, [refresh]);

  return { data, loading, refresh };
}
