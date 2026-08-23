import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const R2_ENDPOINT = process.env.R2_ENDPOINT!;     // full URL: https://<account>.r2.cloudflarestorage.com
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = 'finishpro-backups';

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

/** Upload a JSON string (gzipped) to R2 */
export async function uploadBackup(key: string, data: string): Promise<void> {
  const client = getClient();
  const encoder = new TextEncoder();
  const body = encoder.encode(data);

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  );
}

/** Upload raw bytes (for photos) */
export async function uploadFile(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Delete backups older than `days` */
export async function cleanupOldBackups(prefix: string, days: number): Promise<number> {
  const client = getClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix }),
  );

  if (!listed.Contents || listed.Contents.length === 0) return 0;

  const toDelete = listed.Contents.filter(
    obj => obj.LastModified && obj.LastModified < cutoff,
  );

  if (toDelete.length === 0) return 0;

  // R2 supports batch delete up to 1000 at a time
  const batches = [];
  for (let i = 0; i < toDelete.length; i += 1000) {
    batches.push(toDelete.slice(i, i + 1000));
  }

  let deleted = 0;
  for (const batch of batches) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: {
          Objects: batch.map(obj => ({ Key: obj.Key! })),
          Quiet: true,
        },
      }),
    );
    deleted += batch.length;
  }

  return deleted;
}
