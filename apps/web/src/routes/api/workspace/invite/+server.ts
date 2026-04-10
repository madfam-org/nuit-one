import { schema } from '@nuit-one/db';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  if (!locals.roles?.some((r) => r === 'owner' || r === 'admin')) {
    throw error(403, 'Only owners and admins can invite members');
  }

  const body = await request.json() as { email: string; role?: string };
  if (!body.email) throw error(400, 'Email is required');

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitation] = await db
    .insert(schema.workspaceInvitations)
    .values({
      workspaceId: locals.workspaceId ?? '',
      email: body.email,
      role: (body.role as 'member' | 'admin' | 'viewer') ?? 'member',
      invitedBy: locals.userId,
      token,
      expiresAt,
    })
    .returning();

  return json({ id: invitation?.id, token }, { status: 201 });
};
