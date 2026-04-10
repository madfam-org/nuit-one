import type { Database } from '@nuit-one/db';
import { schema } from '@nuit-one/db';
import { and, eq, lt, sql } from 'drizzle-orm';
import { deleteObjects } from './storage.js';

export interface ExpireResult {
  expiredCount: number;
  freedBytes: number;
}

export async function expireStaleContent(
  db: Database,
  daysThreshold = 90,
): Promise<ExpireResult> {
  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  // Find content sources not accessed since cutoff
  const stale = await db
    .select({
      id: schema.contentSources.id,
      r2KeyPrefix: schema.contentSources.r2KeyPrefix,
    })
    .from(schema.contentSources)
    .where(
      and(
        eq(schema.contentSources.status, 'ready'),
        lt(schema.contentSources.lastAccessedAt, cutoff),
      ),
    );

  let freedBytes = 0;

  for (const source of stale) {
    // Get total stem size before deleting
    const stemSizes = await db
      .select({ total: sql<number>`COALESCE(SUM(${schema.stems.fileSizeBytes}), 0)` })
      .from(schema.stems)
      .where(eq(schema.stems.contentSourceId, source.id));
    freedBytes += Number(stemSizes[0]?.total ?? 0);

    // Delete storage objects under this prefix
    try {
      await deleteObjects(source.r2KeyPrefix);
    } catch (err) {
      console.warn(`Failed to delete objects for ${source.r2KeyPrefix}:`, err);
    }

    // Delete stem records
    await db
      .delete(schema.stems)
      .where(eq(schema.stems.contentSourceId, source.id));

    // Mark content source as expired (keep metadata for re-import)
    await db
      .update(schema.contentSources)
      .set({ status: 'expired' })
      .where(eq(schema.contentSources.id, source.id));

    // Mark associated tracks as needing re-processing
    await db
      .update(schema.tracks)
      .set({ status: 'needs_parts' })
      .where(eq(schema.tracks.contentSourceId, source.id));
  }

  return { expiredCount: stale.length, freedBytes };
}

export interface StorageStats {
  totalContentSources: number;
  readyCount: number;
  processingCount: number;
  expiredCount: number;
  errorCount: number;
  totalStemBytes: number;
  oldestAccessDays: number | null;
}

export async function getStorageStats(db: Database): Promise<StorageStats> {
  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      ready: sql<number>`COUNT(*) FILTER (WHERE ${schema.contentSources.status} = 'ready')::int`,
      processing: sql<number>`COUNT(*) FILTER (WHERE ${schema.contentSources.status} = 'processing')::int`,
      expired: sql<number>`COUNT(*) FILTER (WHERE ${schema.contentSources.status} = 'expired')::int`,
      error: sql<number>`COUNT(*) FILTER (WHERE ${schema.contentSources.status} = 'error')::int`,
      oldestAccess: sql<number>`EXTRACT(DAY FROM NOW() - MIN(${schema.contentSources.lastAccessedAt}))`,
    })
    .from(schema.contentSources);

  const [stemBytes] = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.stems.fileSizeBytes}), 0)` })
    .from(schema.stems);

  return {
    totalContentSources: counts?.total ?? 0,
    readyCount: counts?.ready ?? 0,
    processingCount: counts?.processing ?? 0,
    expiredCount: counts?.expired ?? 0,
    errorCount: counts?.error ?? 0,
    totalStemBytes: Number(stemBytes?.total ?? 0),
    oldestAccessDays: counts?.oldestAccess != null ? Math.floor(counts.oldestAccess) : null,
  };
}
