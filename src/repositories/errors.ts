import { supabase } from '@/lib/supabase';
import type { AppErrorRow } from '@/types/database.types';

export function logAppError(action: string, rawError: string, userFriendly: string, extra?: Record<string, unknown>) {
  console.error(`[${action}]`, rawError);
  supabase.auth.getUser().then(({ data }) => {
    supabase.from('app_errors').insert({
      user_id: data.user?.id || null,
      user_email: data.user?.email || null,
      action,
      raw_error: rawError,
      friendly_message: userFriendly,
      context: extra ? JSON.stringify(extra) : null,
      page_url: typeof window !== 'undefined' ? window.location.pathname : null,
    }).then(() => {});
  });
}

export function friendlyError(raw: string, context: string, extra?: Record<string, unknown>): string {
  const lower = raw.toLowerCase();
  let friendly: string;
  if (lower.includes('row level security') || lower.includes('rls'))
    friendly = `Permission denied: unable to ${context}. Please contact admin.`;
  else if (lower.includes('duplicate key') || lower.includes('unique constraint'))
    friendly = `This ${context} already exists.`;
  else if (lower.includes('network') || lower.includes('fetch'))
    friendly = `Network error while trying to ${context}. Check your internet connection.`;
  else if (lower.includes('storage') && lower.includes('not found'))
    friendly = `File not found. It may have been deleted already.`;
  else if (lower.includes('payload too large') || lower.includes('too large'))
    friendly = `File is too large to upload. Please reduce the file size.`;
  else if (lower.includes('jwt') || lower.includes('token') || lower.includes('auth'))
    friendly = `Session expired. Please log in again.`;
  else
    friendly = `Something went wrong while trying to ${context}. Please try again.`;
  logAppError(context, raw, friendly, extra);
  return friendly;
}

export type { AppErrorRow as AppError };

export async function getAppErrors(filters?: { startDate?: string; endDate?: string; action?: string }): Promise<AppErrorRow[]> {
  let query = supabase
    .from('app_errors')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters?.startDate) query = query.gte('created_at', filters.startDate);
  if (filters?.endDate) query = query.lte('created_at', filters.endDate + 'T23:59:59');
  if (filters?.action) query = query.ilike('action', `%${filters.action}%`);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}
