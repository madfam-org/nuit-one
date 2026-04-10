import { type Database, schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';
import { DEMO_PROJECT_ID, DEMO_TRACKS } from '$lib/data/demo-tracks.js';

export async function seedDemoTracks(db: Database, userId: string, workspaceId: string): Promise<string> {
  // Check if demo project already exists for this user
  const existing = await db.query.projects.findFirst({
    where: eq(schema.projects.id, DEMO_PROJECT_ID),
  });

  if (existing) {
    // Return first demo track ID
    return DEMO_TRACKS[0]?.id;
  }

  // Create demo project
  await db.insert(schema.projects).values({
    id: DEMO_PROJECT_ID,
    workspaceId,
    name: 'Demo Songs',
    tempoBpm: 120,
    timeSignature: '4/4',
    createdBy: userId,
  });

  // Create tracks and stems
  for (const track of DEMO_TRACKS) {
    await db.insert(schema.tracks).values({
      id: track.id,
      projectId: DEMO_PROJECT_ID,
      userId,
      title: track.title,
      instrument: 'full_mix',
      status: 'ready',
    });

    for (const stem of track.stems) {
      await db.insert(schema.stems).values({
        trackId: track.id,
        stemType: stem.stemType,
        r2Key: stem.r2Key,
        source: 'demucs',
        midiData: stem.notes,
        createdBy: userId,
      });
    }
  }

  return DEMO_TRACKS[0]?.id;
}
