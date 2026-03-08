import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, desc, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';
  const workspaceId = locals.workspaceId ?? '00000000-0000-0000-0000-000000000002';

  const [tracks, projects] = await Promise.all([
    db
      .select()
      .from(schema.tracks)
      .where(eq(schema.tracks.userId, userId))
      .orderBy(desc(schema.tracks.createdAt)),
    db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        tempoBpm: schema.projects.tempoBpm,
        timeSignature: schema.projects.timeSignature,
        createdAt: schema.projects.createdAt,
        trackCount: sql<number>`(select count(*) from tracks where tracks.project_id = ${schema.projects.id})`.as('track_count'),
      })
      .from(schema.projects)
      .where(eq(schema.projects.workspaceId, workspaceId))
      .orderBy(desc(schema.projects.createdAt)),
  ]);

  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      instrument: t.instrument,
      createdAt: t.createdAt?.toISOString() ?? '',
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      tempoBpm: p.tempoBpm ?? 120,
      timeSignature: p.timeSignature ?? '4/4',
      trackCount: Number(p.trackCount),
      createdAt: p.createdAt?.toISOString() ?? '',
    })),
  };
};
