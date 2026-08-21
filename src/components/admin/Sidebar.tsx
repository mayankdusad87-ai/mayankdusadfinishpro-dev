'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDevice } from '@/hooks';
import { canAccess, type Feature, type Role } from '@/lib/permissions';
import { useManagementAccess } from '@/lib/management-access-context';

interface NavItem {
  label: string;
  href: string;
  feature: Feature;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Upload Template',
    href: '/admin/upload',
    feature: 'upload-template',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    feature: 'dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Admin Panel',
    href: '/admin/manage',
    feature: 'manage-projects',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <path d="M17 13v8" />
        <path d="M13 17h8" />
      </svg>
    ),
  },
  {
    label: 'Photo Review',
    href: '/admin/photos',
    feature: 'photo-review',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <circle cx="12" cy="13.5" r="3" />
      </svg>
    ),
  },
  {
    label: 'Insights',
    href: '/admin/reports',
    feature: 'insights-view',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 20h16" />
        <path d="M4 20V10" />
        <rect x="4" y="10" width="4" height="10" rx="1" />
        <rect x="10" y="6" width="4" height="14" rx="1" />
        <rect x="16" y="2" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    feature: 'settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, profile, user } = useAuth();
  const device = useDevice();
  const role = (profile?.role ?? 'supervisor') as Role;
  const { access: mgmtAccess } = useManagementAccess();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  }

  // Map sidebar features to management access keys for dynamic override
  const mgmtFeatureKey: Partial<Record<Feature, 'dashboard' | 'insights' | 'photos'>> = {
    dashboard: 'dashboard',
    'insights-view': 'insights',
    'photo-review': 'photos',
  };

  const visibleItems = navItems.filter(item => {
    // Static permission check
    if (!canAccess(role, device, item.feature)) return false;
    // Dynamic management access override
    if (role === 'management') {
      const accessKey = mgmtFeatureKey[item.feature];
      if (accessKey && !mgmtAccess[accessKey]) return false;
    }
    return true;
  });

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  const sidebarContent = (
    <aside
      className={`flex flex-col h-screen bg-sidebar text-white transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-[60px]' : 'w-[220px]'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 px-3 py-4 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 flex-shrink-0">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="20" cy="14" rx="16" ry="10" fill="#C8922A" />
            <rect x="6" y="14" width="28" height="4" rx="1" fill="#A67921" />
            <rect x="17" y="4" width="6" height="4" rx="2" fill="#C8922A" />
            <path d="M8 18h24v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2Z" fill="#A67921" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold leading-tight tracking-wide">FINISHING PRO</div>
            <div className="text-xs text-gray-400 leading-tight">Head Office</div>
          </div>
        )}
        {/* Close button on mobile */}
        {!collapsed && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1 hover:bg-sidebar-hover rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors relative group ${
                isActive
                  ? 'bg-sidebar-hover text-white'
                  : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r" />
              )}
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Profile */}
      <div className={`border-t border-white/10 px-3 py-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div
            className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-sm font-bold cursor-default"
            title={`${profile?.full_name || 'User'}\n${user?.email || ''}\n${(profile?.role || 'admin').toUpperCase()}`}
          >
            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-xs font-semibold truncate">{profile?.full_name || 'User'}</div>
              <div className="text-gray-400 text-xs truncate">{user?.email || ''}</div>
              <div className="text-[11px] uppercase tracking-wider text-primary/70 font-medium mt-0.5">{profile?.role || 'admin'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-red-400 hover:bg-sidebar-hover transition-colors border-t border-white/10 cursor-pointer"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {!collapsed && <span className="text-xs">Logout</span>}
      </button>

      {/* Collapse toggle - desktop only */}
      <button
        onClick={toggleCollapsed}
        className="hidden md:flex items-center justify-center gap-2 px-3 py-3 text-gray-400 hover:text-white hover:bg-sidebar-hover transition-colors border-t border-white/10 cursor-pointer"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-5 h-5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {!collapsed && <span className="text-xs">Collapse</span>}
      </button>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile sidebar - overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <div className="relative z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
