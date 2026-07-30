'use client';

import type { ManagementData } from '@/lib/insights-data';

interface Props {
  data: ManagementData;
  projectName: string;
}

function spiColor(status: 'green' | 'yellow' | 'red') {
  if (status === 'green') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (status === 'yellow') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
  return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManagementView({ data, projectName }: Props) {
  const { kpi, pipeline, floors } = data;
  const sc = spiColor(kpi.projectSpiStatus);

  return (
    <div className="space-y-6">

      {/* ---- KPI TILES ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="text-[11px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Flats</div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 tabular-nums">{kpi.totalFlats}</div>
          <div className="text-[11px] text-gray-400 mt-1">{kpi.totalActivities.toLocaleString()} activities tracked</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="text-[11px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Overall Progress</div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 tabular-nums">{kpi.overallProgressPct}%</div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2">
            <div className="h-1.5 bg-primary rounded-full transition-all" style={{ width: `${kpi.overallProgressPct}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <div className="text-[11px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">Overdue</div>
          <div className={`text-2xl md:text-3xl font-bold mt-1 tabular-nums ${kpi.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {kpi.overdueCount}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">activities past due date</div>
        </div>

        <div className={`rounded-xl border p-4 md:p-5 ${sc.bg} ${sc.border}`}>
          <div className={`text-[11px] md:text-xs font-semibold uppercase tracking-wider ${sc.text}`}>Schedule (SPI)</div>
          <div className={`text-2xl md:text-3xl font-bold mt-1 tabular-nums ${sc.text}`}>{kpi.projectSpi.toFixed(2)}</div>
          <div className={`text-[11px] mt-1 ${sc.text}`}>
            {kpi.projectSpiStatus === 'green' && 'On track'}
            {kpi.projectSpiStatus === 'yellow' && 'Slightly behind'}
            {kpi.projectSpiStatus === 'red' && 'Significantly behind'}
          </div>
        </div>
      </div>

      {/* ---- PIPELINE FUNNEL ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900">Flat Completion Pipeline</h3>
            <p className="text-xs text-gray-400 mt-0.5">How many flats have fully completed each stage</p>
          </div>
          <span className="text-xs text-gray-400 hidden md:inline">{projectName}</span>
        </div>

        {/* Desktop: horizontal funnel */}
        <div className="hidden md:block">
          <div className="flex gap-3">
            {pipeline.map((s, i) => {
              const barWidth = s.totalFlats > 0 ? (s.completedFlats / s.totalFlats) * 100 : 0;
              return (
                <div key={s.stage} className="flex-1 relative">
                  {i < pipeline.length - 1 && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
                        <path d="M2 1L10 8L2 15" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 truncate">{s.stage}</div>
                    <div className="text-2xl font-bold text-gray-900 tabular-nums">{s.completedFlats}</div>
                    <div className="text-xs text-gray-400 tabular-nums">/ {s.totalFlats} flats</div>
                    <div className="w-full h-2 bg-gray-200 rounded-full mt-3">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: barWidth >= 80 ? '#10B981' : barWidth >= 50 ? '#F59E0B' : barWidth > 0 ? '#EF4444' : '#E5E7EB',
                        }}
                      />
                    </div>
                    <div className="text-[11px] font-semibold mt-1.5 tabular-nums" style={{
                      color: barWidth >= 80 ? '#059669' : barWidth >= 50 ? '#D97706' : barWidth > 0 ? '#DC2626' : '#9CA3AF',
                    }}>
                      {s.pct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: vertical list */}
        <div className="md:hidden space-y-3">
          {pipeline.map((s, i) => {
            const barWidth = s.totalFlats > 0 ? (s.completedFlats / s.totalFlats) * 100 : 0;
            const barColor = barWidth >= 80 ? '#10B981' : barWidth >= 50 ? '#F59E0B' : barWidth > 0 ? '#EF4444' : '#E5E7EB';
            return (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{s.stage}</span>
                  </div>
                  <div className="text-sm tabular-nums">
                    <span className="font-bold text-gray-900">{s.completedFlats}</span>
                    <span className="text-gray-400"> / {s.totalFlats}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: barColor === '#E5E7EB' ? '#9CA3AF' : barColor }}>
                    {s.pct}%
                  </span>
                </div>
                {i < pipeline.length - 1 && (
                  <div className="flex justify-center py-1">
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M8 2V10M8 10L4 6M8 10L12 6" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- FLOOR PROJECTIONS ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="mb-4 md:mb-5">
          <h3 className="text-base md:text-lg font-bold text-gray-900">Floor-wise Projections</h3>
          <p className="text-xs text-gray-400 mt-0.5">Progress, current stage, projected finish and schedule health per floor</p>
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Floor</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Progress</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Current Stage</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Projected Finish</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">SPI</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {floors.map(f => {
                const fc = spiColor(f.spiStatus);
                return (
                  <tr key={f.floor} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900">Floor {f.floor}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-primary rounded-full" style={{ width: `${f.progressPct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 tabular-nums w-8">{f.progressPct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{f.currentStage}</td>
                    <td className="py-3 px-3 text-gray-700 font-medium tabular-nums">{formatDate(f.projectedFinish)}</td>
                    <td className="py-3 px-3 tabular-nums font-semibold" style={{ color: fc.text.replace('text-', '') }}>
                      <span className={`${fc.text}`}>{f.spi.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${fc.bg} ${fc.text} ${fc.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${fc.dot}`} />
                        {f.spiStatus === 'green' && 'On Track'}
                        {f.spiStatus === 'yellow' && 'At Risk'}
                        {f.spiStatus === 'red' && 'Behind'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {floors.map(f => {
            const fc = spiColor(f.spiStatus);
            return (
              <div key={f.floor} className={`rounded-lg border p-3.5 ${fc.border} ${fc.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">Floor {f.floor}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${fc.text} border ${fc.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${fc.dot}`} />
                    {f.spiStatus === 'green' ? 'On Track' : f.spiStatus === 'yellow' ? 'At Risk' : 'Behind'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex-1 h-2 bg-white/60 rounded-full">
                    <div className="h-2 bg-primary rounded-full" style={{ width: `${f.progressPct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 tabular-nums w-8">{f.progressPct}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Stage</div>
                    <div className="text-[11px] font-semibold text-gray-800 mt-0.5 truncate">{f.currentStage}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Finish</div>
                    <div className="text-[11px] font-semibold text-gray-800 mt-0.5 tabular-nums">{formatDate(f.projectedFinish)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">SPI</div>
                    <div className={`text-[11px] font-bold mt-0.5 tabular-nums ${fc.text}`}>{f.spi.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
