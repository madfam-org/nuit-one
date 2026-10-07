import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

/** `/api/audio/<r2Key>`, with each path segment encoded (imported titles can contain `#`, `?`, `%`). */
function audioUrlFor(r2Key: string): string {
  return `/api/audio/${r2Key.split('/').map(encodeURIComponent).join('/')}`;
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const track = await db.query.tracks.findFirst({
    where: and(eq(schema.tracks.id, params.trackId), eq(schema.tracks.userId, locals.userId)),
  });

  if (!track) throw error(404, 'Track not found');

  const summary = { id: track.id, title: track.title };

  // A shared-library track whose audio was archived cannot be played (same rule as the perform page).
  if (track.contentSourceId) {
    const contentSource = await db.query.contentSources.findFirst({
      where: eq(schema.contentSources.id, track.contentSourceId),
    });
    if (contentSource?.status === 'expired') {
      return { track: summary, audioUrl: null as string | null, expired: true };
    }
  }

  if (track.status !== 'ready') throw error(400, 'Track is not ready');
  if (!track.r2Key) throw error(400, 'Track has no audio file');

  return { track: summary, audioUrl: audioUrlFor(track.r2Key) as string | null, expired: false };
};
