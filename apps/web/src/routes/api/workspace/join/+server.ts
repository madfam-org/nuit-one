import { schema } from '@nuit-one/db';
import { error, json } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');

  const body = await request.json() as { token: string };
  if (!body.token) throw error(400, 'Token is required');

  const invitation = await db.query.workspaceInvitations.findFirst({
    where: and(
      eq(schema.workspaceInvitations.token, body.token),
      isNull(schema.workspaceInvitations.acceptedAt),
      gt(schema.workspaceInvitations.expiresAt, new Date()),
    ),
  });

  if (!invitation) throw error(404, 'Invalid or expired invitation');

  // Add member
  await db.insert(schema.workspaceMembers).values({
    workspaceId: invitation.workspaceId,
    userId: locals.userId,
    role: invitation.role as 'member' | 'admin' | 'viewer',
    displayName: 'New Member', // Will be updated on next auth sync
  });

  // Mark invitation as accepted
  await db
    .update(schema.workspaceInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.workspaceInvitations.id, invitation.id));

  return json({ workspaceId: invitation.workspaceId });
};
