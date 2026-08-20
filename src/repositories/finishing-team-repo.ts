import { supabase } from '@/lib/supabase';
import { logAppError } from './errors';

export interface FinishingTeamUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
}

export async function createFinishingTeamUser(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
): Promise<{ error: string | null; userId?: string }> {
  try {
    const res = await fetch('/api/admin/create-finishing-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phone }),
    });
    let json: Record<string, unknown>;
    try { json = await res.json(); }
    catch { json = {}; }
    if (!res.ok) {
      const msg = typeof json.error === 'string' ? json.error : 'Failed to create finishing team user';
      const debug = typeof json.debug === 'string' ? json.debug : '';
      logAppError('create-finishing-team', debug || JSON.stringify(json), msg);
      return { error: msg };
    }
    return { error: null, userId: json.userId as string };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = 'Network error creating finishing team user. Check your connection.';
    logAppError('create-finishing-team', raw, msg);
    return { error: msg };
  }
}

export async function getFinishingTeamUsers(): Promise<FinishingTeamUser[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, created_at')
    .eq('role', 'finishing_team')
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

export async function toggleFinishingTeamUserStatus(
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
      logAppError('toggle-finishing-team-status', JSON.stringify(json), msg);
      return { error: msg };
    }
    return { error: null };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = 'Network error updating user status. Check your connection.';
    logAppError('toggle-finishing-team-status', raw, msg);
    return { error: msg };
  }
}
