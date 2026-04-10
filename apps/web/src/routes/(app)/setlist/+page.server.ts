import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const tracks = await db
    .select({
      id: schema.tracks.id,
      title: schema.tracks.title,
      status: schema.tracks.status,
      createdAt: schema.tracks.createdAt,
      hasNotes: sql<boolean>`EXISTS (
        SELECT 1 FROM stems
        WHERE stems.track_id = ${schema.tracks.id}
        AND stems.midi_data IS NOT NULL
      )`.as('has_notes'),
    })
    .from(schema.tracks)
    .where(eq(schema.tracks.userId, locals.userId))
    .orderBy(desc(schema.tracks.createdAt));

  return {
    availableTracks: tracks
      .filter((t) => t.status === 'ready' && t.hasNotes)
      .map((t) => ({
        id: t.id,
        title: t.title,
      })),
  };
};
