import { Hono } from 'hono';
import { rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createJob, updateJob } from '../lib/job-manager.js';
import { isValidYouTubeUrl, downloadYouTubeAudio } from '../lib/youtube.js';
import { uploadFile } from '../lib/storage.js';
import { runDemucs } from '../lib/demucs.js';
import { runTranscription } from '../lib/transcription.js';
import { createDb } from '@nuit-one/db';
import { schema } from '@nuit-one/db';
import { eq } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const importRoutes = new Hono();

// POST /api/import/youtube — Import audio from YouTube URL
importRoutes.post('/youtube', async (c) => {
  const auth = c.get('auth');
  const { url } = await c.req.json<{ url: string }>();

  if (!url) return c.json({ error: 'Missing url' }, 400);
  if (!isValidYouTubeUrl(url)) return c.json({ error: 'Invalid YouTube URL' }, 400);

  // Create job immediately so we can return jobId
  const job = createJob('pending');

  // Process in background
  void (async () => {
    let workDir: string | null = null;

    try {
      // Step 1: Download audio from YouTube
      updateJob(job.id, { status: 'downloading', progress: 5 });
      const ytResult = await downloadYouTubeAudio(url);
      workDir = dirname(ytResult.filePath);

      // Step 2: Create project + track in DB
      updateJob(job.id, { status: 'processing', progress: 15 });

      let project = await db.query.projects.findFirst({
        where: eq(schema.projects.workspaceId, auth.workspaceId!),
      });

      if (!project) {
        const [newProject] = await db
          .insert(schema.projects)
          .values({
            workspaceId: auth.workspaceId!,
            name: 'Bass Karaoke',
            createdBy: auth.userId,
          })
          .returning();
        project = newProject!;
      }

      const [track] = await db
        .insert(schema.tracks)
        .values({
          projectId: project.id,
          userId: auth.userId,
          title: ytResult.title,
          instrument: 'full_mix',
          status: 'uploaded',
          originalFilename: `${ytResult.title}.wav`,
          fileSizeBytes: ytResult.fileSizeBytes,
          contentType: 'audio/wav',
        })
        .returning();

      const trackId = track!.id;
      const r2Key = `tracks/${trackId}/original/${ytResult.title}.wav`;

      // Step 3: Upload WAV to storage
      updateJob(job.id, { status: 'uploading', progress: 20 });
      await uploadFile(r2Key, ytResult.filePath, 'audio/wav');

      // Update track with r2Key
      await db.update(schema.tracks).set({ r2Key }).where(eq(schema.tracks.id, trackId));

      // Step 4: Run Demucs stem separation
      await db.update(schema.tracks).set({ status: 'processing' }).where(eq(schema.tracks.id, trackId));
      const stems = await runDemucs(job.id, trackId, r2Key);

      // Insert stem records
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

      // Step 5: Run Basic Pitch transcription on bass stem
      const bassStem = await db.query.stems.findFirst({
        where: eq(schema.stems.trackId, trackId),
      });

      if (bassStem) {
        const notes = await runTranscription(job.id, bassStem.r2Key);
        await db.update(schema.stems).set({ midiData: notes }).where(eq(schema.stems.id, bassStem.id));
      }

      // Mark track ready
      await db.update(schema.tracks).set({ status: 'ready' }).where(eq(schema.tracks.id, trackId));
      updateJob(job.id, { status: 'complete', progress: 100 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      updateJob(job.id, { status: 'error', error: message });
    } finally {
      // Clean up temp directory
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  })();

  return c.json({ jobId: job.id });
});
