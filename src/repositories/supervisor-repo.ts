import { supabase } from '@/lib/supabase';

export async function createSupervisor(
  email: string,
  password: string,
  fullName: string,
  phone?: string
): Promise<{ error: string | null; userId?: string }> {
  const res = await fetch('/api/admin/create-supervisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, phone }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to create supervisor' };
  return { error: null, userId: json.userId };
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ error: string | null }> {
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, newPassword }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to reset password' };
  return { error: null };
}

export async function deactivateSupervisor(userId: string, isActive: boolean): Promise<{ error: string | null }> {
  const res = await fetch('/api/admin/deactivate-supervisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, isActive }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error || 'Failed to update supervisor status' };
  return { error: null };
}

export async function getSupervisors(): Promise<Array<{
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  project_name: string | null;
  assigned_floors: number[];
}>> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      supervisor_assignments(
        project_id,
        assigned_floors,
        projects(name, location)
      )
    `)
    .eq('role', 'supervisor')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => {
    const assignments = (row.supervisor_assignments as Array<{
      project_id: string;
      assigned_floors: number[];
      projects: { name: string; location: string } | null;
    }>) || [];
    const first = assignments[0];
    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      is_active: row.is_active ?? true,
      project_name: first?.projects ? `${first.projects.name} — ${first.projects.location}` : null,
      assigned_floors: first?.assigned_floors || [],
    };
  });
}

export async function getSupervisorAssignments(supervisorId: string): Promise<Array<{ project_id: string; assigned_floors: number[] }>> {
  const { data, error } = await supabase
    .from('supervisor_assignments')
    .select('project_id, assigned_floors')
    .eq('supervisor_id', supervisorId);
  if (error || !data) return [];
  return data.map(d => ({
    project_id: d.project_id || '',
    assigned_floors: d.assigned_floors || [],
  }));
}

export async function assignSupervisorToProject(
  supervisorId: string,
  projectId: string,
  floors: number[]
): Promise<void> {
  const { error } = await supabase.from('supervisor_assignments').upsert({
    supervisor_id: supervisorId,
    project_id: projectId,
    assigned_floors: floors,
  }, { onConflict: 'supervisor_id,project_id' });
  if (error) throw error;
}
