'use client';

import { useState } from 'react';
import type { ProjectCostData, CostActivity } from '@/repositories/cost-repo';
import { activityBudget, formatINR, formatINRFull } from './cost-helpers';

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
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  const [showAddPkg, setShowAddPkg] = useState(false);
  const [showAddCat, setShowAddCat] = useState<string | null>(null);
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [showAddActivity, setShowAddActivity] = useState<string | null>(null);
  const [editActivity, setEditActivity] = useState<CostActivity | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'pkg' | 'cat' | 'sub' | 'activity'; id: string } | null>(null);

  const filteredPackages = filterPkg === 'all' ? data.packages : data.packages.filter(p => p.id === filterPkg);

  function toggleCat(catId: string) {
    setExpandedCats(prev => { const n = new Set(prev); n.has(catId) ? n.delete(catId) : n.add(catId); return n; });
  }
  function toggleSub(subId: string) {
    setExpandedSubs(prev => { const n = new Set(prev); n.has(subId) ? n.delete(subId) : n.add(subId); return n; });
  }

  async function apiCall(url: string, method: string, body?: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) throw new Error(await res.text());
      onRefresh();
    } finally { setSaving(false); }
  }

  // Package CRUD
  async function handleAddPackage(name: string) { await apiCall('/api/cost-estimator/packages', 'POST', { projectId, name }); setShowAddPkg(false); }
  async function handleUpdatePkg(id: string, name: string) { await apiCall('/api/cost-estimator/packages', 'PUT', { id, name }); setEditingPkg(null); }
  async function handleDeletePkg(id: string) { await apiCall(`/api/cost-estimator/packages?id=${id}`, 'DELETE'); setConfirmDelete(null); }

  // Category CRUD
  async function handleAddCategory(packageId: string, name: string) { await apiCall('/api/cost-estimator/categories', 'POST', { packageId, name }); setShowAddCat(null); }
  async function handleUpdateCat(id: string, name: string) { await apiCall('/api/cost-estimator/categories', 'PUT', { id, name }); setEditingCat(null); }
  async function handleDeleteCat(id: string) { await apiCall(`/api/cost-estimator/categories?id=${id}`, 'DELETE'); setConfirmDelete(null); }

  // Subcategory CRUD
  async function handleAddSubcategory(categoryId: string, name: string) { await apiCall('/api/cost-estimator/subcategories', 'POST', { categoryId, name }); setShowAddSub(null); }
  async function handleUpdateSub(id: string, name: string) { await apiCall('/api/cost-estimator/subcategories', 'PUT', { id, name }); setEditingSub(null); }
  async function handleDeleteSub(id: string) { await apiCall(`/api/cost-estimator/subcategories?id=${id}`, 'DELETE'); setConfirmDelete(null); }

  // Activity CRUD
  async function handleAddActivity(subcategoryId: string, item: Partial<CostActivity>) { await apiCall('/api/cost-estimator/line-items', 'POST', { subcategoryId, ...item }); setShowAddActivity(null); }
  async function handleUpdateActivity(id: string, updates: Partial<CostActivity>) { await apiCall('/api/cost-estimator/line-items', 'PUT', { id, ...updates }); setEditActivity(null); }
  async function handleDeleteActivity(id: string) { await apiCall(`/api/cost-estimator/line-items?id=${id}`, 'DELETE'); setConfirmDelete(null); }
  async function handleToggleActive(item: CostActivity) { await apiCall('/api/cost-estimator/line-items', 'PUT', { id: item.id, is_active: !item.is_active }); }

  return (
    <div className="space-y-4">
      {/* Filters + Add Package */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterPkg} onChange={e => setFilterPkg(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Packages</option>
          {data.packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterCostType} onChange={e => setFilterCostType(e.target.value as CostTypeFilter)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="all">All Cost Types</option>
          <option value="material">Material</option>
          <option value="labour">Labour</option>
          <option value="work_contract">Work Contract</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setShowAddPkg(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
          <PlusIcon /> Add Package
        </button>
      </div>

      {/* Package list */}
      {filteredPackages.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No packages yet. Click &ldquo;Add Package&rdquo; to get started.</div>
      ) : (
        filteredPackages.map(pkg => {
          const pkgCategories = data.categories.filter(c => c.package_id === pkg.id);
          return (
            <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Package header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                {editingPkg === pkg.id ? (
                  <InlineEdit value={editName} onChange={setEditName} onSave={() => handleUpdatePkg(pkg.id, editName)} onCancel={() => setEditingPkg(null)} />
                ) : (
                  <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                )}
                <div className="flex items-center gap-1">
                  <AddButton label="Category" onClick={() => setShowAddCat(pkg.id)} />
                  <EditButton onClick={() => { setEditingPkg(pkg.id); setEditName(pkg.name); }} />
                  <DeleteButton id={pkg.id} type="pkg" confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDelete={() => handleDeletePkg(pkg.id)} />
                </div>
              </div>

              {/* Categories */}
              {pkgCategories.length === 0 ? (
                <div className="px-5 py-6 text-center text-gray-400 text-sm">No categories. Click &ldquo;+ Category&rdquo; above.</div>
              ) : (
                pkgCategories.map(cat => {
                  const catExpanded = expandedCats.has(cat.id);
                  const catSubs = data.subcategories.filter(s => s.category_id === cat.id);
                  return (
                    <div key={cat.id} className="border-t border-gray-100">
                      {/* Category row */}
                      <div className="flex items-center gap-2 px-5 py-2.5 hover:bg-gray-50">
                        <button onClick={() => toggleCat(cat.id)} className="flex items-center gap-2 flex-1 cursor-pointer">
                          <ChevronIcon expanded={catExpanded} />
                          {editingCat === cat.id ? (
                            <InlineEdit value={editName} onChange={setEditName} onSave={() => handleUpdateCat(cat.id, editName)} onCancel={() => setEditingCat(null)} />
                          ) : (
                            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                          )}
                          <span className="text-xs text-gray-400">{catSubs.length} subcategories</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <AddButton label="Subcategory" onClick={() => setShowAddSub(cat.id)} />
                          <EditButton onClick={() => { setEditingCat(cat.id); setEditName(cat.name); }} small />
                          <DeleteButton id={cat.id} type="cat" confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDelete={() => handleDeleteCat(cat.id)} small />
                        </div>
                      </div>

                      {/* Subcategories */}
                      {catExpanded && catSubs.map(sub => {
                        const subExpanded = expandedSubs.has(sub.id);
                        const activities = data.activities.filter(a => a.subcategory_id === sub.id);
                        const filteredActivities = filterCostType === 'all' ? activities : activities.filter(a => {
                          const b = activityBudget(a);
                          if (filterCostType === 'material') return b.material > 0;
                          if (filterCostType === 'labour') return b.labour > 0;
                          return b.workContract > 0;
                        });

                        return (
                          <div key={sub.id} className="border-t border-gray-50 bg-gray-50/30">
                            {/* Subcategory row */}
                            <div className="flex items-center gap-2 pl-10 pr-5 py-2 hover:bg-gray-100/50">
                              <button onClick={() => toggleSub(sub.id)} className="flex items-center gap-2 flex-1 cursor-pointer">
                                <ChevronIcon expanded={subExpanded} size="small" />
                                {editingSub === sub.id ? (
                                  <InlineEdit value={editName} onChange={setEditName} onSave={() => handleUpdateSub(sub.id, editName)} onCancel={() => setEditingSub(null)} />
                                ) : (
                                  <span className="text-sm text-gray-600">{sub.name}</span>
                                )}
                                <span className="text-xs text-gray-400">{activities.length} activities</span>
                              </button>
                              <div className="flex items-center gap-1">
                                <AddButton label="Activity" onClick={() => setShowAddActivity(sub.id)} />
                                <EditButton onClick={() => { setEditingSub(sub.id); setEditName(sub.name); }} small />
                                <DeleteButton id={sub.id} type="sub" confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDelete={() => handleDeleteSub(sub.id)} small />
                              </div>
                            </div>

                            {/* Activities table */}
                            {subExpanded && (
                              <div className="pl-10 pr-5 pb-3 overflow-x-auto">
                                {filteredActivities.length === 0 ? (
                                  <div className="text-center py-3 text-gray-400 text-xs">No activities. Click &ldquo;+ Activity&rdquo; to add.</div>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-gray-500">
                                        <th className="text-left py-2 pr-2 font-medium">Activity</th>
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
                                      {filteredActivities.map(act => {
                                        const b = activityBudget(act);
                                        const total = b.material + b.labour + b.workContract;
                                        return (
                                          <tr key={act.id} className={`border-t border-gray-50 ${!act.is_active ? 'opacity-40' : ''}`}>
                                            <td className="py-2 pr-2 text-gray-800 font-medium">{act.name}</td>
                                            <td className="py-2 px-2 text-gray-500">{act.is_lump_sum ? 'Lump Sum' : act.uom}</td>
                                            <td className="py-2 px-2 text-right text-gray-600">{act.is_lump_sum ? '-' : Number(act.quantity).toLocaleString('en-IN')}</td>
                                            <td className="py-2 px-2 text-right text-gray-600">{formatINR(b.material)}</td>
                                            <td className="py-2 px-2 text-right text-gray-600">{formatINR(b.labour)}</td>
                                            <td className="py-2 px-2 text-right text-gray-600">{formatINR(b.workContract)}</td>
                                            <td className="py-2 px-2 text-right font-medium text-gray-900">{formatINR(total)}</td>
                                            <td className="py-2 pl-2">
                                              <div className="flex items-center gap-0.5 justify-end">
                                                <button onClick={() => setEditActivity(act)} className="p-1 text-gray-400 hover:text-primary rounded">
                                                  <PencilIcon />
                                                </button>
                                                <button onClick={() => handleToggleActive(act)}
                                                  className={`p-1 rounded ${act.is_active ? 'text-gray-400 hover:text-orange-600' : 'text-gray-400 hover:text-green-600'}`}
                                                  title={act.is_active ? 'Deactivate' : 'Activate'}>
                                                  <EyeIcon active={act.is_active} />
                                                </button>
                                                <DeleteButton id={act.id} type="activity" confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} onDelete={() => handleDeleteActivity(act.id)} small />
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
                      })}
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
      {showAddSub && <AddNameModal title="Add Subcategory" onSave={(name) => handleAddSubcategory(showAddSub, name)} onClose={() => setShowAddSub(null)} saving={saving} />}
      {showAddActivity && <ActivityModal subcategoryId={showAddActivity} onSave={handleAddActivity} onClose={() => setShowAddActivity(null)} saving={saving} />}
      {editActivity && <ActivityModal subcategoryId={editActivity.subcategory_id} item={editActivity} onSave={(_, u) => handleUpdateActivity(editActivity.id, u)} onClose={() => setEditActivity(null)} saving={saving} />}
    </div>
  );
}

// ---- Small icon/button components ----

function PlusIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
}
function PencilIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
}
function TrashIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function EyeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {active ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      )}
    </svg>
  );
}
function ChevronIcon({ expanded, size }: { expanded: boolean; size?: 'small' }) {
  const cls = size === 'small' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <svg className={`${cls} text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-1.5 text-primary hover:bg-orange-50 rounded-lg text-xs font-medium flex items-center gap-0.5">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      {label}
    </button>
  );
}

function EditButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} className={`${small ? 'p-1' : 'p-1.5'} text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg`}>
      <PencilIcon />
    </button>
  );
}

type DeleteType = 'pkg' | 'cat' | 'sub' | 'activity';

function DeleteButton({ id, type, confirmDelete, setConfirmDelete, onDelete, small }: {
  id: string; type: DeleteType; confirmDelete: { type: DeleteType; id: string } | null;
  setConfirmDelete: (v: { type: DeleteType; id: string } | null) => void; onDelete: () => void; small?: boolean;
}) {
  if (confirmDelete?.type === type && confirmDelete.id === id) {
    const cls = small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';
    return (
      <div className="flex items-center gap-1">
        <button onClick={onDelete} className={`${cls} font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors`}>Delete</button>
        <button onClick={() => setConfirmDelete(null)} className={`${cls} font-medium text-gray-500 hover:bg-gray-100 rounded transition-colors`}>Cancel</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirmDelete({ type, id })} className={`${small ? 'p-1' : 'p-1.5'} text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg`}>
      <TrashIcon />
    </button>
  );
}

function InlineEdit({ value, onChange, onSave, onCancel }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        className="px-2 py-1 border border-primary rounded text-sm focus:outline-none" autoFocus />
      <button onClick={onSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
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
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter name..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary mb-4"
          autoFocus onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim() || saving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityModal({ subcategoryId, item, onSave, onClose, saving }: {
  subcategoryId: string; item?: CostActivity;
  onSave: (subcategoryId: string, data: Partial<CostActivity>) => void; onClose: () => void; saving: boolean;
}) {
  const [name, setName] = useState(item?.name || '');
  const [isLumpSum, setIsLumpSum] = useState(item?.is_lump_sum || false);
  const [uom, setUom] = useState(item?.uom || 'sqm');
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
    const payload: Partial<CostActivity> = {
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
    onSave(subcategoryId, payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{item ? 'Edit Activity' : 'Add Activity'}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" autoFocus />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isLumpSum} onChange={e => setIsLumpSum(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30" />
            <span className="text-sm text-gray-700">Lump Sum Entry</span>
          </label>

          {!isLumpSum && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">UOM</label>
                <select value={uom} onChange={e => setUom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="sqm">SQM</option>
                  <option value="sqft">Sq.Ft</option>
                  <option value="rft">R.Ft</option>
                  <option value="nos">Nos</option>
                  <option value="kg">Kg</option>
                  <option value="lot">Lot</option>
                  <option value="cum">Cu.M</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Quantity / Area</label>
                <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          )}

          {isLumpSum ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Lump Sum Amounts</label>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[10px] text-gray-400">Material</span>
                  <input type="number" step="0.01" value={materialLump} onChange={e => setMaterialLump(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><span className="text-[10px] text-gray-400">Labour</span>
                  <input type="number" step="0.01" value={labourLump} onChange={e => setLabourLump(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><span className="text-[10px] text-gray-400">Work Contract</span>
                  <input type="number" step="0.01" value={wcLump} onChange={e => setWcLump(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Rates (per unit)</label>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[10px] text-gray-400">Material Rate</span>
                  <input type="number" step="0.01" value={materialRate} onChange={e => setMaterialRate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><span className="text-[10px] text-gray-400">Labour Rate</span>
                  <input type="number" step="0.01" value={labourRate} onChange={e => setLabourRate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
                <div><span className="text-[10px] text-gray-400">Work Contract Rate</span>
                  <input type="number" step="0.01" value={wcRate} onChange={e => setWcRate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={!name.trim() || saving}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : item ? 'Update' : 'Add Activity'}
          </button>
        </div>
      </form>
    </div>
  );
}
