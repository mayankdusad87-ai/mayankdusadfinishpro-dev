'use client';

import { memo } from 'react';
import type { OperationsData } from '@/lib/insights-data';

interface Props {
  data: OperationsData;
}

function ratingStyle(rating: 'Good' | 'Fair' | 'Poor') {
  if (rating === 'Good') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (rating === 'Fair') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function OperationsView({ data }: Props) {
  const { vendors, delayReasons, bottlenecks } = data;
  const maxReasonCount = delayReasons.length > 0 ? delayReasons[0].count : 1;

  return (
    <div className="space-y-6">

      {/* ---- VENDOR SCORECARD ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <h3 className="text-base md:text-lg font-bold text-gray-900">Vendor Scorecard</h3>
          <p className="text-xs text-gray-400 mt-0.5">Performance based on on-time delivery of completed activities</p>
        </div>

        {vendors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No vendor data available</p>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vendor</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Assigned</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Completed</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">On-Time %</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Avg Delay</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pending</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => (
                    <tr key={v.vendor} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-gray-900 max-w-[200px] truncate">{v.vendor}</td>
                      <td className="py-3 px-3 text-center text-gray-600 tabular-nums">{v.assigned}</td>
                      <td className="py-3 px-3 text-center text-gray-600 tabular-nums">{v.completed}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${v.onTimePct}%`,
                                backgroundColor: v.onTimePct >= 80 ? '#10B981' : v.onTimePct >= 50 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums w-8">{v.onTimePct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums text-gray-600">
                        {v.avgDelayDays > 0 ? `${v.avgDelayDays}d` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center tabular-nums text-gray-600">{v.pending}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold border ${ratingStyle(v.rating)}`}>
                          {v.rating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-3">
              {vendors.map(v => (
                <div key={v.vendor} className="rounded-lg border border-gray-100 p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{v.vendor}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ratingStyle(v.rating)}`}>
                      {v.rating}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${v.onTimePct}%`,
                          backgroundColor: v.onTimePct >= 80 ? '#10B981' : v.onTimePct >= 50 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums">{v.onTimePct}% on-time</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Assigned</div>
                      <div className="text-sm font-bold text-gray-800 tabular-nums">{v.assigned}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Done</div>
                      <div className="text-sm font-bold text-gray-800 tabular-nums">{v.completed}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Pending</div>
                      <div className="text-sm font-bold text-gray-800 tabular-nums">{v.pending}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase">Avg Delay</div>
                      <div className="text-sm font-bold text-gray-800 tabular-nums">{v.avgDelayDays > 0 ? `${v.avgDelayDays}d` : '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ---- DELAY ROOT CAUSE ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <h3 className="text-base md:text-lg font-bold text-gray-900">Delay Root Cause</h3>
          <p className="text-xs text-gray-400 mt-0.5">Most common reasons for activity delays</p>
        </div>

        {delayReasons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No delay reasons recorded</p>
        ) : (
          <div className="space-y-3">
            {delayReasons.slice(0, 8).map((d, i) => {
              const barWidth = (d.count / maxReasonCount) * 100;
              return (
                <div key={d.reason} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-800 font-medium truncate max-w-[60%]">{d.reason}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 tabular-nums">{d.count}</span>
                      <span className="text-[10px] text-gray-400 tabular-nums w-8 text-right">{d.pct}%</span>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-50 rounded-full overflow-hidden">
                    <div
                      className="h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: i === 0 ? '#EF4444' : i === 1 ? '#F97316' : i === 2 ? '#F59E0B' : '#94A3B8',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- FLOOR BOTTLENECKS ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <h3 className="text-base md:text-lg font-bold text-gray-900">Floor Bottlenecks</h3>
          <p className="text-xs text-gray-400 mt-0.5">Floors with overdue activities — what&apos;s stuck, by whom, and how far behind</p>
        </div>

        {bottlenecks.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No bottlenecks — all floors are on schedule</p>
          </div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Floor</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Progress</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Blocked By</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Vendor</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Overdue</th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Days Behind</th>
                  </tr>
                </thead>
                <tbody>
                  {bottlenecks.map(b => (
                    <tr key={b.floor} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-gray-900">Floor {b.floor}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-primary rounded-full" style={{ width: `${b.progressPct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 tabular-nums">{b.progressPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">{b.blockedStage}</td>
                      <td className="py-3 px-3 text-gray-600 truncate max-w-[150px]">{b.blockedVendor || '—'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-red-50 text-red-700 text-xs font-bold tabular-nums border border-red-200">
                          {b.overdueCount}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-red-600 font-bold tabular-nums">{b.maxDaysBehind}d</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-3">
              {bottlenecks.map(b => (
                <div key={b.floor} className="rounded-lg border border-red-100 bg-red-50/30 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900">Floor {b.floor}</span>
                    <span className="text-red-600 font-bold text-sm tabular-nums">{b.maxDaysBehind}d behind</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex-1 h-2 bg-white/60 rounded-full">
                      <div className="h-2 bg-primary rounded-full" style={{ width: `${b.progressPct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 tabular-nums">{b.progressPct}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Blocked By</div>
                      <div className="text-[11px] font-semibold text-gray-800 mt-0.5 truncate">{b.blockedStage}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Vendor</div>
                      <div className="text-[11px] font-semibold text-gray-800 mt-0.5 truncate">{b.blockedVendor || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase">Overdue</div>
                      <div className="text-[11px] font-bold text-red-600 mt-0.5 tabular-nums">{b.overdueCount} acts</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(OperationsView);
