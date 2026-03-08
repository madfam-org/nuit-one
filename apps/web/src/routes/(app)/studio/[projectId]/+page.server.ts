import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const workspaceId = locals.workspaceId ?? '00000000-0000-0000-0000-000000000002';

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, params.projectId),
  });

  if (!project) throw error(404, 'Project not found');
  if (project.workspaceId !== workspaceId) throw error(403, 'Forbidden');

  // Get tracks for this project
  const tracks = await db
    .select()
    .from(schema.tracks)
    .where(eq(schema.tracks.projectId, project.id));

  // Get stems for all tracks
  let allStems: Array<{
    id: string;
    trackId: string;
    stemType: string;
    r2Key: string;
  }> = [];

  if (tracks.length > 0) {
    const readyTrack = tracks.find((t) => t.status === 'ready');
    if (readyTrack) {
      const trackStems = await db
        .select()
        .from(schema.stems)
        .where(eq(schema.stems.trackId, readyTrack.id));
      allStems = trackStems.map((s) => ({
        id: s.id,
        trackId: s.trackId,
        stemType: s.stemType,
        r2Key: s.r2Key,
      }));
    }
  }

  // Build proxy URLs for stems
  const stemUrls: Record<string, string> = {};
  for (const stem of allStems) {
    const name = stem.stemType ?? 'unknown';
    stemUrls[name] = `/api/audio/${stem.r2Key}`;
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      tempoBpm: project.tempoBpm ?? 120,
      timeSignature: project.timeSignature ?? '4/4',
    },
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    })),
    stemUrls,
  };
};
