import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Json, NotificationInsert } from '@/types/database.types';

export type NotificationType =
  | 'reversal'
  | 'overdue_digest'
  | 'supervisor_inactivity'
  | 'completion_milestone'
  | 'overdue_reminder';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a single in-app notification (server-side, uses service role).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const row: NotificationInsert = {
    user_id: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: (input.metadata ?? {}) as Json,
  };

  await supabaseAdmin.from('notifications').insert(row);
}

/**
 * Create the same notification for multiple users.
 */
export async function createNotificationForUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (userIds.length === 0) return;

  const rows: NotificationInsert[] = userIds.map(userId => ({
    user_id: userId,
    type,
    title,
    message,
    metadata: (metadata ?? {}) as Json,
  }));

  await supabaseAdmin.from('notifications').insert(rows);
}

/**
 * Fetch all admin user IDs (for sending admin notifications).
 */
export async function getAdminUserIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true);

  return (data || []).map(p => p.id);
}

/**
 * Fetch supervisor IDs for a given project.
 */
export async function getSupervisorIdsForProject(projectId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('supervisor_assignments')
    .select('supervisor_id')
    .eq('project_id', projectId);

  return (data || []).map(a => a.supervisor_id).filter(Boolean) as string[];
}
