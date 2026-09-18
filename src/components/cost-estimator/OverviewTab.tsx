'use client';

import { useState } from 'react';
import type { ProjectCostData, CostLineItem } from '@/repositories/cost-repo';
import { computeSummaries, formatINR, formatINRFull, lineItemTotal } from './cost-helpers';

interface Props {
  data: ProjectCostData;
  onRefresh: () => void;
}

export default function OverviewTab({ data, onRefresh }: Props) {
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set());

  const { packageSummaries, grandTotalBudget, grandTotalPaid, grandRemaining, materialBudget, labourBudget, workContractBudget } =
    computeSummaries(data, excludedIds);

  const paidPercent = grandTotalBudget > 0 ? Math.round((grandTotalPaid / grandTotalBudget) * 100) : 0;

  function toggleExclude(itemId: string) {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function togglePkg(pkgId: string) {
    setExpandedPkgs(prev => {
      const next = new Set(prev);
      if (next.has(pkgId)) next.delete(pkgId);
      else next.add(pkgId);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Budget" value={formatINR(grandTotalBudget)} sub={formatINRFull(grandTotalBudget)} color="blue" />
        <KPICard label="Payment Done" value={formatINR(grandTotalPaid)} sub={`${paidPercent}% of budget`} color="green" />
        <KPICard label="Cost to Complete" value={formatINR(grandRemaining)} sub={formatINRFull(grandRemaining)} color="amber" />
        <KPICard
          label="Budget Split"
          value=""
          color="purple"
          custom={
            <div className="space-y-1.5 mt-1">
              <SplitRow label="Material" amount={materialBudget} total={grandTotalBudget} color="bg-blue-500" />
              <SplitRow label="Labour" amount={labourBudget} total={grandTotalBudget} color="bg-emerald-500" />
              <SplitRow label="Work Contract" amount={workContractBudget} total={grandTotalBudget} color="bg-orange-500" />
            </div>
          }
        />
      </div>

      {/* What-if banner */}
      {excludedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-sm text-amber-800 font-medium">
              What-if mode: {excludedIds.size} item{excludedIds.size > 1 ? 's' : ''} excluded
            </span>
          </div>
          <button
            onClick={() => setExcludedIds(new Set())}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
          >
            Reset
          </button>
        </div>
      )}

      {/* Package breakdown */}
      {packageSummaries.length === 0 ? (
        <EmptyState onRefresh={onRefresh} />
      ) : (
        <div className="space-y-3">
          {packageSummaries.map(ps => {
            const expanded = expandedPkgs.has(ps.pkg.id);
            const pkgPaidPct = ps.totalBudget > 0 ? Math.round((ps.totalPaid / ps.totalBudget) * 100) : 0;
            return (
              <div key={ps.pkg.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Package header */}
                <button
                  onClick={() => togglePkg(ps.pkg.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    <span className="font-semibold text-gray-900">{ps.pkg.name}</span>
                    <span className="text-xs text-gray-400">{ps.categories.length} categories</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">Budget</div>
                      <div className="font-medium text-gray-900">{formatINR(ps.totalBudget)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">Paid</div>
                      <div className="font-medium text-emerald-600">{formatINR(ps.totalPaid)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">Remaining</div>
                      <div className="font-medium text-amber-600">{formatINR(ps.remaining)}</div>
                    </div>
                    <div className="w-20">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pkgPaidPct}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 text-center mt-0.5">{pkgPaidPct}%</div>
                    </div>
                  </div>
                </button>

                {/* Expanded category table */}
                {expanded && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs">
                          <th className="text-left px-5 py-2.5 font-medium">Category</th>
                          <th className="text-right px-3 py-2.5 font-medium">Budget</th>
                          <th className="text-right px-3 py-2.5 font-medium">Paid</th>
                          <th className="text-right px-3 py-2.5 font-medium">Remaining</th>
                          <th className="text-right px-5 py-2.5 font-medium w-20">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ps.categories.map(cs => {
                          const catPct = cs.totalBudget > 0 ? Math.round((cs.totalPaid / cs.totalBudget) * 100) : 0;
                          const items = data.lineItems.filter(li => li.category_id === cs.category.id && li.is_active);
                          return (
                            <tr key={cs.category.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                              <td className="px-5 py-3">
                                <div className="font-medium text-gray-800">{cs.category.name}</div>
                                {items.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {items.map(item => (
                                      <WhatIfChip
                                        key={item.id}
                                        item={item}
                                        excluded={excludedIds.has(item.id)}
                                        onToggle={() => toggleExclude(item.id)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="text-right px-3 py-3 font-medium text-gray-900">{formatINR(cs.totalBudget)}</td>
                              <td className="text-right px-3 py-3 text-emerald-600">{formatINR(cs.totalPaid)}</td>
                              <td className="text-right px-3 py-3 text-amber-600">{formatINR(cs.remaining)}</td>
                              <td className="text-right px-5 py-3">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-16 ml-auto">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${catPct}%` }} />
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{catPct}%</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, sub, color, custom }: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  custom?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-200/50',
    green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200/50',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-200/50',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-200/50',
  };
  const textColor: Record<string, string> = {
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      {custom || (
        <>
          <div className={`text-xl font-bold mt-1 ${textColor[color]}`}>{value}</div>
          {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
        </>
      )}
    </div>
  );
}

function SplitRow({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-600 flex-1">{label}</span>
      <span className="text-gray-500 font-medium">{pct}%</span>
    </div>
  );
}

function WhatIfChip({ item, excluded, onToggle }: { item: CostLineItem; excluded: boolean; onToggle: () => void }) {
  const cost = lineItemTotal(item);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
        excluded
          ? 'bg-amber-100 text-amber-700 line-through'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      title={`${item.name}: ${formatINRFull(cost)} — click to ${excluded ? 'include' : 'exclude'}`}
    >
      {item.name}
      <span className="opacity-60">{formatINR(cost)}</span>
    </button>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="text-center py-16">
      <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
      </svg>
      <h3 className="text-lg font-semibold text-gray-700">No budget data yet</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
        Start by adding packages and categories in the Detailed Breakdown tab, then add line items with costs.
      </p>
    </div>
  );
}
