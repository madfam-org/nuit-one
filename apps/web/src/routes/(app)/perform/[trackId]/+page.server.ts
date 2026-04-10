import { schema } from '@nuit-one/db';
import type { NoteEvent } from '@nuit-one/shared';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
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

  // If track has contentSourceId, check content source status
  if (track.contentSourceId) {
    const contentSource = await db.query.contentSources.findFirst({
      where: eq(schema.contentSources.id, track.contentSourceId),
    });

    if (contentSource?.status === 'expired') {
      return {
        track: { id: track.id, title: track.title },
        expired: true,
        reimportUrl: contentSource.originalUrl,
        stemUrls: {} as Record<string, string>,
        stemsWithNotes: {} as Record<string, { stemId: string; notes: NoteEvent[] }>,
        availableInstruments: [] as string[],
        hasNotes: false,
        userId: locals.userId,
        workspaceId: locals.workspaceId ?? null,
        soketiAppKey: env.SOKETI_APP_KEY ?? 'nuit-one-key',
        soketiHost: env.SOKETI_HOST ?? 'localhost',
        soketiPort: Number(env.SOKETI_PORT ?? '6001'),
      };
    }
  }

  if (track.status !== 'ready') throw error(400, 'Track is not ready');

  // If track has contentSourceId, load stems from content source (shared library)
  const stemFilter = track.contentSourceId
    ? eq(schema.stems.contentSourceId, track.contentSourceId)
    : eq(schema.stems.trackId, track.id);

  const trackStems = await db.select().from(schema.stems).where(stemFilter);

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
    expired: false,
    reimportUrl: null as string | null,
    stemUrls,
    stemsWithNotes,
    availableInstruments: Object.keys(stemsWithNotes),
    hasNotes: Object.keys(stemsWithNotes).length > 0,
    userId: locals.userId,
    workspaceId: locals.workspaceId ?? null,
    soketiAppKey: env.SOKETI_APP_KEY ?? 'nuit-one-key',
    soketiHost: env.SOKETI_HOST ?? 'localhost',
    soketiPort: Number(env.SOKETI_PORT ?? '6001'),
  };
};
