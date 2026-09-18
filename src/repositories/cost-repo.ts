import { supabaseAdmin } from '@/lib/supabase-admin';

// Cast to `any` so the typed client accepts new cost tables before the DB types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

// ---- Types ----

export interface CostPackage {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CostCategory {
  id: string;
  package_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CostLineItem {
  id: string;
  category_id: string;
  name: string;
  uom: string;
  is_lump_sum: boolean;
  quantity: number;
  material_rate: number;
  labour_rate: number;
  work_contract_rate: number;
  material_lump: number;
  labour_lump: number;
  work_contract_lump: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CostPayment {
  id: string;
  category_id: string;
  cost_type: 'material' | 'labour' | 'work_contract';
  amount: number;
  payment_date: string;
  note: string;
  created_by: string | null;
  created_at: string;
}

// ---- Packages ----

export async function getPackages(projectId: string): Promise<CostPackage[]> {
  const { data, error } = await db
    .from('cost_packages')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createPackage(projectId: string, name: string, sortOrder: number = 0): Promise<CostPackage> {
  const { data, error } = await db
    .from('cost_packages')
    .insert({ project_id: projectId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePackage(id: string, updates: { name?: string; sort_order?: number }): Promise<CostPackage> {
  const { data, error } = await db
    .from('cost_packages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await db.from('cost_packages').delete().eq('id', id);
  if (error) throw error;
}

// ---- Categories ----

export async function getCategories(packageId: string): Promise<CostCategory[]> {
  const { data, error } = await db
    .from('cost_categories')
    .select('*')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getCategoriesByProject(projectId: string): Promise<(CostCategory & { package_id: string })[]> {
  const { data: packages } = await db
    .from('cost_packages')
    .select('id')
    .eq('project_id', projectId);
  if (!packages || packages.length === 0) return [];

  const packageIds = packages.map((p: { id: string }) => p.id);
  const { data, error } = await db
    .from('cost_categories')
    .select('*')
    .in('package_id', packageIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createCategory(packageId: string, name: string, sortOrder: number = 0): Promise<CostCategory> {
  const { data, error } = await db
    .from('cost_categories')
    .insert({ package_id: packageId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, updates: { name?: string; sort_order?: number }): Promise<CostCategory> {
  const { data, error } = await db
    .from('cost_categories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db.from('cost_categories').delete().eq('id', id);
  if (error) throw error;
}

// ---- Line Items ----

export async function getLineItems(categoryId: string): Promise<CostLineItem[]> {
  const { data, error } = await db
    .from('cost_line_items')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getLineItemsByProject(projectId: string): Promise<CostLineItem[]> {
  const categories = await getCategoriesByProject(projectId);
  if (categories.length === 0) return [];

  const categoryIds = categories.map((c: { id: string }) => c.id);
  const { data, error } = await db
    .from('cost_line_items')
    .select('*')
    .in('category_id', categoryIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createLineItem(
  categoryId: string,
  item: {
    name: string;
    uom?: string;
    is_lump_sum?: boolean;
    quantity?: number;
    material_rate?: number;
    labour_rate?: number;
    work_contract_rate?: number;
    material_lump?: number;
    labour_lump?: number;
    work_contract_lump?: number;
    sort_order?: number;
  },
): Promise<CostLineItem> {
  const { data, error } = await db
    .from('cost_line_items')
    .insert({ category_id: categoryId, ...item })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLineItem(
  id: string,
  updates: Partial<Omit<CostLineItem, 'id' | 'category_id' | 'created_at'>>,
): Promise<CostLineItem> {
  const { data, error } = await db
    .from('cost_line_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLineItem(id: string): Promise<void> {
  const { error } = await db.from('cost_line_items').delete().eq('id', id);
  if (error) throw error;
}

// ---- Payments ----

export async function getPayments(categoryId: string): Promise<CostPayment[]> {
  const { data, error } = await db
    .from('cost_payments')
    .select('*')
    .eq('category_id', categoryId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPaymentsByProject(projectId: string): Promise<CostPayment[]> {
  const categories = await getCategoriesByProject(projectId);
  if (categories.length === 0) return [];

  const categoryIds = categories.map((c: { id: string }) => c.id);
  const { data, error } = await db
    .from('cost_payments')
    .select('*')
    .in('category_id', categoryIds)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPayment(
  categoryId: string,
  payment: {
    cost_type: 'material' | 'labour' | 'work_contract';
    amount: number;
    payment_date: string;
    note?: string;
    created_by?: string;
  },
): Promise<CostPayment> {
  const { data, error } = await db
    .from('cost_payments')
    .insert({ category_id: categoryId, ...payment })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await db.from('cost_payments').delete().eq('id', id);
  if (error) throw error;
}

// ---- Full project data (single fetch for the UI) ----

export interface ProjectCostData {
  packages: CostPackage[];
  categories: CostCategory[];
  lineItems: CostLineItem[];
  payments: CostPayment[];
}

export async function getFullProjectCostData(projectId: string): Promise<ProjectCostData> {
  const packages = await getPackages(projectId);
  if (packages.length === 0) {
    return { packages: [], categories: [], lineItems: [], payments: [] };
  }

  const packageIds = packages.map((p: { id: string }) => p.id);

  const { data: categories } = await db
    .from('cost_categories')
    .select('*')
    .in('package_id', packageIds)
    .order('sort_order', { ascending: true });

  const catIds = (categories || []).map((c: { id: string }) => c.id);

  let lineItems: CostLineItem[] = [];
  let payments: CostPayment[] = [];

  if (catIds.length > 0) {
    const { data: items } = await db
      .from('cost_line_items')
      .select('*')
      .in('category_id', catIds)
      .order('sort_order', { ascending: true });
    lineItems = items || [];

    const { data: pays } = await db
      .from('cost_payments')
      .select('*')
      .in('category_id', catIds)
      .order('payment_date', { ascending: false });
    payments = pays || [];
  }

  return {
    packages,
    categories: categories || [],
    lineItems,
    payments,
  };
}
