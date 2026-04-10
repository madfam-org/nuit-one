import { Hono } from 'hono';
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
