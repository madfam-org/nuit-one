import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const userId = locals.userId;

  const tracks = await db
    .select()
    .from(schema.tracks)
    .where(eq(schema.tracks.userId, userId))
    .orderBy(desc(schema.tracks.createdAt));

  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      userId: t.userId,
      title: t.title,
      instrument: t.instrument,
      status: t.status,
      r2Key: t.r2Key,
      originalFilename: t.originalFilename,
      fileSizeBytes: t.fileSizeBytes,
      contentType: t.contentType,
      assignedTo: t.assignedTo,
      sortOrder: t.sortOrder ?? 0,
      createdAt: t.createdAt?.toISOString() ?? '',
    })),
  };
};
