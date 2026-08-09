-- Notifications table for in-app notifications
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL,           -- reversal, overdue_digest, supervisor_inactivity, completion_milestone, overdue_reminder
  title       text NOT NULL,
  message     text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,  -- extra context (project_id, floor, flat, etc.)
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Index for fast lookups per user (unread first, newest first)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert notifications (from API routes)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Service role can delete old notifications
CREATE POLICY "Service role can delete notifications"
  ON public.notifications FOR DELETE
  USING (true);
