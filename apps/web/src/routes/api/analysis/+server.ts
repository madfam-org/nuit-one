import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const trackId = url.searchParams.get('trackId');
  if (!trackId) throw error(400, 'Missing trackId');

  const analysis = await db.query.trackAnalysis.findFirst({
    where: eq(schema.trackAnalysis.trackId, trackId),
  });

  if (!analysis) {
    return json({ analysis: null });
  }

  return json({
    analysis: {
      id: analysis.id,
      trackId: analysis.trackId,
      key: analysis.key,
      bpmDetected: analysis.bpmDetected,
      chords: analysis.chords,
      difficultyTier: analysis.difficultyTier,
      analysisVersion: analysis.analysisVersion,
      createdAt: analysis.createdAt?.toISOString() ?? '',
    },
  });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const body = await request.json();
  if (!body.trackId) throw error(400, 'Missing trackId');

  // Verify track ownership
  const track = await db.query.tracks.findFirst({
    where: eq(schema.tracks.id, body.trackId),
  });
  if (!track) throw error(404, 'Track not found');

  // Upsert analysis
  const existing = await db.query.trackAnalysis.findFirst({
    where: eq(schema.trackAnalysis.trackId, body.trackId),
  });

  if (existing) {
    await db
      .update(schema.trackAnalysis)
      .set({
        key: body.key ?? null,
        bpmDetected: body.bpmDetected ?? null,
        chords: body.chords ?? null,
        difficultyTier: body.difficultyTier ?? null,
        analysisVersion: body.analysisVersion ?? 'client-v1',
      })
      .where(eq(schema.trackAnalysis.id, existing.id));

    return json({ id: existing.id });
  } else {
    const [inserted] = await db
      .insert(schema.trackAnalysis)
      .values({
        trackId: body.trackId,
        key: body.key ?? null,
        bpmDetected: body.bpmDetected ?? null,
        chords: body.chords ?? null,
        difficultyTier: body.difficultyTier ?? null,
        analysisVersion: body.analysisVersion ?? 'client-v1',
      })
      .returning();

    return json({ id: inserted!.id }, { status: 201 });
  }
};
