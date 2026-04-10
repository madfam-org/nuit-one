import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const workspaceId = locals.workspaceId ?? '';

  const members = await db
    .select()
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId));

  const pendingInvitations = await db
    .select()
    .from(schema.workspaceInvitations)
    .where(
      and(
        eq(schema.workspaceInvitations.workspaceId, workspaceId),
        isNull(schema.workspaceInvitations.acceptedAt),
        gt(schema.workspaceInvitations.expiresAt, new Date()),
      ),
    );

  return {
    members: members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt?.toISOString() ?? '',
    })),
    pendingInvitations: pendingInvitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt?.toISOString() ?? '',
    })),
    isAdmin: locals.roles?.some((r) => r === 'owner' || r === 'admin') ?? false,
  };
};
