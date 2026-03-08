import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, and } from 'drizzle-orm';
import type { NoteEvent } from '@nuit-one/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const track = await db.query.tracks.findFirst({
    where: eq(schema.tracks.id, params.id),
  });

  if (!track) throw error(404, 'Track not found');
  if (track.status !== 'ready') throw error(400, 'Track is not ready');

  // Get stems
  const trackStems = await db
    .select()
    .from(schema.stems)
    .where(eq(schema.stems.trackId, track.id));

  const bassStem = trackStems.find((s) => s.stemType === 'bass');
  const backingStem = trackStems.find((s) => s.stemType === 'no_bass');

  if (!backingStem) throw error(400, 'No backing track stem found');

  // Get note data from bass stem
  const notes: NoteEvent[] = (bassStem?.midiData as NoteEvent[] | null) ?? [];

  // Build stem URLs
  const stemUrls: Record<string, string> = {};
  for (const stem of trackStems) {
    const name = stem.stemType ?? 'unknown';
    stemUrls[name] = `/api/audio/${stem.r2Key}`;
  }

  return {
    track: {
      id: track.id,
      title: track.title,
    },
    stemUrls,
    notes,
    hasNotes: notes.length > 0,
  };
};
