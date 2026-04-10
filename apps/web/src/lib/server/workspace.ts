import { schema } from '@nuit-one/db';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';

export async function ensureWorkspaceMember(
  userId: string,
  workspaceId: string,
  roles?: string[],
  displayName?: string,
): Promise<void> {
  // Check if already exists
  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(schema.workspaceMembers.workspaceId, workspaceId),
      eq(schema.workspaceMembers.userId, userId),
    ),
  });

  if (existing) return;

  // Insert new member
  const role = roles?.[0] ?? 'member';
  await db.insert(schema.workspaceMembers).values({
    workspaceId,
    userId,
    role: role as 'owner' | 'admin' | 'manager' | 'member' | 'viewer',
    displayName: displayName ?? 'User',
  });
}
