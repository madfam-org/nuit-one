import { schema } from '@nuit-one/db';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  if (!locals.roles?.some((r) => r === 'owner' || r === 'admin')) {
    throw error(403, 'Only owners and admins can remove members');
  }

  const workspaceId = locals.workspaceId ?? '';

  await db
    .delete(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, params.userId),
      ),
    );

  return json({ success: true });
};
