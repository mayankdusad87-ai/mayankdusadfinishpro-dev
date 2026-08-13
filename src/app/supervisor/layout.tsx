'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/supervisor/login';

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace('/supervisor/login');
    }
    if (!loading && profile && (profile.role === 'admin' || profile.role === 'management')) {
      router.replace('/admin/reports');
    }
  }, [loading, user, profile, isLoginPage, router]);

  if (!isLoginPage && (loading || !user)) {
    return (
      <div className="min-h-screen bg-navy-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoginPage && profile && (profile.role === 'admin' || profile.role === 'management')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-navy-dark">
      {children}
    </div>
  );
}
