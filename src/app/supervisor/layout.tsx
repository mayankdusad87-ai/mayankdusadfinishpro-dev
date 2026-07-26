'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/supervisor/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/supervisor/login');
    }
  }, [loading, user, isLoginPage, router]);

  if (!isLoginPage && (loading || !user)) {
    return (
      <div className="min-h-screen bg-navy-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-dark">
      {children}
    </div>
  );
}
