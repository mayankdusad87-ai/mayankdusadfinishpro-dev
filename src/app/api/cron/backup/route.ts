import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Database } from '@/types/database.types';
import { uploadBackup, uploadFile, cleanupOldBackups } from '@/lib/r2-backup';

type TableName = keyof Database['public']['Tables'];

export const maxDuration = 300; // 5 minutes (Vercel Pro)

/**
 * Daily backup cron — exports all database tables + photos to Cloudflare R2.
 *
 * Runs daily at 2:30 AM IST (21:00 UTC previous day).
 * Protected by CRON_SECRET.
 *
 * Structure in R2:
 *   db/2026-08-22/activities.json
 *   db/2026-08-22/projects.json
 *   ...
 *   photos/2026-08-22/<storage_path>
 */

const TABLES: TableName[] = [
  'projects',
  'activities',
  'profiles',
  'supervisor_assignments',
  'floor_handovers',
  'app_settings',
  'unit_stores',
  'activity_photos',
  'audit_log',
  'notifications',
  'uploads',
  'project_milestones',
  'reasons',
  'app_errors',
];

const RETENTION_DAYS = 30;
const PHOTO_BUCKET = 'activity-photos';

async function backupTable(table: TableName, dateStr: string): Promise<{ rows: number; error?: string }> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1);

    if (error) return { rows: 0, error: error.message };
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (all.length > 0) {
    const key = `db/${dateStr}/${table}.json`;
    await uploadBackup(key, JSON.stringify(all));
  }

  return { rows: all.length };
}

async function backupPhotos(dateStr: string): Promise<{ copied: number; errors: number }> {
  let copied = 0;
  let errors = 0;

  // Get all photo records from the database
  const { data: photos, error } = await supabaseAdmin
    .from('activity_photos')
    .select('id, storage_path');

  if (error || !photos || photos.length === 0) {
    return { copied: 0, errors: error ? 1 : 0 };
  }

  // Download each photo from Supabase Storage and upload to R2
  // Process in batches to avoid overwhelming either service
  const BATCH = 10;
  for (let i = 0; i < photos.length; i += BATCH) {
    const batch = photos.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (photo) => {
        try {
          const { data, error: dlError } = await supabaseAdmin.storage
            .from(PHOTO_BUCKET)
            .download(photo.storage_path);

          if (dlError || !data) {
            errors++;
            return;
          }

          const arrayBuffer = await data.arrayBuffer();
          const key = `photos/${dateStr}/${photo.storage_path}`;
          await uploadFile(key, new Uint8Array(arrayBuffer), data.type || 'image/jpeg');
          copied++;
        } catch {
          errors++;
        }
      }),
    );
  }

  return { copied, errors };
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dateStr = new Date().toISOString().slice(0, 10); // e.g. "2026-08-22"
  const results: Record<string, { rows?: number; error?: string }> = {};

  console.log(`[Backup] Starting daily backup for ${dateStr}`, {
    r2Endpoint: process.env.R2_ENDPOINT ? '✓ set' : '✗ missing',
    r2Key: process.env.R2_ACCESS_KEY_ID ? '✓ set' : '✗ missing',
  });

  // 1. Back up all database tables
  for (const table of TABLES) {
    try {
      results[table] = await backupTable(table, dateStr);
    } catch (err) {
      results[table] = { rows: 0, error: String(err) };
    }
  }

  // 2. Back up photos
  let photoResult = { copied: 0, errors: 0 };
  try {
    photoResult = await backupPhotos(dateStr);
  } catch (err) {
    console.error('[Backup] Photo backup failed:', err);
  }

  // 3. Clean up old backups
  let cleaned = 0;
  try {
    const dbCleaned = await cleanupOldBackups('db/', RETENTION_DAYS);
    const photoCleaned = await cleanupOldBackups('photos/', RETENTION_DAYS);
    cleaned = dbCleaned + photoCleaned;
  } catch (err) {
    console.error('[Backup] Cleanup failed:', err);
  }

  const summary = {
    date: dateStr,
    tables: results,
    photos: photoResult,
    cleaned,
  };

  console.log('[Backup] Complete:', JSON.stringify(summary));

  return NextResponse.json({ ok: true, ...summary });
}
