import { supabase } from '@/lib/supabase';
import { logAppError } from './errors';

export interface ManagementUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
}

export async function createManagementUser(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
): Promise<{ error: string | null; userId?: string }> {
  try {
    const res = await fetch('/api/admin/create-management', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phone }),
    });
    let json: Record<string, unknown>;
    try { json = await res.json(); }
    catch { json = {}; }
    if (!res.ok) {
      const msg = typeof json.error === 'string' ? json.error : 'Failed to create management user';
      const debug = typeof json.debug === 'string' ? json.debug : '';
      logAppError('create-management', debug || JSON.stringify(json), msg);
      return { error: msg };
    }
    return { error: null, userId: json.userId as string };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = 'Network error creating management user. Check your connection.';
    logAppError('create-management', raw, msg);
    return { error: msg };
  }
}

export async function getManagementUsers(): Promise<ManagementUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, created_at')
    .eq('role', 'management')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
  }));
}

export async function toggleManagementUserStatus(
  userId: string,
  isActive: boolean,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/admin/deactivate-supervisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isActive }),
    });
    let json: Record<string, unknown>;
    try { json = await res.json(); }
    catch { json = {}; }
    if (!res.ok) {
      const msg = typeof json.error === 'string' ? json.error : 'Failed to update status';
      logAppError('toggle-management-status', JSON.stringify(json), msg);
      return { error: msg };
    }
    return { error: null };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = 'Network error updating user status. Check your connection.';
    logAppError('toggle-management-status', raw, msg);
    return { error: msg };
  }
}
