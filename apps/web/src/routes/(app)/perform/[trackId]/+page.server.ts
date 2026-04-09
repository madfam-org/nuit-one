import { schema } from '@nuit-one/db';
import type { NoteEvent } from '@nuit-one/shared';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

function validateNotes(data: unknown): NoteEvent[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (n): n is NoteEvent =>
      typeof n === 'object' &&
      n !== null &&
      typeof n.startTime === 'number' &&
      typeof n.duration === 'number' &&
      typeof n.pitch === 'number' &&
      typeof n.velocity === 'number',
  );
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const track = await db.query.tracks.findFirst({
    where: and(eq(schema.tracks.id, params.trackId), eq(schema.tracks.userId, locals.userId)),
  });

  if (!track) throw error(404, 'Track not found');
  if (track.status !== 'ready') throw error(400, 'Track is not ready');

  const trackStems = await db.select().from(schema.stems).where(eq(schema.stems.trackId, track.id));

  const stemUrls: Record<string, string> = {};
  const stemsWithNotes: Record<string, { stemId: string; notes: NoteEvent[] }> = {};

  for (const stem of trackStems) {
    const name = stem.stemType ?? 'unknown';
    stemUrls[name] = `/api/audio/${stem.r2Key}`;
    const notes = validateNotes(stem.midiData);
    if (notes.length > 0) {
      stemsWithNotes[name] = { stemId: stem.id, notes };
    }
  }

  return {
    track: { id: track.id, title: track.title },
    stemUrls,
    stemsWithNotes,
    availableInstruments: Object.keys(stemsWithNotes),
    hasNotes: Object.keys(stemsWithNotes).length > 0,
  };
};
