import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { Actions, PageServerLoad } from './$types';

const ALLOWED_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4', '5/4', '7/8', '12/8'];

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const workspaceId = locals.workspaceId ?? '';

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, params.projectId),
  });

  if (!project) throw error(404, 'Project not found');
  if (project.workspaceId !== workspaceId) throw error(403, 'Forbidden');

  return {
    project: {
      id: project.id,
      name: project.name,
      tempoBpm: project.tempoBpm ?? 120,
      timeSignature: project.timeSignature ?? '4/4',
    },
  };
};

export const actions: Actions = {
  updateTempo: async ({ request, params }) => {
    const formData = await request.formData();
    const tempoBpm = parseInt(formData.get('tempoBpm') as string, 10);

    if (Number.isNaN(tempoBpm) || tempoBpm < 20 || tempoBpm > 300) {
      return { error: 'Tempo must be between 20 and 300 BPM' };
    }

    await db.update(schema.projects).set({ tempoBpm }).where(eq(schema.projects.id, params.projectId));

    return { success: true };
  },

  updateTimeSignature: async ({ request, params }) => {
    const formData = await request.formData();
    const timeSignature = formData.get('timeSignature') as string;

    if (!ALLOWED_TIME_SIGNATURES.includes(timeSignature)) {
      return { error: 'Invalid time signature' };
    }

    await db.update(schema.projects).set({ timeSignature }).where(eq(schema.projects.id, params.projectId));

    return { success: true };
  },
};
