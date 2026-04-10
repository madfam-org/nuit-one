import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const userId = locals.userId;
  const workspaceId = locals.workspaceId ?? '';

  // Workspace-scoped track lookup: allow viewing stats for any track in the workspace
  const trackRow = await db
    .select({
      id: schema.tracks.id,
      title: schema.tracks.title,
    })
    .from(schema.tracks)
    .innerJoin(schema.projects, eq(schema.tracks.projectId, schema.projects.id))
    .where(
      and(
        eq(schema.tracks.id, params.id),
        eq(schema.projects.workspaceId, workspaceId)
      )
    )
    .limit(1);

  const track = trackRow[0];
  if (!track) throw error(404, 'Track not found');

  // Personal performances
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

  // Leaderboard: best score per user for this track
  const leaderboardRows = await db
    .select({
      userId: schema.performances.userId,
      bestScore: sql<number>`MAX(COALESCE((${schema.performances.midiData}->>'totalScore')::int, 0))`.as('best_score'),
      bestAccuracy: sql<number>`MAX(COALESCE((${schema.performances.midiData}->>'accuracy')::float, 0))`.as('best_accuracy'),
      bestCombo: sql<number>`MAX(COALESCE((${schema.performances.midiData}->>'maxCombo')::int, 0))`.as('best_combo'),
      playCount: sql<number>`COUNT(*)::int`.as('play_count'),
      lastPlayed: sql<string>`MAX(${schema.performances.createdAt})`.as('last_played'),
    })
    .from(schema.performances)
    .where(eq(schema.performances.trackId, params.id))
    .groupBy(schema.performances.userId)
    .orderBy(sql`MAX(COALESCE((${schema.performances.midiData}->>'totalScore')::int, 0)) DESC`);

  const leaderboard = leaderboardRows.map((row, i) => ({
    rank: i + 1,
    userId: row.userId,
    displayName: row.userId === userId ? 'You' : `Player ${i + 1}`,
    bestScore: row.bestScore ?? 0,
    bestAccuracy: Math.round((row.bestAccuracy ?? 0) * 10) / 10,
    bestCombo: row.bestCombo ?? 0,
    playCount: row.playCount ?? 0,
    lastPlayed: row.lastPlayed ?? '',
    isCurrentUser: row.userId === userId,
  }));

  return {
    track: { id: track.id, title: track.title },
    performances: mapped,
    stats: {
      totalPlays,
      bestScore,
      avgAccuracy: Math.round(avgAccuracy * 10) / 10,
      bestCombo,
    },
    leaderboard,
  };
};
