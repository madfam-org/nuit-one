import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, desc, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';
  const workspaceId = locals.workspaceId ?? '00000000-0000-0000-0000-000000000002';

  const projects = await db
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
    .orderBy(desc(schema.projects.createdAt));

  return {
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

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';
    const workspaceId = locals.workspaceId ?? '00000000-0000-0000-0000-000000000002';
    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const tempoBpm = parseInt(formData.get('tempoBpm') as string, 10) || 120;
    const timeSignature = (formData.get('timeSignature') as string) || '4/4';

    if (!name) return { error: 'Name is required' };
    if (tempoBpm < 20 || tempoBpm > 300) return { error: 'Tempo must be between 20 and 300 BPM' };

    const [project] = await db
      .insert(schema.projects)
      .values({
        workspaceId,
        name,
        tempoBpm,
        timeSignature,
        createdBy: userId,
      })
      .returning();

    throw redirect(303, `/projects/${project!.id}`);
  },

  rename: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const name = (formData.get('name') as string)?.trim();

    if (!id || !name) return { error: 'ID and name are required' };

    await db
      .update(schema.projects)
      .set({ name })
      .where(eq(schema.projects.id, id));

    return { success: true };
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) return { error: 'ID is required' };

    await db.delete(schema.projects).where(eq(schema.projects.id, id));

    return { success: true };
  },
};
