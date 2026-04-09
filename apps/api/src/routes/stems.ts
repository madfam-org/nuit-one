import { schema } from '@nuit-one/db';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { runDemucs } from '../lib/demucs.js';
import { createJob, getJob, updateJob } from '../lib/job-manager.js';
import { runTranscription } from '../lib/transcription.js';

export const stemRoutes = new Hono();

// POST /api/stems/split — Trigger Demucs stem splitting
stemRoutes.post('/split', async (c) => {
  const auth = c.get('auth');
  const { trackId } = await c.req.json<{ trackId: string }>();

  if (!trackId) return c.json({ error: 'Missing trackId' }, 400);

  // Verify track exists and is uploaded
  const db = c.get('db');
  const track = await db.query.tracks.findFirst({
    where: eq(schema.tracks.id, trackId),
  });

  if (!track) return c.json({ error: 'Track not found' }, 404);
  if (track.status !== 'uploaded') {
    return c.json({ error: `Track not ready for processing (status: ${track.status})` }, 400);
  }
  if (!track.r2Key) return c.json({ error: 'Track has no uploaded file' }, 400);

  // Create job and start processing in background
  const job = createJob(trackId);

  // Update track status
  await db.update(schema.tracks).set({ status: 'processing' }).where(eq(schema.tracks.id, trackId));

  // Run Demucs in background (don't await)
  const r2Key = track.r2Key;
  void (async () => {
    try {
      const stems = await runDemucs(job.id, trackId, r2Key);

      // Insert stem records into DB
      for (const stem of stems) {
        await db.insert(schema.stems).values({
          trackId,
          stemType: stem.stemType,
          r2Key: stem.r2Key,
          fileSizeBytes: stem.fileSizeBytes,
          source: 'demucs',
          createdBy: auth.userId,
        });
      }

      // Update track status to ready
      await db.update(schema.tracks).set({ status: 'ready' }).where(eq(schema.tracks.id, trackId));
      updateJob(job.id, { status: 'complete', progress: 100 });
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      const message = err instanceof Error ? err.message : 'Processing failed';
      updateJob(job.id, { status: 'error', error: message });
      await db.update(schema.tracks).set({ status: 'error' }).where(eq(schema.tracks.id, trackId));
    }
  })();

  return c.json({ jobId: job.id, trackId });
});

// GET /api/stems/jobs/:jobId — Poll job status
stemRoutes.get('/jobs/:jobId', (c) => {
  const jobId = c.req.param('jobId');
  const job = getJob(jobId);
  if (!job) return c.json({ error: 'Job not found' }, 404);
  return c.json(job);
});

// POST /api/stems/transcribe — Trigger Basic Pitch audio-to-MIDI
stemRoutes.post('/transcribe', async (c) => {
  c.get('auth'); // verify authenticated
  const { trackId } = await c.req.json<{ trackId: string }>();

  if (!trackId) return c.json({ error: 'Missing trackId' }, 400);

  const db = c.get('db');
  // Find the bass stem for this track
  const bassStem = await db.query.stems.findFirst({
    where: and(eq(schema.stems.trackId, trackId), eq(schema.stems.stemType, 'bass')),
  });

  if (!bassStem) return c.json({ error: 'No bass stem found' }, 404);

  const job = createJob(trackId);

  // Run transcription in background
  void (async () => {
    try {
      const notes = await runTranscription(job.id, bassStem.r2Key);

      // Store note data on the stem
      await db.update(schema.stems).set({ midiData: notes }).where(eq(schema.stems.id, bassStem.id));

      updateJob(job.id, { status: 'complete', progress: 100 });
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      const message = err instanceof Error ? err.message : 'Transcription failed';
      updateJob(job.id, { status: 'error', error: message });
    }
  })();

  return c.json({ jobId: job.id, stemId: bassStem.id });
});
