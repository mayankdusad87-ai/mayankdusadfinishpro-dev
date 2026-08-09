import { supabase } from '@/lib/supabase';
import type { NotificationRow } from '@/types/database.types';

export type { NotificationRow };

export interface NotificationsResult {
  notifications: NotificationRow[];
  unreadCount: number;
}

/**
 * Fetch notifications for the current user (client-side, uses RLS).
 * Returns up to `limit` most recent notifications + total unread count.
 */
export async function getNotifications(limit = 20): Promise<NotificationsResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const [{ data: notifications }, { count }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ]);

  return {
    notifications: notifications || [],
    unreadCount: count || 0,
  };
}

/**
 * Mark a single notification as read (client-side, uses RLS).
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

/**
 * Mark all notifications as read for the current user (client-side, uses RLS).
 */
export async function markAllNotificationsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
}
