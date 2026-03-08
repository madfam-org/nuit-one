import { db } from '$lib/server/db.js';
import { schema } from '@nuit-one/db';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';

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
    const userId = locals.userId ?? '00000000-0000-0000-0000-000000000001';
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
