import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const track = await db.query.tracks.findFirst({
    where: and(eq(schema.tracks.id, params.id), eq(schema.tracks.userId, locals.userId)),
  });

  if (!track) throw error(404, 'Track not found');
  if (track.status !== 'ready') throw error(400, 'Track is not ready for playback');

  // Get stems for this track
  const trackStems = await db
    .select()
    .from(schema.stems)
    .where(eq(schema.stems.trackId, track.id));

  // Build proxy URLs for each stem
  const stemUrls: Record<string, string> = {};
  const stemsData: Array<{
    id: string;
    stemType: string;
    r2Key: string;
    hasMidiData: boolean;
  }> = [];

  for (const stem of trackStems) {
    const name = stem.stemType ?? 'unknown';
    stemUrls[name] = `/api/audio/${stem.r2Key}`;
    stemsData.push({
      id: stem.id,
      stemType: stem.stemType,
      r2Key: stem.r2Key,
      hasMidiData: stem.midiData != null,
    });
  }

  return {
    track: {
      id: track.id,
      title: track.title,
      status: track.status,
    },
    stemUrls,
    stems: stemsData,
  };
};
