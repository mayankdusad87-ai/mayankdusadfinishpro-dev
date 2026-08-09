import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-guard';
import { createNotification, createNotificationForUsers, getAdminUserIds } from '@/lib/notify';
import type { NotificationType } from '@/lib/notify';
import { z } from 'zod';

const createSchema = z.object({
  /** Send to specific user IDs */
  userIds: z.array(z.string().uuid()).optional(),
  /** Or send to all admins */
  toAdmins: z.boolean().optional(),
  type: z.enum(['reversal', 'overdue_digest', 'supervisor_inactivity', 'completion_milestone', 'overdue_reminder']),
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/notifications/create — create notifications (admin-only or internal)
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdmin(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userIds, toAdmins, type, title, message, metadata } = parsed.data;
  const notifType = type as NotificationType;

  if (toAdmins) {
    const adminIds = await getAdminUserIds();
    await createNotificationForUsers(adminIds, notifType, title, message, metadata);
  } else if (userIds && userIds.length > 0) {
    await createNotificationForUsers(userIds, notifType, title, message, metadata);
  } else {
    return NextResponse.json({ error: 'userIds or toAdmins required' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
