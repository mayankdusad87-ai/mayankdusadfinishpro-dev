'use client';

import { useState } from 'react';

export default function TopBar() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 gap-4 flex-shrink-0">
      {/* Project selector */}
      <div className="flex items-center gap-2 min-w-0">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 bg-white text-sm text-gray-700 transition-colors cursor-pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400">
            <path d="M2 20h20" />
            <path d="M5 20V8l7-5 7 5v12" />
            <path d="M9 20v-4h6v4" />
          </svg>
          <span className="truncate max-w-[160px]">Current Project</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-gray-400">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Search bar */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-600">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            3
          </span>
        </button>

        {/* User avatar + name */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            AD
          </div>
          <div className="hidden sm:block min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate leading-tight">Admin</div>
            <div className="text-[11px] text-gray-400 leading-tight">Head Office</div>
          </div>
        </div>
      </div>
    </header>
  );
}
