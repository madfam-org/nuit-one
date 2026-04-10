import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const userId = locals.userId;
  const workspaceId = locals.workspaceId;
  if (!userId) {
    throw error(401, 'Unauthorized');
  }

  const recentProjects = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
    })
    .from(schema.projects)
    .where(eq(schema.projects.createdBy, userId))
    .orderBy(desc(schema.projects.createdAt))
    .limit(5);

  return {
    userId,
    workspaceId,
    user: {
      id: userId,
      email: 'dev@nuit.one',
      displayName: 'Developer',
    },
    workspace: {
      id: workspaceId,
      name: 'Dev Workspace',
      slug: 'dev',
      role: 'owner',
    },
    recentProjects,
    soketi: {
      appKey: env.SOKETI_APP_KEY ?? 'nuit-one-key',
      host: env.SOKETI_HOST ?? 'localhost',
      port: Number(env.SOKETI_PORT ?? '6001'),
    },
  };
};
