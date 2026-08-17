'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getManagementAccess, type ManagementAccess, DEFAULT_MANAGEMENT_ACCESS } from '@/repositories/settings-repo';

interface ManagementAccessContextValue {
  access: ManagementAccess;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ManagementAccessContext = createContext<ManagementAccessContextValue>({
  access: DEFAULT_MANAGEMENT_ACCESS,
  loading: true,
  refresh: async () => {},
});

export function ManagementAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<ManagementAccess>(DEFAULT_MANAGEMENT_ACCESS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getManagementAccess();
      setAccess(data);
    } catch {
      // Keep defaults on error
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ManagementAccessContext.Provider value={{ access, loading, refresh }}>
      {children}
    </ManagementAccessContext.Provider>
  );
}

export function useManagementAccess(): ManagementAccessContextValue {
  return useContext(ManagementAccessContext);
}
