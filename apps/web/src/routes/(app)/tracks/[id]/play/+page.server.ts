import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, and } from 'drizzle-orm';
import type { NoteEvent } from '@nuit-one/shared';
import type { PageServerLoad } from './$types';

function validateNotes(data: unknown): NoteEvent[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (n): n is NoteEvent =>
      typeof n === 'object' && n !== null &&
      typeof n.startTime === 'number' &&
      typeof n.duration === 'number' &&
      typeof n.pitch === 'number' &&
      typeof n.velocity === 'number'
  );
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const track = await db.query.tracks.findFirst({
    where: and(eq(schema.tracks.id, params.id), eq(schema.tracks.userId, locals.userId)),
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

  // Get note data from bass stem (validated)
  const notes = validateNotes(bassStem?.midiData);

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
