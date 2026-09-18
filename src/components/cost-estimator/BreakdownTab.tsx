'use client';

import { useState } from 'react';
import type { ProjectCostData, CostPackage, CostCategory, CostLineItem } from '@/repositories/cost-repo';
import { lineItemBudget, formatINR, formatINRFull } from './cost-helpers';

interface Props {
  data: ProjectCostData;
  projectId: string;
  onRefresh: () => void;
}

type CostTypeFilter = 'all' | 'material' | 'labour' | 'work_contract';

export default function BreakdownTab({ data, projectId, onRefresh }: Props) {
  const [filterPkg, setFilterPkg] = useState<string>('all');
  const [filterCostType, setFilterCostType] = useState<CostTypeFilter>('all');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // CRUD modal states
  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddCat, setShowAddCat] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<CostLineItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline edit for packages/categories
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'pkg' | 'cat' | 'item'; id: string } | null>(null);

  const filteredPackages = filterPkg === 'all' ? data.packages : data.packages.filter(p => p.id === filterPkg);

  function toggleCat(catId: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // ---- API helpers ----

  async function apiCall(url: string, method: string, body?: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPackage(name: string) {
    await apiCall('/api/cost-estimator/packages', 'POST', { projectId, name });
    setShowAddPkg(false);
  }

  async function handleUpdatePkg(id: string, name: string) {
    await apiCall('/api/cost-estimator/packages', 'PUT', { id, name });
    setEditingPkg(null);
  }

  async function handleDeletePkg(id: string) {
    await apiCall(`/api/cost-estimator/packages?id=${id}`, 'DELETE');
    setConfirmDelete(null);
  }

  async function handleAddCategory(packageId: string, name: string) {
    await apiCall('/api/cost-estimator/categories', 'POST', { packageId, name });
    setShowAddCat(null);
  }

  async function handleUpdateCat(id: string, name: string) {
    await apiCall('/api/cost-estimator/categories', 'PUT', { id, name });
    setEditingCat(null);
  }

  async function handleDeleteCat(id: string) {
    await apiCall(`/api/cost-estimator/categories?id=${id}`, 'DELETE');
    setConfirmDelete(null);
  }

  async function handleAddLineItem(categoryId: string, item: Partial<CostLineItem>) {
    await apiCall('/api/cost-estimator/line-items', 'POST', { categoryId, ...item });
    setShowAddItem(null);
  }

  async function handleUpdateLineItem(id: string, updates: Partial<CostLineItem>) {
    await apiCall('/api/cost-estimator/line-items', 'PUT', { id, ...updates });
    setEditItem(null);
  }

  async function handleDeleteItem(id: string) {
    await apiCall(`/api/cost-estimator/line-items?id=${id}`, 'DELETE');
    setConfirmDelete(null);
  }

  async function handleToggleActive(item: CostLineItem) {
    await apiCall('/api/cost-estimator/line-items', 'PUT', { id: item.id, is_active: !item.is_active });
  }

  return (
    <div className="space-y-4">
      {/* Filters + Add Package */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterPkg}
          onChange={e => setFilterPkg(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Packages</option>
          {data.packages.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filterCostType}
          onChange={e => setFilterCostType(e.target.value as CostTypeFilter)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Cost Types</option>
          <option value="material">Material</option>
          <option value="labour">Labour</option>
          <option value="work_contract">Work Contract</option>
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setShowAddPkg(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Package
        </button>
      </div>

      {/* Packages -> Categories -> Line Items */}
      {filteredPackages.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No packages yet. Click &ldquo;Add Package&rdquo; to get started.
        </div>
      ) : (
        filteredPackages.map(pkg => {
          const pkgCategories = data.categories.filter(c => c.package_id === pkg.id);
          return (
            <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Package header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                {editingPkg === pkg.id ? (
                  <InlineEdit
                    value={editName}
                    onChange={setEditName}
                    onSave={() => handleUpdatePkg(pkg.id, editName)}
                    onCancel={() => setEditingPkg(null)}
                  />
                ) : (
                  <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowAddCat(pkg.id)}
                    className="p-1.5 text-primary hover:bg-orange-50 rounded-lg text-xs font-medium flex items-center gap-1"
                    title="Add Category"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Category
                  </button>
                  <button
                    onClick={() => { setEditingPkg(pkg.id); setEditName(pkg.name); }}
                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg"
                    title="Edit Package"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  {confirmDelete?.type === 'pkg' && confirmDelete.id === pkg.id ? (
                    <ConfirmDeleteButtons
                      onConfirm={() => handleDeletePkg(pkg.id)}
                      onCancel={() => setConfirmDelete(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setConfirmDelete({ type: 'pkg', id: pkg.id })}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete Package"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Categories */}
              {pkgCategories.length === 0 ? (
                <div className="px-5 py-6 text-center text-gray-400 text-sm">
                  No categories. Click &ldquo;+ Category&rdquo; above.
                </div>
              ) : (
                pkgCategories.map(cat => {
                  const expanded = expandedCats.has(cat.id);
                  const items = data.lineItems.filter(li => li.category_id === cat.id);
                  const filteredItems = filterCostType === 'all' ? items : items.filter(li => {
                    const b = lineItemBudget(li);
                    if (filterCostType === 'material') return b.material > 0;
                    if (filterCostType === 'labour') return b.labour > 0;
                    return b.workContract > 0;
                  });

                  return (
                    <div key={cat.id} className="border-t border-gray-100">
                      {/* Category row */}
                      <div className="flex items-center gap-2 px-5 py-2.5 hover:bg-gray-50">
                        <button onClick={() => toggleCat(cat.id)} className="flex items-center gap-2 flex-1 cursor-pointer">
                          <svg
                            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                          {editingCat === cat.id ? (
                            <InlineEdit
                              value={editName}
                              onChange={setEditName}
                              onSave={() => handleUpdateCat(cat.id, editName)}
                              onCancel={() => setEditingCat(null)}
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                          )}
                          <span className="text-xs text-gray-400">{items.length} items</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowAddItem(cat.id)}
                            className="p-1 text-primary hover:bg-orange-50 rounded text-xs flex items-center gap-0.5"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Item
                          </button>
                          <button
                            onClick={() => { setEditingCat(cat.id); setEditName(cat.name); }}
                            className="p-1 text-gray-400 hover:text-primary rounded"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {confirmDelete?.type === 'cat' && confirmDelete.id === cat.id ? (
                            <ConfirmDeleteButtons
                              onConfirm={() => handleDeleteCat(cat.id)}
                              onCancel={() => setConfirmDelete(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setConfirmDelete({ type: 'cat', id: cat.id })}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Line items table */}
                      {expanded && (
                        <div className="px-5 pb-3 overflow-x-auto">
                          {filteredItems.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">
                              No line items. Click &ldquo;+ Item&rdquo; to add.
                            </div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-2 pr-2 font-medium">Item</th>
                                  <th className="text-left py-2 px-2 font-medium">UOM</th>
                                  <th className="text-right py-2 px-2 font-medium">Qty</th>
                                  <th className="text-right py-2 px-2 font-medium">Material</th>
                                  <th className="text-right py-2 px-2 font-medium">Labour</th>
                                  <th className="text-right py-2 px-2 font-medium">Work Contract</th>
                                  <th className="text-right py-2 px-2 font-medium">Total</th>
                                  <th className="py-2 pl-2 w-20"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredItems.map(item => {
                                  const b = lineItemBudget(item);
                                  const total = b.material + b.labour + b.workContract;
                                  return (
                                    <tr key={item.id} className={`border-t border-gray-50 ${!item.is_active ? 'opacity-40' : ''}`}>
                                      <td className="py-2 pr-2 text-gray-800 font-medium">{item.name}</td>
                                      <td className="py-2 px-2 text-gray-500">{item.is_lump_sum ? 'Lump Sum' : item.uom}</td>
                                      <td className="py-2 px-2 text-right text-gray-600">{item.is_lump_sum ? '-' : Number(item.quantity).toLocaleString('en-IN')}</td>
                                      <td className="py-2 px-2 text-right text-gray-600">{formatINR(b.material)}</td>
                                      <td className="py-2 px-2 text-right text-gray-600">{formatINR(b.labour)}</td>
                                      <td className="py-2 px-2 text-right text-gray-600">{formatINR(b.workContract)}</td>
                                      <td className="py-2 px-2 text-right font-medium text-gray-900">{formatINR(total)}</td>
                                      <td className="py-2 pl-2">
                                        <div className="flex items-center gap-0.5 justify-end">
                                          <button
                                            onClick={() => setEditItem(item)}
                                            className="p-1 text-gray-400 hover:text-primary rounded"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={() => handleToggleActive(item)}
                                            className={`p-1 rounded ${item.is_active ? 'text-gray-400 hover:text-orange-600' : 'text-gray-400 hover:text-green-600'}`}
                                            title={item.is_active ? 'Deactivate' : 'Activate'}
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              {item.is_active ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                              ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                              )}
                                            </svg>
                                          </button>
                                          {confirmDelete?.type === 'item' && confirmDelete.id === item.id ? (
                                            <ConfirmDeleteButtons
                                              small
                                              onConfirm={() => handleDeleteItem(item.id)}
                                              onCancel={() => setConfirmDelete(null)}
                                            />
                                          ) : (
                                            <button
                                              onClick={() => setConfirmDelete({ type: 'item', id: item.id })}
                                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })
      )}

      {/* Modals */}
      {showAddPkg && <AddNameModal title="Add Package" onSave={handleAddPackage} onClose={() => setShowAddPkg(false)} saving={saving} />}
      {showAddCat && <AddNameModal title="Add Category" onSave={(name) => handleAddCategory(showAddCat, name)} onClose={() => setShowAddCat(null)} saving={saving} />}
      {showAddItem && <LineItemModal categoryId={showAddItem} onSave={handleAddLineItem} onClose={() => setShowAddItem(null)} saving={saving} />}
      {editItem && (
        <LineItemModal
          categoryId={editItem.category_id}
          item={editItem}
          onSave={(_, updates) => handleUpdateLineItem(editItem.id, updates)}
          onClose={() => setEditItem(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function InlineEdit({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        className="px-2 py-1 border border-primary rounded text-sm focus:outline-none"
        autoFocus
      />
      <button onClick={onSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function ConfirmDeleteButtons({ onConfirm, onCancel, small }: { onConfirm: () => void; onCancel: () => void; small?: boolean }) {
  const cls = small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
  return (
    <div className="flex items-center gap-1">
      <button onClick={onConfirm} className={`${cls} font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors`}>
        Delete
      </button>
      <button onClick={onCancel} className={`${cls} font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors`}>
        Cancel
      </button>
    </div>
  );
}

function AddNameModal({ title, onSave, onClose, saving }: {
  title: string; onSave: (name: string) => void; onClose: () => void; saving: boolean;
}) {
  const [name, setName] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter name..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary mb-4"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineItemModal({ categoryId, item, onSave, onClose, saving }: {
  categoryId: string;
  item?: CostLineItem;
  onSave: (categoryId: string, data: Partial<CostLineItem>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(item?.name || '');
  const [isLumpSum, setIsLumpSum] = useState(item?.is_lump_sum || false);
  const [uom, setUom] = useState(item?.uom || 'sqft');
  const [quantity, setQuantity] = useState(String(item?.quantity || ''));
  const [materialRate, setMaterialRate] = useState(String(item?.material_rate || ''));
  const [labourRate, setLabourRate] = useState(String(item?.labour_rate || ''));
  const [wcRate, setWcRate] = useState(String(item?.work_contract_rate || ''));
  const [materialLump, setMaterialLump] = useState(String(item?.material_lump || ''));
  const [labourLump, setLabourLump] = useState(String(item?.labour_lump || ''));
  const [wcLump, setWcLump] = useState(String(item?.work_contract_lump || ''));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: Partial<CostLineItem> = {
      name: name.trim(),
      is_lump_sum: isLumpSum,
      uom: isLumpSum ? 'lump_sum' : uom,
      quantity: isLumpSum ? 0 : parseFloat(quantity) || 0,
      material_rate: isLumpSum ? 0 : parseFloat(materialRate) || 0,
      labour_rate: isLumpSum ? 0 : parseFloat(labourRate) || 0,
      work_contract_rate: isLumpSum ? 0 : parseFloat(wcRate) || 0,
      material_lump: isLumpSum ? parseFloat(materialLump) || 0 : 0,
      labour_lump: isLumpSum ? parseFloat(labourLump) || 0 : 0,
      work_contract_lump: isLumpSum ? parseFloat(wcLump) || 0 : 0,
    };

    onSave(categoryId, payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{item ? 'Edit Line Item' : 'Add Line Item'}</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLumpSum}
                onChange={e => setIsLumpSum(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-gray-700">Lump Sum Entry</span>
            </label>
          </div>

          {!isLumpSum && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">UOM</label>
                <select
                  value={uom}
                  onChange={e => setUom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="sqft">Sq.Ft</option>
                  <option value="rft">R.Ft</option>
                  <option value="nos">Nos</option>
                  <option value="kg">Kg</option>
                  <option value="lot">Lot</option>
                  <option value="sqm">Sq.M</option>
                  <option value="cum">Cu.M</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {isLumpSum ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Lump Sum Amounts</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400">Material</span>
                  <input type="number" step="0.01" value={materialLump} onChange={e => setMaterialLump(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Labour</span>
                  <input type="number" step="0.01" value={labourLump} onChange={e => setLabourLump(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Work Contract</span>
                  <input type="number" step="0.01" value={wcLump} onChange={e => setWcLump(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Rates (per unit)</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400">Material Rate</span>
                  <input type="number" step="0.01" value={materialRate} onChange={e => setMaterialRate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Labour Rate</span>
                  <input type="number" step="0.01" value={labourRate} onChange={e => setLabourRate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Work Contract Rate</span>
                  <input type="number" step="0.01" value={wcRate} onChange={e => setWcRate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : item ? 'Update' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
