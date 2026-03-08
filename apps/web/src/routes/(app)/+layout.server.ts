import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { desc, eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
  const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';
  const workspaceId = locals.workspaceId ?? '00000000-0000-0000-0000-000000000002';

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
  };
};
