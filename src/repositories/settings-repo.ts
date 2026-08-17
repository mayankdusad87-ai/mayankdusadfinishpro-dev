import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value as T;
}

export async function setAppSetting<T>(key: string, value: T): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: value as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

export async function getStageWeights(): Promise<Record<string, number> | null> {
  return getAppSetting<Record<string, number>>('stage_weights');
}

export async function setStageWeights(weights: Record<string, number>): Promise<void> {
  return setAppSetting('stage_weights', weights);
}

export async function getPaintDaysPerFlat(): Promise<number | null> {
  return getAppSetting<number>('paint_days_per_flat');
}

export async function setPaintDaysPerFlat(days: number): Promise<void> {
  return setAppSetting('paint_days_per_flat', days);
}

// ---- Management Access Control ----

export interface ManagementAccess {
  dashboard: boolean;
  insights: boolean;
  photos: boolean;
}

const DEFAULT_MANAGEMENT_ACCESS: ManagementAccess = {
  dashboard: true,
  insights: true,
  photos: true,
};

export async function getManagementAccess(): Promise<ManagementAccess> {
  const stored = await getAppSetting<ManagementAccess>('management_access');
  if (!stored) return DEFAULT_MANAGEMENT_ACCESS;
  // Merge with defaults in case new keys are added later
  return { ...DEFAULT_MANAGEMENT_ACCESS, ...stored };
}

export async function setManagementAccess(access: ManagementAccess): Promise<void> {
  return setAppSetting('management_access', access);
}

export { DEFAULT_MANAGEMENT_ACCESS };
