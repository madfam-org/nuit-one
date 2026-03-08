import { Hono } from 'hono';
import { createDb } from '@nuit-one/db';
import { schema } from '@nuit-one/db';
import { eq, and, desc } from 'drizzle-orm';
import type { SavePerformanceRequest } from '@nuit-one/shared';

let _db: ReturnType<typeof createDb>;
function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is required');
    _db = createDb(url);
  }
  return _db;
}

export const performanceRoutes = new Hono();

// POST /api/performances — Save a performance result
performanceRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<SavePerformanceRequest>();

  if (!body.trackId) return c.json({ error: 'Missing trackId' }, 400);
  if (typeof body.totalScore !== 'number') return c.json({ error: 'Missing totalScore' }, 400);
  if (typeof body.accuracy !== 'number') return c.json({ error: 'Missing accuracy' }, 400);

  const db = getDb();

  const totalNotes = (body.perfectCount ?? 0) + (body.greatCount ?? 0) + (body.goodCount ?? 0) + (body.missCount ?? 0);
  const scoreOverall = totalNotes > 0 ? (body.totalScore / (totalNotes * 400)) * 100 : 0;
  const timingRatio = totalNotes > 0
    ? ((body.perfectCount ?? 0) + (body.greatCount ?? 0) * 0.75 + (body.goodCount ?? 0) * 0.5) / totalNotes * 100
    : 0;

  const [row] = await db
    .insert(schema.performances)
    .values({
      trackId: body.trackId,
      userId: auth.userId,
      stemId: body.stemId ?? null,
      scorePitch: body.accuracy,
      scoreOverall: Math.min(scoreOverall, 100),
      scoreTiming: Math.min(timingRatio, 100),
      scoreDynamics: null,
      midiData: {
        totalScore: body.totalScore,
        maxCombo: body.maxCombo,
        perfectCount: body.perfectCount,
        greatCount: body.greatCount,
        goodCount: body.goodCount,
        missCount: body.missCount,
        accuracy: body.accuracy,
      },
    })
    .returning({ id: schema.performances.id });

  return c.json({ id: row!.id }, 201);
});

// GET /api/performances/:trackId — Get all performances for a track
performanceRoutes.get('/:trackId', async (c) => {
  const auth = c.get('auth');
  const trackId = c.req.param('trackId');

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.performances)
    .where(and(eq(schema.performances.trackId, trackId), eq(schema.performances.userId, auth.userId)))
    .orderBy(desc(schema.performances.createdAt));

  return c.json(rows);
});
