import { schema } from '@nuit-one/db';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.userId) throw error(401, 'Unauthorized');
  const userId = locals.userId;

  const profile = await db.query.calibrationProfiles.findFirst({
    where: and(eq(schema.calibrationProfiles.userId, userId), eq(schema.calibrationProfiles.isActive, true)),
  });

  return {
    profile: profile
      ? {
          id: profile.id,
          deviceName: profile.deviceName,
          inputLatencyMs: profile.inputLatencyMs,
          outputLatencyMs: profile.outputLatencyMs,
          displayLatencyMs: profile.displayLatencyMs,
        }
      : null,
  };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (!locals.userId) throw error(401, 'Unauthorized');
    const userId = locals.userId;
    const formData = await request.formData();

    const deviceName = (formData.get('deviceName') as string) || 'Default';
    const outputLatencyMs = parseFloat(formData.get('outputLatencyMs') as string) || 0;
    const inputLatencyMs = parseFloat(formData.get('inputLatencyMs') as string) || 0;
    const displayLatencyMs = parseFloat(formData.get('displayLatencyMs') as string) || 0;

    // Deactivate existing profiles
    await db
      .update(schema.calibrationProfiles)
      .set({ isActive: false })
      .where(eq(schema.calibrationProfiles.userId, userId));

    // Insert new profile
    await db.insert(schema.calibrationProfiles).values({
      userId,
      deviceName,
      inputLatencyMs,
      outputLatencyMs,
      displayLatencyMs,
      isActive: true,
    });

    return { success: true };
  },
};
