import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, and, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';

  const track = await db.query.tracks.findFirst({
    where: and(eq(schema.tracks.id, params.id), eq(schema.tracks.userId, userId)),
  });

  if (!track) throw error(404, 'Track not found');

  const performances = await db
    .select()
    .from(schema.performances)
    .where(and(eq(schema.performances.trackId, params.id), eq(schema.performances.userId, userId)))
    .orderBy(desc(schema.performances.createdAt));

  const mapped = performances.map((p) => {
    const midi = p.midiData as Record<string, number> | null;
    return {
      id: p.id,
      scoreOverall: p.scoreOverall ?? 0,
      scorePitch: p.scorePitch ?? 0,
      scoreTiming: p.scoreTiming ?? 0,
      totalScore: midi?.totalScore ?? 0,
      maxCombo: midi?.maxCombo ?? 0,
      accuracy: midi?.accuracy ?? p.scorePitch ?? 0,
      perfectCount: midi?.perfectCount ?? 0,
      greatCount: midi?.greatCount ?? 0,
      goodCount: midi?.goodCount ?? 0,
      missCount: midi?.missCount ?? 0,
      createdAt: p.createdAt?.toISOString() ?? '',
    };
  });

  const totalPlays = mapped.length;
  const bestScore = totalPlays > 0 ? Math.max(...mapped.map((p) => p.totalScore)) : 0;
  const avgAccuracy = totalPlays > 0 ? mapped.reduce((sum, p) => sum + p.accuracy, 0) / totalPlays : 0;
  const bestCombo = totalPlays > 0 ? Math.max(...mapped.map((p) => p.maxCombo)) : 0;

  return {
    track: { id: track.id, title: track.title },
    performances: mapped,
    stats: {
      totalPlays,
      bestScore,
      avgAccuracy: Math.round(avgAccuracy * 10) / 10,
      bestCombo,
    },
  };
};
