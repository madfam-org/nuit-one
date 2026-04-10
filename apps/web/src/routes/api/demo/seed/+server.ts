import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { seedDemoTracks } from '$lib/server/demo-seed.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const trackId = await seedDemoTracks(db, locals.userId, locals.workspaceId ?? '');
  return json({ trackId });
};
