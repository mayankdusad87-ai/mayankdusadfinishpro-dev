import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * Daily backup cron: exports all Supabase tables as a JSON file
 * and uploads it to a Google Drive folder.
 *
 * Protected by CRON_SECRET.
 * Vercel Cron calls this daily at 2:30 AM IST (see vercel.json).
 */

const TABLES = [
  'profiles',
  'projects',
  'activities',
  'activity_photos',
  'supervisor_assignments',
  'project_milestones',
  'audit_log',
  'app_settings',
  'notifications',
  'reasons',
  'uploads',
];

const PAGE_SIZE = 1000;

// ---- Google Auth: JWT → Access Token ----

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = base64url(sign.sign(key.private_key));

  const jwt = `${signInput}.${signature}`;

  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

// ---- Google Drive: upload file ----

async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
): Promise<{ id: string; name: string }> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const boundary = '----BackupBoundary' + Date.now();
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    content +
    `\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ---- Paginated table fetch (handles >1000 rows) ----

async function fetchAllRows(table: string): Promise<unknown[]> {
  const allRows: unknown[] = [];
  let from = 0;

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[backup] Error fetching ${table}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);

    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  return allRows;
}

// ---- Main handler ----

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const serviceKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!folderId || !serviceKeyRaw) {
    console.error('[backup] Missing GOOGLE_DRIVE_FOLDER_ID or GOOGLE_SERVICE_ACCOUNT_KEY');
    return NextResponse.json({ error: 'Backup not configured' }, { status: 500 });
  }

  let serviceKey: ServiceAccountKey;
  try {
    serviceKey = JSON.parse(serviceKeyRaw);
  } catch {
    // Vercel may convert literal \n to real newlines inside strings, breaking JSON.
    // Try replacing real newlines (except those inside the PEM block) back to \n.
    try {
      const fixed = serviceKeyRaw.replace(/\n/g, '\\n').replace(/\\\\n/g, '\\n');
      serviceKey = JSON.parse(fixed);
    } catch (e2) {
      const snippet = serviceKeyRaw.slice(0, 40);
      const len = serviceKeyRaw.length;
      console.error('[backup] Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON. Length:', len, 'Start:', snippet);
      console.error('[backup] Parse error:', e2 instanceof Error ? e2.message : e2);
      return NextResponse.json({
        error: 'Invalid service account key',
        debug: { length: len, startsWith: snippet, parseError: e2 instanceof Error ? e2.message : String(e2) },
      }, { status: 500 });
    }
  }

  try {
    // 1. Export all tables in parallel
    console.log('[backup] Starting daily backup...');
    const results = await Promise.all(
      TABLES.map(async (table) => {
        const rows = await fetchAllRows(table);
        return { table, rowCount: rows.length, rows };
      }),
    );

    const backup: Record<string, { rowCount: number; rows: unknown[] }> = {};
    let totalRows = 0;
    for (const r of results) {
      backup[r.table] = { rowCount: r.rowCount, rows: r.rows };
      totalRows += r.rowCount;
    }

    // 2. Create the backup JSON
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // 2026-08-18
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, ''); // 073000
    const fileName = `finishpro_backup_${dateStr}_${timeStr}.json`;

    const backupPayload = {
      exportedAt: now.toISOString(),
      tables: Object.keys(backup).length,
      totalRows,
      data: backup,
    };

    const content = JSON.stringify(backupPayload, null, 2);
    const sizeMB = (Buffer.byteLength(content) / (1024 * 1024)).toFixed(2);

    console.log(`[backup] Exported ${totalRows} rows across ${TABLES.length} tables (${sizeMB} MB)`);

    // 3. Get Google access token
    const accessToken = await getAccessToken(serviceKey);

    // 4. Upload to Google Drive
    const uploaded = await uploadToDrive(accessToken, folderId, fileName, content);

    console.log(`[backup] Uploaded to Drive: ${uploaded.name} (id: ${uploaded.id})`);

    return NextResponse.json({
      message: 'Backup completed',
      fileName: uploaded.name,
      driveFileId: uploaded.id,
      tables: TABLES.length,
      totalRows,
      sizeMB,
    });
  } catch (err) {
    console.error('[backup] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backup failed' },
      { status: 500 },
    );
  }
}
