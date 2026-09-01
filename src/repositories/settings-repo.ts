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

/** Fetch stage weights + paint days in a single DB call */
export async function getInsightsSettings(): Promise<{
  stageWeights: Record<string, number> | null;
  paintDaysPerFlat: number | null;
}> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['stage_weights', 'paint_days_per_flat']);
  if (error || !data) return { stageWeights: null, paintDaysPerFlat: null };
  const map = Object.fromEntries(data.map(r => [r.key, r.value]));
  return {
    stageWeights: (map['stage_weights'] as Record<string, number>) || null,
    paintDaysPerFlat: (map['paint_days_per_flat'] as number) || null,
  };
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

// ---- Vendor Mappings (per-project) ----

export interface VendorMapping {
  stage: string;
  activity: string;
  vendor: string;
}

export async function getVendorMappings(projectId: string): Promise<VendorMapping[]> {
  return (await getAppSetting<VendorMapping[]>(`vendor_mappings_${projectId}`)) || [];
}

export async function setVendorMappings(projectId: string, mappings: VendorMapping[]): Promise<void> {
  return setAppSetting(`vendor_mappings_${projectId}`, mappings);
}

// ---- Backdate Limit ----

const DEFAULT_BACKDATE_DAYS = 3;

export async function getBackdateLimit(): Promise<number> {
  const stored = await getAppSetting<number>('backdate_limit_days');
  return stored ?? DEFAULT_BACKDATE_DAYS;
}

export async function setBackdateLimit(days: number, changedBy: string): Promise<void> {
  const oldValue = await getBackdateLimit();
  await setAppSetting('backdate_limit_days', days);
  await logSettingChange('backdate_limit_days', String(oldValue), String(days), changedBy);
}

// ---- Setting Audit Log ----

/**
 * Log a setting change to app_settings under the key `setting_audit_log`.
 * Stores the last 50 changes as a JSON array — no extra table needed.
 */
export async function logSettingChange(
  settingKey: string,
  oldValue: string,
  newValue: string,
  changedBy: string,
): Promise<void> {
  const existing = await getAppSetting<SettingAuditEntry[]>('setting_audit_log') || [];
  const entry: SettingAuditEntry = {
    setting_key: settingKey,
    old_value: oldValue,
    new_value: newValue,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
  };
  // Keep the latest 50 entries
  const updated = [entry, ...existing].slice(0, 50);
  await setAppSetting('setting_audit_log', updated);
}

export interface SettingAuditEntry {
  setting_key: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
}

export async function getSettingAuditLog(settingKey?: string): Promise<SettingAuditEntry[]> {
  const entries = await getAppSetting<SettingAuditEntry[]>('setting_audit_log') || [];
  if (settingKey) return entries.filter(e => e.setting_key === settingKey);
  return entries;
}
