import { schema } from '@nuit-one/db';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const workspaceId = locals.workspaceId ?? '';

  const members = await db
    .select()
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId));

  return json(members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    displayName: m.displayName,
    avatarUrl: m.avatarUrl,
    joinedAt: m.joinedAt?.toISOString() ?? '',
  })));
};
