import { supabase } from '@/lib/supabase';

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
  const res = await fetch('/api/admin/create-management', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, phone }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to create management user' };
  return { error: null, userId: json.userId };
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
  const res = await fetch('/api/admin/deactivate-supervisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, isActive }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to update status' };
  return { error: null };
}
