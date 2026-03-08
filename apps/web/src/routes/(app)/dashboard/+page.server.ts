import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';

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
