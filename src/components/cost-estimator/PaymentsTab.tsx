'use client';

import { useState, useMemo } from 'react';
import type { ProjectCostData } from '@/repositories/cost-repo';
import { formatINRFull } from './cost-helpers';

interface Props {
  data: ProjectCostData;
  onRefresh: () => void;
}

export default function PaymentsTab({ data, onRefresh }: Props) {
  const [selectedPkg, setSelectedPkg] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [costType, setCostType] = useState<string>('material');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    if (!selectedPkg) return [];
    return data.categories.filter(c => c.package_id === selectedPkg);
  }, [selectedPkg, data.categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCat || !amount || parseFloat(amount) <= 0) return;

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/cost-estimator/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCat,
          cost_type: costType,
          amount: parseFloat(amount),
          payment_date: paymentDate,
          note: note.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setMsg({ type: 'success', text: `Payment of ${formatINRFull(parseFloat(amount))} recorded.` });
      setAmount('');
      setNote('');
      onRefresh();
    } catch {
      setMsg({ type: 'error', text: 'Failed to record payment. Please try again.' });
    }
    setSaving(false);
  }

  async function handleDelete(paymentId: string) {
    try {
      const res = await fetch(`/api/cost-estimator/payments?id=${paymentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setConfirmDeleteId(null);
      onRefresh();
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete payment.' });
    }
  }

  const costTypeLabel: Record<string, string> = {
    material: 'Material',
    labour: 'Labour',
    work_contract: 'Work Contract',
  };

  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    data.categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [data.categories]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Record Payment Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Payment</h3>

        {msg && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${msg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Package</label>
            <select
              value={selectedPkg}
              onChange={e => { setSelectedPkg(e.target.value); setSelectedCat(''); }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">Select package...</option>
              {data.packages.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              disabled={!selectedPkg}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Select category...</option>
              {availableCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost Type</label>
            <select
              value={costType}
              onChange={e => setCostType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="material">Material</option>
              <option value="labour">Labour</option>
              <option value="work_contract">Work Contract</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Advance to tiling vendor"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedCat || !amount || parseFloat(amount) <= 0 || saving}
            className="w-full px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </form>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>

        {data.payments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No payments recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {data.payments.slice(0, 50).map(payment => (
              <div key={payment.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  payment.cost_type === 'material' ? 'bg-blue-500' :
                  payment.cost_type === 'labour' ? 'bg-emerald-500' : 'bg-orange-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {formatINRFull(Number(payment.amount))}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {categoryNameMap[payment.category_id] || 'Unknown'} &middot; {costTypeLabel[payment.cost_type]}
                  </div>
                  {payment.note && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{payment.note}</div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {confirmDeleteId === payment.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(payment.id)}
                        className="px-2 py-0.5 text-[10px] font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(payment.id)}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
