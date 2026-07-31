import { useState, useEffect, useCallback } from 'react';

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

export interface ToastResult {
  toast: Toast | null;
  showToast: (message: string, type: Toast['type']) => void;
  clearToast: () => void;
}

export function useToast(duration = 4000): ToastResult {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast, duration]);

  const showToast = useCallback((message: string, type: Toast['type']) => {
    setToast({ message, type });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  return { toast, showToast, clearToast };
}
