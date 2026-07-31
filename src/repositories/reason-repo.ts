import { supabase } from '@/lib/supabase';
import type { ReasonRow } from '@/types/database.types';
import { friendlyError } from './errors';

export type Reason = ReasonRow;

export async function getReasons(): Promise<Reason[]> {
  const { data, error } = await supabase
    .from('reasons')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getActiveReasons(): Promise<Reason[]> {
  const { data, error } = await supabase
    .from('reasons')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createReason(label: string, sortOrder: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reasons').insert({ label, sort_order: sortOrder });
  if (error) return { error: friendlyError(error.message, 'create reason') };
  return { error: null };
}

export async function updateReason(id: string, updates: { label?: string; is_active?: boolean; sort_order?: number }): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reasons').update(updates).eq('id', id);
  if (error) return { error: friendlyError(error.message, 'update reason') };
  return { error: null };
}

export async function deleteReason(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reasons').delete().eq('id', id);
  if (error) return { error: friendlyError(error.message, 'delete reason') };
  return { error: null };
}
