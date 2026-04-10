import { schema } from '@nuit-one/db';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { refreshAllCharts } from '../lib/chart-scrapers/index.js';
import { expireStaleContent, getStorageStats } from '../lib/content-lifecycle.js';

export const adminRoutes = new Hono();

// POST /api/admin/expire-content -- Trigger lifecycle cleanup
adminRoutes.post('/expire-content', async (c) => {
  // Auth is already enforced by the /api/* middleware
  const db = c.get('db');
  const daysThreshold = parseInt(c.req.query('days') ?? '90', 10);
  const result = await expireStaleContent(db, daysThreshold);

  return c.json({
    expired: result.expiredCount,
    freedBytes: result.freedBytes,
    freedMB: Math.round((result.freedBytes / 1024 / 1024) * 10) / 10,
  });
});

// GET /api/admin/storage-stats -- Get storage usage metrics
adminRoutes.get('/storage-stats', async (c) => {
  const db = c.get('db');
  const stats = await getStorageStats(db);

  return c.json({
    ...stats,
    totalStemMB: Math.round((stats.totalStemBytes / 1024 / 1024) * 10) / 10,
  });
});

// POST /api/admin/refresh-charts -- Trigger chart scraping
adminRoutes.post('/refresh-charts', async (c) => {
  const db = c.get('db');
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
  const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  const result = await refreshAllCharts(db, spotifyClientId, spotifyClientSecret);

  return c.json({
    spotify: result.spotify,
    youtube: result.youtube,
    total: result.spotify + result.youtube,
    errors: result.errors,
  });
});

// GET /api/admin/catalog-stats -- Catalog metrics
adminRoutes.get('/catalog-stats', async (c) => {
  const db = c.get('db');

  const [stats] = await db
    .select({
      totalTracks: sql<number>`COUNT(*)::int`,
      uniqueCharts: sql<number>`COUNT(DISTINCT ${schema.catalogTracks.chartName})::int`,
      latestDate: sql<string>`MAX(${schema.catalogTracks.chartDate})`,
      genreCount: sql<number>`COUNT(DISTINCT ${schema.catalogTracks.genre})::int`,
    })
    .from(schema.catalogTracks);

  return c.json(stats);
});
