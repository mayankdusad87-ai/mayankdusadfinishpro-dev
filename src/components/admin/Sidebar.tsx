'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
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
    label: 'Manage Projects',
    href: '/admin/projects',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M2 20h20" />
        <path d="M5 20V8l7-5 7 5v12" />
        <path d="M9 20v-4h6v4" />
        <rect x="9" y="10" width="6" height="3" />
      </svg>
    ),
  },
  {
    label: 'Manage Supervisors',
    href: '/admin/supervisors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
        <path d="M19 8v6" />
        <path d="M16 11h6" />
      </svg>
    ),
  },
  {
    label: 'Activity Log',
    href: '/admin/audit-log',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/admin/reports',
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
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarContent = (
    <aside
      className={`flex flex-col h-screen bg-sidebar text-white transition-all duration-200 flex-shrink-0 ${
        collapsed ? 'w-[60px]' : 'w-[170px]'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 px-3 py-4 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 flex-shrink-0">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="20" cy="14" rx="16" ry="10" fill="#E67E22" />
            <rect x="6" y="14" width="28" height="4" rx="1" fill="#D35400" />
            <rect x="17" y="4" width="6" height="4" rx="2" fill="#E67E22" />
            <path d="M8 18h24v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2Z" fill="#D35400" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold leading-tight tracking-wide">FINISHING PRO</div>
            <div className="text-[10px] text-gray-400 leading-tight">Head Office</div>
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
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
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

      {/* Collapse toggle - desktop only */}
      <button
        onClick={() => setCollapsed(!collapsed)}
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
