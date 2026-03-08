import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const userId = locals.userId;
  if (!userId) throw error(401, 'Unauthorized');

  const { trackId } = (await request.json()) as { trackId: string };
  if (!trackId) throw error(400, 'Missing trackId');

  const track = await db.query.tracks.findFirst({
    where: and(
      eq(schema.tracks.id, trackId),
      eq(schema.tracks.userId, userId),
    ),
  });

  if (!track) throw error(404, 'Track not found');
  if (track.status !== 'pending_upload') {
    throw error(400, `Track is not pending upload (status: ${track.status})`);
  }

  await db
    .update(schema.tracks)
    .set({ status: 'uploaded' })
    .where(eq(schema.tracks.id, trackId));

  return json({ success: true, trackId });
};
