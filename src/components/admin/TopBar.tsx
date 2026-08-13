'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/lib/project-context';
import { useAuth } from '@/lib/auth-context';
import NotificationDropdown from '@/components/shared/NotificationDropdown';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { projects, currentProject, setCurrentProjectId } = useProject();
  const { profile, user, signOut } = useAuth();

  const displayName = profile?.full_name || 'Admin';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-4 gap-2 md:gap-4 flex-shrink-0">
      {/* Hamburger + Project selector */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Project dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-white text-sm text-gray-700 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400 hidden sm:block">
              <path d="M2 20h20" />
              <path d="M5 20V8l7-5 7 5v12" />
              <path d="M9 20v-4h6v4" />
            </svg>
            <span className="truncate max-w-[100px] sm:max-w-[200px]">
              {currentProject ? currentProject.name : projects.length === 0 ? 'No Projects' : 'Select Project'}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {dropdownOpen && projects.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setCurrentProjectId(p.id); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                    currentProject?.id === p.id
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-gray-400 truncate">{p.location}</div>
                  </div>
                  {currentProject?.id === p.id && (
                    <svg className="w-4 h-4 text-primary flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2 md:gap-3">
        <NotificationDropdown />

        {/* Profile dropdown */}
        <div className="relative pl-2 border-l border-gray-200" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate leading-tight">{displayName}</div>
              <div className="text-[11px] text-gray-400 leading-tight">Head Office</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 text-gray-400 transition-transform hidden sm:block ${profileOpen ? 'rotate-180' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-2 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-2.5 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-800 truncate">{displayName}</div>
                <div className="text-xs text-gray-400 truncate mt-0.5">{user?.email || ''}</div>
                <div className="text-[10px] uppercase tracking-wider text-primary font-medium mt-1">
                  {profile?.role || 'admin'}
                </div>
              </div>

              {/* Sign Out */}
              <div className="px-2 pt-1.5 pb-0.5">
                <button
                  onClick={async () => {
                    setProfileOpen(false);
                    await signOut();
                    router.replace('/login');
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
